from __future__ import annotations

import calendar
import copy
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

from monthly.scripts.common import SPORT_ORDER, VENUE_ORDER, normalize_grade, sort_entries

MONTH_RE = re.compile(r"^(?P<year>\d{4})-(?P<month>0[1-9]|1[0-2])$")
ALLOWED_SESSIONS = {"morning", "night", "midnight"}
DAY_SPORTS = {"keirin", "auto", "boat"}


def parse_month_key(value: str) -> tuple[int, int]:
    match = MONTH_RE.fullmatch(value)
    if not match:
        raise ValueError("対象月はYYYY-MM形式で指定してください。")
    return int(match.group("year")), int(match.group("month"))


def expected_dates(month: str) -> list[str]:
    year, month_number = parse_month_key(month)
    return [
        date(year, month_number, day).isoformat()
        for day in range(1, calendar.monthrange(year, month_number)[1] + 1)
    ]


def _normalized_item(raw: Any, *, row_date: str, index: int) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError(f"{row_date} venues[{index}]はオブジェクトである必要があります。")
    sport = str(raw.get("sport", ""))
    venue = str(raw.get("venue", ""))
    if sport not in SPORT_ORDER:
        raise ValueError(f"{row_date}: 未知の競技 {sport!r} です。")
    if venue not in VENUE_ORDER[sport]:
        raise ValueError(f"{row_date}: {sport}の未知の開催場 {venue!r} です。")

    item: dict[str, Any] = {"sport": sport, "venue": venue}
    grade = raw.get("grade")
    if grade not in (None, ""):
        item["grade"] = normalize_grade(sport, grade)
    session = raw.get("session")
    if session not in (None, ""):
        session = str(session)
        if session not in ALLOWED_SESSIONS:
            raise ValueError(f"{row_date}: {venue}の時間帯 {session!r} は未対応です。")
        item["session"] = session
    day_label = raw.get("day")
    if sport in DAY_SPORTS:
        if not isinstance(day_label, str) or not day_label.strip():
            raise ValueError(f"{row_date}: {venue}には日目表記が必要です。")
        item["day"] = day_label.strip()
    elif isinstance(day_label, str) and day_label.strip():
        item["day"] = day_label.strip()
    if raw.get("girls") is True:
        item["girls"] = True
    return item


def validate_month_rows(rows: Any, month: str) -> list[dict[str, Any]]:
    """月全体を検証し、正規化・並べ替え済みの深いコピーを返す。"""
    expected = expected_dates(month)
    if not isinstance(rows, list):
        raise ValueError(f"{month}のデータは配列である必要があります。")

    normalized_by_date: dict[str, dict[str, Any]] = {}
    for row_index, raw_row in enumerate(rows):
        if not isinstance(raw_row, dict):
            raise ValueError(f"{month} rows[{row_index}]はオブジェクトである必要があります。")
        row_date = str(raw_row.get("date", ""))
        if row_date not in expected:
            raise ValueError(f"{month}: 月外または不正な日付 {row_date!r} です。")
        if row_date in normalized_by_date:
            raise ValueError(f"{month}: {row_date}が重複しています。")
        raw_venues = raw_row.get("venues", [])
        if not isinstance(raw_venues, list):
            raise ValueError(f"{row_date}: venuesは配列である必要があります。")

        items: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()
        for item_index, raw_item in enumerate(raw_venues):
            item = _normalized_item(raw_item, row_date=row_date, index=item_index)
            key = (item["sport"], item["venue"])
            if key in seen:
                raise ValueError(f"{row_date}: {item['sport']} {item['venue']}が重複しています。")
            seen.add(key)
            items.append(item)
        normalized_by_date[row_date] = {"date": row_date, "venues": sort_entries(items)}

    missing = [value for value in expected if value not in normalized_by_date]
    if missing:
        raise ValueError(f"{month}: 日付が不足しています: {', '.join(missing)}")
    return [normalized_by_date[value] for value in expected]


def load_snapshot(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("months"), dict):
        raise ValueError("公式開催日程スナップショットの形式が不正です。")
    return payload


def load_verified_month(path: Path, month: str) -> list[dict[str, Any]]:
    payload = load_snapshot(path)
    if month not in payload["months"]:
        raise KeyError(f"{month}の検証済み公式開催日程は登録されていません。")
    return validate_month_rows(copy.deepcopy(payload["months"][month]), month)


def count_by_sport(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for row in rows:
        counts.update(str(item.get("sport", "")) for item in row.get("venues", []))
    return {sport: counts.get(sport, 0) for sport in SPORT_ORDER}
