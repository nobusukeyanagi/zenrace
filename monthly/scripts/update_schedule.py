from __future__ import annotations

import argparse
import calendar
import copy
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo

from monthly.scripts.common import (
    OfficialSession,
    SourceResult,
    daterange,
    existing_entry,
    find_day,
    load_monthly_data,
    normalize_grade,
    overlay_grades,
    relabel_meeting_days,
    sort_entries,
    write_monthly_data,
)
from monthly.scripts.sources import autorace, boatrace, jra, keirin, nar
from monthly.scripts.verified_schedule import (
    count_by_sport,
    load_snapshot,
    load_verified_month,
    parse_month_key,
    validate_partial_month_rows,
    validate_month_rows,
)

JST = ZoneInfo("Asia/Tokyo")
DAILY_COLLECTORS: tuple[tuple[str, Callable[[date, OfficialSession], SourceResult]], ...] = (
    ("keirin", keirin.collect),
    ("auto", autorace.collect),
    ("boat", boatrace.collect),
    ("nar", nar.collect),
    ("jra", jra.collect),
)
MONTH_COLLECTORS: tuple[tuple[str, Callable[[int, int, OfficialSession], SourceResult]], ...] = (
    ("keirin", keirin.collect_month),
    ("auto", autorace.collect_month),
    ("boat", boatrace.collect_month),
    ("nar", nar.collect_month),
    ("jra", jra.collect_month),
)
COLLECTOR_BY_SPORT = dict(DAILY_COLLECTORS)
SMART_PREVIOUS_DAYS = 1
SMART_UPCOMING_DAYS = 14
SMART_UNRESOLVED_DAYS = 90
SMART_NEW_ADDITION_MONTHS_AHEAD = 1
DAY_SPORTS = {"keirin", "auto", "boat"}


def parse_target(value: str | None) -> date:
    if value:
        return date.fromisoformat(value)
    return datetime.now(JST).date()


def end_of_month_after(target: date, months_ahead: int) -> date:
    month_index = target.year * 12 + (target.month - 1) + months_ahead
    year, zero_based_month = divmod(month_index, 12)
    month = zero_based_month + 1
    return date(year, month, calendar.monthrange(year, month)[1])


def iter_months(start: date, end: date) -> list[tuple[int, int]]:
    current_year, current_month = start.year, start.month
    result: list[tuple[int, int]] = []
    while (current_year, current_month) <= (end.year, end.month):
        result.append((current_year, current_month))
        if current_month == 12:
            current_year += 1
            current_month = 1
        else:
            current_month += 1
    return result


def payload_count(payload: dict[str, list[dict[str, Any]]]) -> int:
    return sum(
        len(row.get("venues", []))
        for rows in payload.values()
        for row in rows
        if isinstance(row, dict)
    )


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


