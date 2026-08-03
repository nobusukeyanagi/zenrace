from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "gradedraces"))

from scripts.master_schedule import MasterRecord, reconcile
from scripts.update_races import select_smart_target_indices
from monthly.scripts.common import SourceResult, load_monthly_data
from monthly.scripts.sources.autorace import _parse_pdf_layout
from monthly.scripts.update_schedule import end_of_month_after, sync_smart


def check_end_of_next_month() -> None:
    assert end_of_month_after(date(2026, 8, 3), 1) == date(2026, 9, 30)
    assert end_of_month_after(date(2026, 12, 31), 1) == date(2027, 1, 31)


def check_smart_sync_refresh_retry_and_new_addition() -> None:
    def daily(target: date, _session) -> SourceResult:
        return SourceResult("keirin", True, entries=[{"sport": "keirin", "venue": "青森", "grade": "FⅠ"}])

    def monthly(year: int, month: int, _session) -> SourceResult:
        entries = []
        if (year, month) == (2026, 8):
            entries = [
                {"date": "2026-08-20", "sport": "keirin", "venue": "函館", "grade": "FⅡ"},
                # 既存行は新規追加探索では上書きしない。
                {"date": "2026-08-20", "sport": "keirin", "venue": "青森", "grade": "GⅢ"},
            ]
        if (year, month) == (2026, 9):
            entries = [{"date": "2026-09-30", "sport": "keirin", "venue": "大宮", "grade": "FⅠ"}]
        return SourceResult("keirin", True, entries=entries)

    with TemporaryDirectory() as directory:
        root = Path(directory)
        monthly_js = root / "monthly.js"
        monthly_js.write_text(
            'const MONTHLY_DATA = {"2026-08":[{"date":"2026-08-20","venues":[{"sport":"keirin","venue":"青森","grade":"FⅠ"}]}]};\n\n  const WEEKDAY = [];\n',
            encoding="utf-8",
        )
        report_path = root / "report.json"
        state_path = root / "state.json"
        state_path.write_text(
            json.dumps(
                {
                    "unresolved": [
                        {"date": "2026-07-01", "sport": "keirin", "error": "temporary"}
                    ]
                }
            ),
            encoding="utf-8",
        )
        payload, original = load_monthly_data(monthly_js)
        with (
            patch("monthly.scripts.update_schedule.DAILY_COLLECTORS", (("keirin", daily),)),
            patch("monthly.scripts.update_schedule.MONTH_COLLECTORS", (("keirin", monthly),)),
            patch("monthly.scripts.update_schedule.COLLECTOR_BY_SPORT", {"keirin": daily}),
        ):
            report = sync_smart(
                payload=payload,
                original_text=original,
                monthly_path=monthly_js,
                center=date(2026, 8, 3),
                grades=[],
                report_path=report_path,
                state_path=state_path,
            )

        assert report["refresh_window"] == {
            "start": "2026-08-02",
            "end": "2026-08-17",
            "policy": "前日＋当日から14日後",
        }
        assert report["retried_unresolved_count"] == 1
        assert report["unresolved_after_count"] == 0
        additions = {(item["date"], item["venue"]) for item in report["new_additions"]}
        assert additions == {("2026-08-20", "函館"), ("2026-09-30", "大宮")}
        updated, _ = load_monthly_data(monthly_js)
        aug20 = next(row for row in updated["2026-08"] if row["date"] == "2026-08-20")
        by_venue = {item["venue"]: item for item in aug20["venues"]}
        assert by_venue["青森"]["grade"] == "FⅠ"
        assert by_venue["函館"]["grade"] == "FⅡ"


