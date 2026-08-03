from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from monthly.scripts.common import (
    OfficialSession,
    SourceResult,
    find_day,
    load_monthly_data,
    normalize_grade,
    overlay_grades,
    sort_entries,
    write_monthly_data,
)
from monthly.scripts.sources import autorace, boatrace, jra, keirin, nar
from monthly.scripts.verified_schedule import (
    count_by_sport,
    load_snapshot,
    load_verified_month,
    parse_month_key,
    validate_month_rows,
)

JST = ZoneInfo("Asia/Tokyo")
SOURCE_COLLECTORS = (keirin.collect, autorace.collect, boatrace.collect, nar.collect, jra.collect)


def parse_target(value: str | None) -> date:
    if value:
        return date.fromisoformat(value)
    return datetime.now(JST).date()


def load_grade_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [item for item in payload if isinstance(item, dict)] if isinstance(payload, list) else []


def source_summary(result: SourceResult) -> dict[str, Any]:
    return {
        "sport": result.sport,
        "ok": result.ok,
        "entry_count": len(result.entries),
        "fetched_urls": result.fetched_urls,
        "warnings": result.warnings,
        "error": result.error,
    }


def apply_source_results(
    current_entries: list[dict[str, Any]],
    results: list[SourceResult],
) -> list[dict[str, Any]]:
    """取得成功した競技は0件を含めて公式結果へ置換し、失敗した競技だけ既存値を維持する。"""
    updated = [dict(item) for item in current_entries]
    for result in results:
        if not result.ok:
            continue
        existing_for_sport = [item for item in updated if item.get("sport") == result.sport]
        other_sports = [item for item in updated if item.get("sport") != result.sport]
        merged_entries: list[dict[str, Any]] = []
        for fresh in result.entries:
            old = next(
                (item for item in existing_for_sport if item.get("venue") == fresh.get("venue")),
                None,
            )
            merged = dict(fresh)
            # 日別ページに載らない補助情報だけを既存値から引き継ぐ。
            # sessionなど当日の公式結果に無い属性は引き継がず、古い情報の残留を防ぐ。
            if old:
                for key in ("day", "grade", "girls"):
                    if key not in merged and old.get(key) not in (None, "", False):
                        merged[key] = old[key]
            merged_entries.append(merged)
        # 公式ページの確認に成功して0件だった場合も、その競技は「開催なし」として古い値を消す。
        updated = other_sports + merged_entries
    return updated


def normalize_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for raw in entries:
        item = dict(raw)
        sport = str(item.get("sport", ""))
        venue = str(item.get("venue", ""))
        key = (sport, venue)
        if key in seen:
            raise ValueError(f"同一日の開催が重複しています: {sport} {venue}")
        seen.add(key)
        if item.get("grade"):
            item["grade"] = normalize_grade(sport, item.get("grade"))
        normalized.append(item)
    return sort_entries(normalized)


def sync_verified_month(
    *,
    payload: dict[str, list[dict[str, Any]]],
    original_text: str,
    monthly_path: Path,
    month: str,
    snapshot_path: Path,
    grades: list[dict[str, Any]],
    report_path: Path,
) -> dict[str, Any]:
    parse_month_key(month)
    before = json.loads(json.dumps(payload.get(month, []), ensure_ascii=False))
    rows = load_verified_month(snapshot_path, month)
    for row in rows:
        target = date.fromisoformat(row["date"])
        overlay_grades(row["venues"], grades, target)
        row["venues"] = normalize_entries(row["venues"])
    rows = validate_month_rows(rows, month)
    payload[month] = rows
    write_monthly_data(monthly_path, payload, original_text)

    snapshot = load_snapshot(snapshot_path)
    report = {
        "generated_at": datetime.now(JST).isoformat(),
        "mode": "verified_month",
        "target_month": month,
        "before_count": sum(len(row.get("venues", [])) for row in before),
        "after_count": sum(len(row.get("venues", [])) for row in rows),
        "changed": before != rows,
        "counts_by_sport": count_by_sport(rows),
        "snapshot_verified_at": snapshot.get("verified_at", ""),
        "snapshot_basis": snapshot.get("basis", ""),
        "sources": [
            {
                "sport": sport,
                "ok": True,
                "entry_count": count_by_sport(rows).get(sport, 0),
                "fetched_urls": [url] if isinstance(url, str) else list(url.values()),
                "warnings": [],
                "error": "",
            }
            for sport, source_map in snapshot.get("sources", {}).items()
            for url in [source_map.get(month, "") if isinstance(source_map, dict) else ""]
            if url
        ],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="公式サイトを確認し、開催日程をmonthly.jsへ反映します。")
    target_group = parser.add_mutually_exclusive_group()
    target_group.add_argument("--date", help="基準日 YYYY-MM-DD。省略時は日本時間の当日")
    target_group.add_argument("--month", help="検証済み公式月間表から全置換する対象月 YYYY-MM")
    parser.add_argument("--fail-if-all-sources-fail", action="store_true")
    parser.add_argument("--monthly-js", default="monthly/monthly.js")
    parser.add_argument("--graded-races", default="gradedraces/races.json")
    parser.add_argument("--verified-schedule", default="monthly/data/official_schedule.json")
    parser.add_argument("--report", default="monthly/monthly_update_report.json")
    args = parser.parse_args()

    root = Path.cwd()
    monthly_path = root / args.monthly_js
    grade_path = root / args.graded_races
    snapshot_path = root / args.verified_schedule
    report_path = root / args.report
    payload, original_text = load_monthly_data(monthly_path)
    grades = load_grade_records(grade_path)

    if args.month:
        report = sync_verified_month(
            payload=payload,
            original_text=original_text,
            monthly_path=monthly_path,
            month=args.month,
            snapshot_path=snapshot_path,
            grades=grades,
            report_path=report_path,
        )
        print(
            json.dumps(
                {
                    "target_month": args.month,
                    "changed": report["changed"],
                    "after_count": report["after_count"],
                    "counts_by_sport": report["counts_by_sport"],
                },
                ensure_ascii=False,
            )
        )
        return 0

    target = parse_target(args.date)
    target_day = find_day(payload, target)
    before = [dict(item) for item in target_day.get("venues", [])]
    session = OfficialSession()
    results: list[SourceResult] = []

    for collector in SOURCE_COLLECTORS:
        try:
            result = collector(target, session)
        except Exception as exc:
            sport = collector.__module__.rsplit(".", 1)[-1].replace("autorace", "auto").replace("boatrace", "boat")
            result = SourceResult(sport=sport, ok=False, error=str(exc))
        results.append(result)

    current_entries = apply_source_results(before, results)
    overlay_grades(current_entries, grades, target)
    target_day["venues"] = normalize_entries(current_entries)

    # 日目は各公式ページの表記、または検証済み月間表を優先する。
    # 同一場で連続する別節を誤結合しないため、日付の連続だけでは再計算しない。
    write_monthly_data(monthly_path, payload, original_text)
    after = [dict(item) for item in target_day.get("venues", [])]
    report = {
        "generated_at": datetime.now(JST).isoformat(),
        "mode": "daily_official",
        "target_date": target.isoformat(),
        "before_count": len(before),
        "after_count": len(after),
        "changed": before != after,
        "before": before,
        "after": after,
        "sources": [source_summary(result) for result in results],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    failed_count = sum(1 for result in results if not result.ok)
    print(json.dumps({"target_date": target.isoformat(), "changed": before != after, "sources_failed": failed_count}, ensure_ascii=False))
    if args.fail_if_all_sources_fail and failed_count == len(results):
        print("全開催日程ソースの取得に失敗しました。", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
