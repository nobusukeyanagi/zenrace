from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from scripts.common import (
    RateLimitedSession,
    SourceResult,
    date_window,
    in_window,
    load_json,
    merge_patches,
    now_jst,
    parse_iso_date,
    save_json,
)
from scripts.sources import autorace, boatrace, jra, keirin, nar

LOGGER = logging.getLogger("update_races")
ADAPTERS = (jra, nar, boatrace, keirin, autorace)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="公営競技重賞情報を優先公式サイトから更新します。")
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--date", help="基準日 YYYY-MM-DD。省略時は日本時間の当日")
    parser.add_argument("--before", type=int, help="期間指定モードで、基準日の何日前まで更新するか")
    parser.add_argument("--after", type=int, help="期間指定モードで、基準日の何日後まで更新するか")
    parser.add_argument(
        "--smart",
        action="store_true",
        help="開催前レースと未解決レースを情報の状態に応じて選択する（通常更新向け）",
    )
    parser.add_argument("--dry-run", action="store_true", help="ファイルを書き換えず差分だけ作成")
    parser.add_argument("--fail-if-all-sources-fail", action="store_true", help="全競技の取得に失敗した場合は終了コード2")
    return parser.parse_args()


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def result_to_json(result: SourceResult) -> dict[str, Any]:
    return {
        "name": result.name,
        "ok": result.ok,
        "patch_count": len(result.patches),
        "fetched_urls": result.fetched_urls,
        "warnings": result.warnings,
        "error": result.error,
    }