def load_sync_state(path: Path) -> dict[tuple[str, str], dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    failures = payload.get("unresolved", []) if isinstance(payload, dict) else []
    result: dict[tuple[str, str], dict[str, Any]] = {}
    for item in failures:
        if not isinstance(item, dict):
            continue
        target_date = str(item.get("date", ""))
        sport = str(item.get("sport", ""))
        try:
            date.fromisoformat(target_date)
        except ValueError:
            continue
        if sport not in COLLECTOR_BY_SPORT:
            continue
        result[(target_date, sport)] = dict(item)
    return result


def write_sync_state(path: Path, failures: dict[tuple[str, str], dict[str, Any]]) -> None:
    rows = sorted(failures.values(), key=lambda item: (str(item.get("date", "")), str(item.get("sport", ""))))
    payload = {
        "schema_version": 1,
        "updated_at": datetime.now(JST).isoformat(),
        "unresolved": rows,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def record_sync_result(
    failures: dict[tuple[str, str], dict[str, Any]],
    target: date,
    result: SourceResult,
) -> None:
    key = (target.isoformat(), result.sport)
    if result.ok:
        failures.pop(key, None)
        return
    now = datetime.now(JST).isoformat()
    previous = failures.get(key, {})
    failures[key] = {
        "date": target.isoformat(),
        "sport": result.sport,
        "first_failed_at": previous.get("first_failed_at", now),
        "last_attempt_at": now,
        "error": result.error or "公式日程を確認できませんでした",
    }


def aggregate_result(summary: dict[str, dict[str, Any]], result: SourceResult) -> None:
    item = summary.setdefault(
        result.sport,
        {
            "sport": result.sport,
            "attempts": 0,
            "success_count": 0,
            "failure_count": 0,
            "entry_count": 0,
            "fetched_urls": [],
            "warnings": [],
            "errors": [],
        },
    )
    item["attempts"] += 1
    item["entry_count"] += len(result.entries)
    if result.ok:
        item["success_count"] += 1
    else:
        item["failure_count"] += 1
        if result.error:
            item["errors"].append(result.error)
    item["fetched_urls"].extend(result.fetched_urls)
    item["warnings"].extend(result.warnings)


def finalize_source_summary(summary: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for sport, _collector in DAILY_COLLECTORS:
        item = summary.get(
            sport,
            {
                "sport": sport,
                "attempts": 0,
                "success_count": 0,
                "failure_count": 0,
                "entry_count": 0,
                "fetched_urls": [],
                "warnings": [],
                "errors": [],
            },
        )
        urls = list(dict.fromkeys(str(value) for value in item["fetched_urls"] if value))
        warnings = list(dict.fromkeys(str(value) for value in item["warnings"] if value))
        errors = list(dict.fromkeys(str(value) for value in item["errors"] if value))
        rows.append(
            {
                "sport": sport,
                "ok": item["attempts"] > 0 and item["failure_count"] == 0,
                "attempts": item["attempts"],
                "success_count": item["success_count"],
                "failure_count": item["failure_count"],
                "entry_count": item["entry_count"],
                "fetched_urls": urls,
                "warnings": warnings,
                "error": " / ".join(errors),
            }
        )
    return rows


def safe_collect_daily(
    sport: str,
    collector: Callable[[date, OfficialSession], SourceResult],
    target: date,
    session: OfficialSession,
) -> SourceResult:
    try:
        result = collector(target, session)
    except Exception as exc:
        return SourceResult(sport=sport, ok=False, error=str(exc))
    if result.sport != sport:
        result.sport = sport
    return result


def safe_collect_month(
    sport: str,
    collector: Callable[[int, int, OfficialSession], SourceResult],
    year: int,
    month: int,
    session: OfficialSession,
) -> SourceResult:
    try:
        result = collector(year, month, session)
    except Exception as exc:
        return SourceResult(sport=sport, ok=False, error=str(exc))
    if result.sport != sport:
        result.sport = sport
    return result


def apply_day_update(
    payload: dict[str, list[dict[str, Any]]],
    target: date,
    results: list[SourceResult],
    grades: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    target_day = find_day(payload, target)
    before = [dict(item) for item in target_day.get("venues", [])]
    current_entries = apply_source_results(before, results)
    overlay_grades(current_entries, grades, target)
    target_day["venues"] = normalize_entries(current_entries)

    # 日別ページに「初日／○日目／最終日」が無い競技でも、前後の連続開催から
    # 必ず日目表記を再構成する。開催の追加・削除のどちらにも対応するため、
    # 対象日と前後日を起点に同一開催場の連続区間を再ラベルする。
    affected_pairs = {
        (str(item.get("sport", "")), str(item.get("venue", "")))
        for item in [*before, *target_day.get("venues", [])]
        if str(item.get("sport", "")) in DAY_SPORTS and item.get("venue")
    }
    for sport, venue in sorted(affected_pairs):
        for around in (target - timedelta(days=1), target, target + timedelta(days=1)):
            relabel_meeting_days(payload, sport, venue, around)

    return before, [dict(item) for item in target_day.get("venues", [])]


def add_future_entries(
    payload: dict[str, list[dict[str, Any]]],
    result: SourceResult,
    start: date,
    end: date,
    grades: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not result.ok:
        return []
    additions: list[dict[str, Any]] = []
    affected_dates: set[date] = set()
    affected_meetings: set[tuple[str, str, date]] = set()
    for raw in result.entries:
        raw_date = str(raw.get("date", ""))
        try:
            target = date.fromisoformat(raw_date)
        except ValueError:
            continue
        if not start <= target <= end:
            continue
        sport = str(raw.get("sport", result.sport))
        venue = str(raw.get("venue", ""))
        if not venue or existing_entry(payload, target, sport, venue) is not None:
            continue
        item = {key: value for key, value in raw.items() if key != "date"}
        item["sport"] = sport
        item["venue"] = venue
        find_day(payload, target)["venues"].append(item)
        additions.append({"date": target.isoformat(), **item})
        affected_dates.add(target)
        if sport in DAY_SPORTS:
            affected_meetings.add((sport, venue, target))

    # 月間表には日目表記が載らない場合があるため、追加後の連続開催から補完する。
    for sport, venue, target in sorted(affected_meetings, key=lambda value: (value[2], value[0], value[1])):
        relabel_meeting_days(payload, sport, venue, target)

    for target in affected_dates:
        day = find_day(payload, target)
        overlay_grades(day["venues"], grades, target)
        day["venues"] = normalize_entries(day["venues"])
    return additions


def sync_smart(
    *,
    payload: dict[str, list[dict[str, Any]]],
    original_text: str,
    monthly_path: Path,
    center: date,
    grades: list[dict[str, Any]],
    report_path: Path,
    state_path: Path,
) -> dict[str, Any]:
    refresh_start = center - timedelta(days=SMART_PREVIOUS_DAYS)
    refresh_end = center + timedelta(days=SMART_UPCOMING_DAYS)
    unresolved_start = center - timedelta(days=SMART_UNRESOLVED_DAYS)
    unresolved_end = refresh_start - timedelta(days=1)
    addition_start = refresh_end + timedelta(days=1)
    addition_end = end_of_month_after(center, SMART_NEW_ADDITION_MONTHS_AHEAD)

    before_payload = copy.deepcopy(payload)
    before_count = payload_count(payload)
    failures = load_sync_state(state_path)
    unresolved_before = len(failures)
    # 90日より前の失敗履歴は自動更新対象外なので整理する。
    failures = {
        key: item
        for key, item in failures.items()
        if unresolved_start <= date.fromisoformat(key[0]) <= center
    }

    session = OfficialSession()
    aggregate: dict[str, dict[str, Any]] = {}
    refreshed_dates: list[dict[str, Any]] = []
    retried_unresolved: list[dict[str, Any]] = []

    for target in daterange(refresh_start, refresh_end):
        results: list[SourceResult] = []
        for sport, collector in DAILY_COLLECTORS:
            result = safe_collect_daily(sport, collector, target, session)
            results.append(result)
            aggregate_result(aggregate, result)
            record_sync_result(failures, target, result)
        before, after = apply_day_update(payload, target, results, grades)
        refreshed_dates.append(
            {
                "date": target.isoformat(),
                "before_count": len(before),
                "after_count": len(after),
                "changed": before != after,
                "failed_sports": [result.sport for result in results if not result.ok],
            }
        )

    retry_keys = sorted(
        (
            (date.fromisoformat(target_date), sport)
            for target_date, sport in failures
            if unresolved_start <= date.fromisoformat(target_date) <= unresolved_end
        ),
        key=lambda item: (item[0], item[1]),
    )
    for target, sport in retry_keys:
        collector = COLLECTOR_BY_SPORT[sport]
        result = safe_collect_daily(sport, collector, target, session)
        aggregate_result(aggregate, result)
        record_sync_result(failures, target, result)
        before, after = apply_day_update(payload, target, [result], grades)
        retried_unresolved.append(
            {
                "date": target.isoformat(),
                "sport": sport,
                "ok": result.ok,
                "changed": before != after,
                "error": result.error,
            }
        )

    new_additions: list[dict[str, Any]] = []
    discovery_results: list[dict[str, Any]] = []
    if addition_start <= addition_end:
        for year, month in iter_months(addition_start, addition_end):
            for sport, collector in MONTH_COLLECTORS:
                result = safe_collect_month(sport, collector, year, month, session)
                aggregate_result(aggregate, result)
                additions = add_future_entries(payload, result, addition_start, addition_end, grades)
                new_additions.extend(additions)
                discovery_results.append(
                    {
                        "month": f"{year:04d}-{month:02d}",
                        "sport": sport,
                        "ok": result.ok,
                        "official_entry_count": len(result.entries),
                        "added_count": len(additions),
                        "error": result.error,
                    }
                )

    # 書き込み前に今回触れた月だけを検証する。ここで異常が見つかった場合は
    # monthly.jsへ一切書き込まないため、後続テストで初めて壊れたデータを
    # 検出する状態を防げる。
    touched_months = {
        target.strftime("%Y-%m")
        for target in daterange(refresh_start, refresh_end)
    }
    touched_months.update(item["date"][:7] for item in retried_unresolved if item.get("date"))
    touched_months.update(item["date"][:7] for item in new_additions if item.get("date"))
    for month in sorted(touched_months):
        validate_partial_month_rows(payload.get(month, []), month)

    write_monthly_data(monthly_path, payload, original_text)
    write_sync_state(state_path, failures)
    after_count = payload_count(payload)
    sources = finalize_source_summary(aggregate)
    report = {
        "generated_at": datetime.now(JST).isoformat(),
        "mode": "smart",
        "target_date": center.isoformat(),
        "refresh_window": {
            "start": refresh_start.isoformat(),
            "end": refresh_end.isoformat(),
            "policy": "前日＋当日から14日後",
        },
        "unresolved_window": {
            "start": unresolved_start.isoformat(),
            "end": unresolved_end.isoformat(),
            "policy": "過去90日以内の取得失敗を再確認",
        },
        "new_addition_window": {
            "start": addition_start.isoformat(),
            "end": addition_end.isoformat(),
            "policy": "翌月末までの公式月間表に新規開催があれば追加",
        },
        "before_count": before_count,
        "after_count": after_count,
        "changed": before_payload != payload,
        "refreshed_date_count": len(refreshed_dates),
        "refreshed_dates": refreshed_dates,
        "retried_unresolved_count": len(retried_unresolved),
        "retried_unresolved": retried_unresolved,
        "unresolved_before_count": unresolved_before,
        "unresolved_after_count": len(failures),
        "new_addition_count": len(new_additions),
        "new_additions": sorted(new_additions, key=lambda item: (str(item.get("date", "")), str(item.get("sport", "")), str(item.get("venue", "")))),
        "discovery_results": discovery_results,
        "sources": sources,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="公式サイトを確認し、開催日程をmonthly.jsへ反映します。")
    parser.add_argument("--date", help="基準日 YYYY-MM-DD。省略時は日本時間の当日")
    parser.add_argument("--month", help="検証済み公式月間表から全置換する対象月 YYYY-MM")
    parser.add_argument("--smart", action="store_true", help="毎日1時用の共通更新範囲で更新")
    parser.add_argument("--fail-if-all-sources-fail", action="store_true")
    parser.add_argument("--monthly-js", default="monthly/monthly.js")
    parser.add_argument("--graded-races", default="gradedraces/races.json")
    parser.add_argument("--verified-schedule", default="monthly/data/official_schedule.json")
    parser.add_argument("--report", default="monthly/monthly_update_report.json")
    parser.add_argument("--state", default="monthly/schedule_sync_state.json")
    args = parser.parse_args()
    if args.month and (args.date or args.smart):
        parser.error("--monthは--dateまたは--smartと同時に指定できません")

    root = Path.cwd()
    monthly_path = root / args.monthly_js
    grade_path = root / args.graded_races
    snapshot_path = root / args.verified_schedule
    report_path = root / args.report
    state_path = root / args.state
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
    if args.smart:
        report = sync_smart(
            payload=payload,
            original_text=original_text,
            monthly_path=monthly_path,
            center=target,
            grades=grades,
            report_path=report_path,
            state_path=state_path,
        )
        failed_sports = sum(1 for source in report["sources"] if source["success_count"] == 0)
        print(
            json.dumps(
                {
                    "target_date": target.isoformat(),
                    "changed": report["changed"],
                    "refresh_window": report["refresh_window"],
                    "new_addition_count": report["new_addition_count"],
                    "unresolved_after_count": report["unresolved_after_count"],
                    "sources_without_success": failed_sports,
                },
                ensure_ascii=False,
            )
        )
        if args.fail_if_all_sources_fail and failed_sports == len(DAILY_COLLECTORS):
            print("全開催日程ソースの取得に失敗しました。", file=sys.stderr)
            return 1
        return 0

    session = OfficialSession()
    results = [safe_collect_daily(sport, collector, target, session) for sport, collector in DAILY_COLLECTORS]
    before, after = apply_day_update(payload, target, results, grades)
    validate_partial_month_rows(payload.get(target.strftime("%Y-%m"), []), target.strftime("%Y-%m"))
    write_monthly_data(monthly_path, payload, original_text)
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
