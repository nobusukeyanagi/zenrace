from __future__ import annotations

import copy
import unittest
from pathlib import Path

from monthly.scripts.common import SourceResult, load_monthly_data
from monthly.scripts.update_schedule import apply_source_results
from monthly.scripts.verified_schedule import (
    count_by_sport,
    load_snapshot,
    load_verified_month,
    validate_month_rows,
)

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "monthly/data/official_schedule.json"
MONTHLY_JS = ROOT / "monthly/monthly.js"
EXPECTED_COUNTS = {
    "2026-07": {"keirin": 246, "auto": 65, "boat": 413, "nar": 120, "jra": 24},
    "2026-08": {"keirin": 233, "auto": 67, "boat": 411, "nar": 112, "jra": 30},
}


def day_rows(rows: list[dict], target: str) -> list[dict]:
    return next(row["venues"] for row in rows if row["date"] == target)


def find(entries: list[dict], sport: str, venue: str) -> dict | None:
    return next((item for item in entries if item["sport"] == sport and item["venue"] == venue), None)


class VerifiedScheduleTests(unittest.TestCase):
    def test_verified_months_are_complete(self) -> None:
        for month, expected in EXPECTED_COUNTS.items():
            rows = load_verified_month(SNAPSHOT, month)
            self.assertEqual(count_by_sport(rows), expected)

    def test_fixed_july_data_matches_verified_snapshot(self) -> None:
        monthly, _ = load_monthly_data(MONTHLY_JS)
        self.assertEqual(monthly["2026-07"], load_verified_month(SNAPSHOT, "2026-07"))
        validate_month_rows(monthly["2026-08"], "2026-08")

    def test_july_cross_month_and_auto_corrections(self) -> None:
        rows = load_verified_month(SNAPSHOT, "2026-07")
        july_1 = day_rows(rows, "2026-07-01")
        self.assertEqual(find(july_1, "keirin", "高知")["day"], "最終日")
        self.assertEqual(find(july_1, "keirin", "武雄")["day"], "最終日")

        july_24 = day_rows(rows, "2026-07-24")
        self.assertEqual(
            [(item["venue"], item.get("session", "")) for item in july_24 if item["sport"] == "auto"],
            [("飯塚", "night")],
        )
        july_25 = day_rows(rows, "2026-07-25")
        self.assertIsNone(find(july_25, "auto", "伊勢崎"))

        july_31 = day_rows(rows, "2026-07-31")
        expected_starts = {"いわき平", "京王閣", "防府", "高知", "武雄", "佐世保"}
        actual_starts = {
            item["venue"]
            for item in july_31
            if item["sport"] == "keirin" and item.get("day") == "初日"
        }
        self.assertTrue(expected_starts.issubset(actual_starts))

    def test_august_official_spot_checks(self) -> None:
        rows = load_verified_month(SNAPSHOT, "2026-08")
        august_1 = day_rows(rows, "2026-08-01")
        self.assertEqual(
            {item["venue"] for item in august_1 if item["sport"] == "keirin"},
            {"いわき平", "京王閣", "小田原", "防府", "高知", "武雄", "佐世保"},
        )
        self.assertEqual(
            {item["venue"] for item in august_1 if item["sport"] == "auto"},
            {"川口", "浜松", "山陽"},
        )
        self.assertTrue(all(find(day["venues"], "nar", "水沢") is None for day in rows))
        for day in range(24, 29):
            item = find(day_rows(rows, f"2026-08-{day:02d}"), "nar", "船橋")
            self.assertIsNotNone(item)
            self.assertEqual(item.get("session"), "night")

    def test_duplicate_entry_is_rejected(self) -> None:
        rows = load_verified_month(SNAPSHOT, "2026-08")
        broken = copy.deepcopy(rows)
        broken[0]["venues"].append(copy.deepcopy(broken[0]["venues"][0]))
        with self.assertRaisesRegex(ValueError, "重複"):
            validate_month_rows(broken, "2026-08")

    def test_successful_zero_result_clears_stale_sport_only(self) -> None:
        current = [
            {"sport": "keirin", "venue": "青森", "grade": "FⅠ"},
            {"sport": "boat", "venue": "戸田", "grade": "一般"},
        ]
        updated = apply_source_results(
            current,
            [
                SourceResult("keirin", True, entries=[]),
                SourceResult("boat", False, error="temporary failure"),
            ],
        )
        self.assertEqual(updated, [{"sport": "boat", "venue": "戸田", "grade": "一般"}])


    def test_successful_refresh_does_not_keep_stale_session(self) -> None:
        current = [
            {"sport": "auto", "venue": "川口", "grade": "普通", "day": "2日目", "session": "night"}
        ]
        updated = apply_source_results(
            current,
            [SourceResult("auto", True, entries=[{"sport": "auto", "venue": "川口", "grade": "普通"}])],
        )
        self.assertEqual(updated, [{"sport": "auto", "venue": "川口", "grade": "普通", "day": "2日目"}])

    def test_snapshot_metadata_has_official_sources_for_each_month(self) -> None:
        snapshot = load_snapshot(SNAPSHOT)
        for sport in EXPECTED_COUNTS["2026-07"]:
            self.assertIn(sport, snapshot["sources"])
            self.assertIn("2026-07", snapshot["sources"][sport])
            self.assertIn("2026-08", snapshot["sources"][sport])


if __name__ == "__main__":
    unittest.main()