def missing_past_fields(record: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not str(record.get("time", "")).strip():
        missing.append("time")
    if not str(record.get("winner", "")).strip():
        missing.append("winner")
    return missing


def select_smart_target_indices(
    records: list[dict[str, Any]],
    center: dt.date,
    *,
    upcoming_days: int,
    unresolved_retry_days: int,
    recent_verification_days: int,
) -> tuple[list[int], dict[int, list[str]]]:
    """日付幅ではなく、公開前・未解決・直近検証の状態で通常更新対象を選ぶ。"""
    reasons: dict[int, list[str]] = defaultdict(list)
    upcoming_end = center + dt.timedelta(days=upcoming_days)
    unresolved_start = center - dt.timedelta(days=unresolved_retry_days)
    verify_start = center - dt.timedelta(days=recent_verification_days)

    for index, record in enumerate(records):
        try:
            race_date = parse_iso_date(str(record.get("date", "")))
        except ValueError:
            continue

        # 開催前～当日は、番組公開後の発走時刻をできるだけ早く取る。
        if center <= race_date <= upcoming_end:
            reasons[index].append("upcoming")

        # 終了済みで空欄が残るレースは、固定の過去日数ではなく解決するまで再試行する。
        if unresolved_start <= race_date < center and missing_past_fields(record):
            reasons[index].append("unresolved")

        # 公式側の訂正や公開遅延を拾うため、直近だけは入力済みでも再確認する。
        if verify_start <= race_date < center:
            reasons[index].append("recent_verification")

    return sorted(reasons), dict(reasons)


def build_incomplete_report(
    records: list[dict[str, Any]],
    center: dt.date,
    *,
    upcoming_days: int,
    unresolved_retry_days: int,
) -> dict[str, Any]:
    past_start = center - dt.timedelta(days=unresolved_retry_days)
    upcoming_end = center + dt.timedelta(days=upcoming_days)
    past_unresolved: list[dict[str, Any]] = []
    upcoming_missing_time: list[dict[str, Any]] = []

    for record in records:
        try:
            race_date = parse_iso_date(str(record.get("date", "")))
        except ValueError:
            continue
        summary = {
            "date": record.get("date", ""),
            "sport": record.get("sport", ""),
            "venue": record.get("venue", ""),
            "grade": record.get("grade", ""),
            "name": record.get("name", ""),
        }
        if past_start <= race_date < center:
            missing = missing_past_fields(record)
            if missing:
                past_unresolved.append({**summary, "missing": missing})
        elif center <= race_date <= upcoming_end and not str(record.get("time", "")).strip():
            upcoming_missing_time.append({**summary, "missing": ["time"]})

    return {
        "generated_at": now_jst().isoformat(),
        "center_date": center.isoformat(),
        "past_unresolved_count": len(past_unresolved),
        "upcoming_missing_time_count": len(upcoming_missing_time),
        "past_unresolved": past_unresolved,
        "upcoming_missing_time": upcoming_missing_time,
    }


def main() -> int:
    configure_logging()
    args = parse_args()
    root = Path(__file__).resolve().parents[1]
    config_path = (root / args.config).resolve()
    config = load_json(config_path)

    center = dt.date.fromisoformat(args.date) if args.date else now_jst().date()
    data_path = root / str(config.get("data_file", "races.json"))
    changes_path = root / str(config.get("changes_file", "changes.json"))
    status_path = root / str(config.get("source_status_file", "source_status.json"))
    incomplete_path = root / str(config.get("incomplete_file", "incomplete_records.json"))

    all_records = load_json(data_path)
    if not isinstance(all_records, list):
        raise TypeError("races.json の最上位は配列である必要があります")

    # before/afterの明示時は監査用の期間指定を優先し、通常実行はスマート選択を既定にする。
    smart_mode = args.smart or (args.before is None and args.after is None)
    selection_reasons: dict[int, list[str]] = {}
    window: dict[str, str] | None = None

    if smart_mode:
        upcoming_days = int(config.get("upcoming_days", 14))
        unresolved_retry_days = int(config.get("unresolved_retry_days", 90))
        recent_verification_days = int(config.get("recent_verification_days", 1))
        target_indices, selection_reasons = select_smart_target_indices(
            all_records,
            center,
            upcoming_days=upcoming_days,
            unresolved_retry_days=unresolved_retry_days,
            recent_verification_days=recent_verification_days,
        )
        reason_counts = Counter(reason for values in selection_reasons.values() for reason in values)
        LOGGER.info(
            "スマート更新対象: %d件（開催前=%d、未解決=%d、直近再確認=%d）",
            len(target_indices),
            reason_counts.get("upcoming", 0),
            reason_counts.get("unresolved", 0),
            reason_counts.get("recent_verification", 0),
        )
    else:
        before = args.before if args.before is not None else int(config.get("days_before", 3))
        after = args.after if args.after is not None else int(config.get("days_after", 3))
        start, end = date_window(center, before, after)
        window = {"start": start.isoformat(), "end": end.isoformat()}
        target_indices = [index for index, record in enumerate(all_records) if in_window(record, start, end)]
        selection_reasons = {index: ["explicit_window"] for index in target_indices}
        LOGGER.info("期間指定更新対象: %s ～ %s、%d件", start, end, len(target_indices))

    target_records = [dict(all_records[index]) for index in target_indices]
    quality_center = center if smart_mode else now_jst().date()
    selection_summary = Counter(reason for values in selection_reasons.values() for reason in values)

    if not target_records:
        generated_at = now_jst().isoformat()
        report: dict[str, Any] = {
            "generated_at": generated_at,
            "center_date": center.isoformat(),
            "selection_mode": "smart" if smart_mode else "window",
            "target_count": 0,
            "change_count": 0,
            "changes": [],
        }
        if window:
            report["window"] = window
        save_json(changes_path, report)
        save_json(status_path, {"generated_at": generated_at, "sources": [], "note": "更新対象レースがありません"})
        save_json(
            incomplete_path,
            build_incomplete_report(
                all_records,
                quality_center,
                upcoming_days=int(config.get("upcoming_days", 14)),
                unresolved_retry_days=int(config.get("unresolved_retry_days", 90)),
            ),
        )
        LOGGER.info("更新対象レースがありません")
        return 0

    session = RateLimitedSession(
        timeout=int(config.get("request_timeout_seconds", 25)),
        interval=float(config.get("request_interval_seconds", 0.8)),
        user_agent=str(config.get("user_agent", "zenrace-gradedraces-updater/1.0")),
    )

    results: list[SourceResult] = []
    local_patches = []
    for adapter in ADAPTERS:
        result = adapter.collect(target_records, session, LOGGER)
        results.append(result)
        for patch in result.patches:
            # アダプターは対象配列のローカルインデックスを返す。
            if 0 <= patch.index < len(target_indices):
                patch.index = target_indices[patch.index]
                local_patches.append(patch)
        LOGGER.info("%s: ok=%s patches=%d warnings=%d", result.name, result.ok, len(result.patches), len(result.warnings))

    updated_records, changes = merge_patches(all_records, local_patches)
    report = {
        "generated_at": now_jst().isoformat(),
        "center_date": center.isoformat(),
        "selection_mode": "smart" if smart_mode else "window",
        "selection_counts": dict(selection_summary),
        "target_count": len(target_records),
        "change_count": len(changes),
        "changes": changes,
    }
    if window:
        report["window"] = window
    status = {
        "generated_at": now_jst().isoformat(),
        "selection_mode": "smart" if smart_mode else "window",
        "selection_counts": dict(selection_summary),
        "sources": [result_to_json(result) for result in results],
    }
    incomplete = build_incomplete_report(
        updated_records,
        quality_center,
        upcoming_days=int(config.get("upcoming_days", 14)),
        unresolved_retry_days=int(config.get("unresolved_retry_days", 90)),
    )

    save_json(changes_path, report)
    save_json(status_path, status)
    save_json(incomplete_path, incomplete)
    if not args.dry_run:
        save_json(data_path, updated_records)
    else:
        LOGGER.info("dry-runのため races.json は変更しません")

    for item in incomplete["past_unresolved"]:
        LOGGER.warning(
            "未解決: %s %s %s %s (%s)",
            item["date"],
            item["sport"],
            item["venue"],
            item["name"],
            ",".join(item["missing"]),
        )
        print(
            f"::warning::重賞情報未解決 {item['date']} {item['venue']} {item['name']} "
            f"({','.join(item['missing'])})",
            flush=True,
        )

    failed = [result for result in results if not result.ok]
    LOGGER.info(
        "変更件数: %d / 過去未解決: %d / 取得失敗: %d競技",
        len(changes),
        incomplete["past_unresolved_count"],
        len(failed),
    )
    if args.fail_if_all_sources_fail and results and all(not result.ok for result in results):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