def check_graded_master_defers_new_records_after_next_month_end() -> None:
    official = [
        MasterRecord("2026-09-30", "jra", "中山", "GⅠ", "対象内"),
        MasterRecord("2026-10-01", "jra", "東京", "GⅠ", "対象外"),
    ]
    deferred: list[dict[str, str]] = []
    updated, _changes, additions = reconcile(
        [],
        official,
        date(2026, 8, 3),
        addition_end=date(2026, 9, 30),
        deferred_additions=deferred,
    )
    assert [item["name"] for item in additions] == ["対象内"]
    assert [item["name"] for item in deferred] == ["対象外"]
    assert [item["name"] for item in updated] == ["対象内"]



def check_graded_detail_window_uses_previous_day_only() -> None:
    center = date(2026, 8, 3)
    records = [
        {"date": "2026-08-01", "time": "12:00", "winner": "確定"},
        {"date": "2026-08-02", "time": "12:00", "winner": "確定"},
        {"date": "2026-08-17", "time": "", "winner": ""},
        {"date": "2026-08-18", "time": "", "winner": ""},
        {"date": "2026-06-01", "time": "12:00", "winner": ""},
    ]
    indices, reasons = select_smart_target_indices(
        records,
        center,
        upcoming_days=14,
        unresolved_retry_days=90,
        recent_verification_days=1,
    )
    assert indices == [1, 2, 4]
    assert reasons[1] == ["recent_verification"]
    assert reasons[2] == ["upcoming"]
    assert reasons[4] == ["unresolved"]

def check_autorace_pdf_layout_uses_date_columns_and_ignores_thin_grid_lines() -> None:
    boundaries = [101.6 + 20 * index for index in range(33)]
    rects = [
        {
            "x0": 66.0,
            "x1": 102.0,
            "top": 100.0,
            "bottom": 125.0,
            "width": 36.0,
            "height": 25.0,
            "non_stroking_color": (1.0, 0.0, 1.0),
        }
    ]
    rects.extend(
        {
            "x0": value,
            "x1": value + 0.5,
            "top": 90.0,
            "bottom": 100.0,
            "width": 0.5,
            "height": 10.0,
            "non_stroking_color": (0.0, 0.0, 0.0),
        }
        for value in boundaries
    )
    # 先頭の1列は前月からの継続表示欄。日付1～3日に対応する範囲を塗る。
    rects.append(
        {
            "x0": boundaries[1],
            "x1": boundaries[4],
            "top": 108.0,
            "bottom": 121.0,
            "width": boundaries[4] - boundaries[1],
            "height": 13.0,
            "non_stroking_color": (1.0, 0.0, 1.0),
        }
    )
    # 幅があっても薄い罫線は伊勢崎開催として扱わない。
    rects.append(
        {
            "x0": boundaries[5],
            "x1": boundaries[10],
            "top": 130.0,
            "bottom": 130.5,
            "width": boundaries[10] - boundaries[5],
            "height": 0.5,
            "non_stroking_color": (0.0, 0.0, 0.0),
        }
    )
    words = [
        {"text": "◎普通開催", "x0": boundaries[1], "x1": boundaries[4], "top": 108.0, "bottom": 121.0}
    ]
    entries = _parse_pdf_layout(rects, words, "２０２６年８月オートレース日程表")
    assert [(item["date"], item["venue"]) for item in entries] == [
        ("2026-08-01", "川口"),
        ("2026-08-02", "川口"),
        ("2026-08-03", "川口"),
    ]


class SmartScheduleTests(unittest.TestCase):
    def test_end_of_next_month(self) -> None:
        check_end_of_next_month()

    def test_smart_sync_refresh_retry_and_new_addition(self) -> None:
        check_smart_sync_refresh_retry_and_new_addition()

    def test_graded_master_defers_new_records_after_next_month_end(self) -> None:
        check_graded_master_defers_new_records_after_next_month_end()

    def test_graded_detail_window_uses_previous_day_only(self) -> None:
        check_graded_detail_window_uses_previous_day_only()

    def test_autorace_pdf_layout_uses_date_columns_and_ignores_thin_grid_lines(self) -> None:
        check_autorace_pdf_layout_uses_date_columns_and_ignores_thin_grid_lines()
