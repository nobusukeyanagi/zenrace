from __future__ import annotations

import datetime as dt
import logging
import re
from typing import Any

from bs4 import BeautifulSoup

from scripts.common import (
    Patch,
    RateLimitedSession,
    choose_first_place_name,
    SourceResult,
    clean_text,
    normalize,
    now_jst,
    same_name,
    sanitize_winner_name,
    soup_from,
    strip_edition,
    table_rows,
)

NAME = "競輪"
SCHEDULE_URL = "https://keirin.jp/pc/graderaceschedule"
# KEIRIN.JPの一般レース一覧は画面遷移・セッション依存のため、当日結果と発走時刻を公開ページで補完する。
SUPPLEMENTAL_RACE_URL = "https://www.oddspark.com/keirin/RaceList.do"
SUPPLEMENTAL_RESULT_URL = "https://www.oddspark.com/keirin/RaceKekka.do"

VENUE_CODES = {
    "函館":"11","青森":"12","いわき平":"13","弥彦":"21","前橋":"22","取手":"23","宇都宮":"24",
    "大宮":"25","西武園":"26","京王閣":"27","立川":"28","松戸":"31","千葉":"32","川崎":"34",
    "平塚":"35","小田原":"36","伊東":"37","静岡":"38","名古屋":"42","岐阜":"43","大垣":"44",
    "豊橋":"45","富山":"46","松阪":"47","四日市":"48","福井":"51","奈良":"53","向日町":"54",
    "和歌山":"55","岸和田":"56","玉野":"61","広島":"62","防府":"63","高松":"71","小松島":"73",
    "高知":"74","松山":"75","小倉":"81","久留米":"83","武雄":"84","佐世保":"85","別府":"86","熊本":"87",
}

VENUE_RANGE_RE = re.compile(
    r"(?P<venue>[^()（）]+)[(（](?:(?P<start_month>\d{1,2})/)?(?P<start_day>\d{1,2})"
    r"[～~-](?:(?P<end_month>\d{1,2})/)?(?P<end_day>\d{1,2})[)）]"
)
SALES_RE = re.compile(r"^[\d,]+億|^[\d,]+万|円$")


def _looks_like_person_name(value: str) -> bool:
    text = sanitize_winner_name(value)
    if not 2 <= len(text) <= 20 or re.search(r"\d", text):
        return False
    if SALES_RE.search(text):
        return False
    if any(token in text for token in ("優勝者", "開催", "競輪", "カップ", "杯", "賞", "フェスティバル", "グランプリ")):
        return False
    return bool(re.search(r"[一-龯ぁ-んァ-ヶ]", text))


def _title_from_cells(cells: list[str], venue_index: int) -> str:
    for cell in reversed(cells[:venue_index]):
        value = clean_text(cell)
        if not value or re.fullmatch(r"\d{1,2}月", value):
            continue
        if re.fullmatch(r"G[PⅠⅡⅢIV123]+|GP|GI|GII|GIII", normalize(value), re.I):
            continue
        return strip_edition(value)
    return ""


def parse_schedule_entries(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """KEIRIN.JP公式グレード日程の各行を、名称・場・最終日・優勝者へ分解する。"""
    entries: list[dict[str, Any]] = []
    for cells in table_rows(soup):
        venue_index = -1
        venue_match: re.Match[str] | None = None
        for index, cell in enumerate(cells):
            match = VENUE_RANGE_RE.search(clean_text(cell))
            if match and clean_text(match.group("venue")) in VENUE_CODES:
                venue_index = index
                venue_match = match
                break
        if venue_index < 0 or venue_match is None:
            continue

        title = _title_from_cells(cells, venue_index)
        winner = ""
        for cell in reversed(cells[venue_index + 1 :]):
            if _looks_like_person_name(cell):
                winner = sanitize_winner_name(cell)
                break
        entries.append(
            {
                "title": title,
                "venue": clean_text(venue_match.group("venue")),
                "end_month": int(venue_match.group("end_month")) if venue_match.group("end_month") else None,
                "end_day": int(venue_match.group("end_day")),
                "winner": winner,
                "cells": cells,
            }
        )
    return entries


def schedule_patches(records: list[dict[str, Any]], soup: BeautifulSoup, source_url: str) -> list[Patch]:
    patches: list[Patch] = []
    entries = parse_schedule_entries(soup)
    for index, record in enumerate(records):
        if record.get("sport") != "keirin":
            continue
        date_text = str(record.get("date", ""))
        try:
            month = int(date_text[5:7])
            day = int(date_text[8:10])
        except (ValueError, IndexError):
            continue
        for entry in entries:
            if normalize(entry["venue"]) != normalize(record.get("venue")):
                continue
            if entry["end_day"] != day:
                continue
            if entry["end_month"] is not None and entry["end_month"] != month:
                continue
            if entry["title"] and not same_name(str(record.get("name", "")), entry["title"]):
                continue
            if entry["winner"]:
                patches.append(
                    Patch(index, {"winner": entry["winner"]}, NAME, source_url, "KEIRIN.JP公式グレード日程の優勝者")
                )
            break
    return patches


def extract_supplemental_start_time(soup: BeautifulSoup) -> str:
    text = clean_text(soup.get_text(" ", strip=True))
    match = re.search(r"発走時間\s*([0-2]?\d:[0-5]\d)", text)
    if not match:
        return ""
    hour, minute = match.group(1).split(":")
    return f"{int(hour):02d}:{minute}"


def extract_supplemental_result_fields(soup: BeautifulSoup) -> dict[str, str]:
    fields: dict[str, str] = {}
    time_value = extract_supplemental_start_time(soup)
    if time_value:
        fields["time"] = time_value
    winner = choose_first_place_name(table_rows(soup))
    if winner:
        fields["winner"] = winner
    return fields


def _supplemental_result(record: dict[str, Any], session: RateLimitedSession) -> tuple[dict[str, str], str, int | None]:
    code = VENUE_CODES.get(str(record.get("venue", "")))
    if not code:
        return {}, "", None
    for race_no in range(12, 8, -1):
        response = session.get(
            SUPPLEMENTAL_RESULT_URL,
            params={
                "joCode": code,
                "kaisaiBi": str(record["date"]).replace("-", ""),
                "raceNo": str(race_no),
            },
        )
        soup = soup_from(response)
        text = clean_text(soup.get_text(" ", strip=True))
        if str(record.get("venue", "")) not in text or "競輪" not in text:
            continue
        fields = extract_supplemental_result_fields(soup)
        if fields.get("winner"):
            return fields, response.url, race_no
    return {}, "", None


def _supplemental_time(record: dict[str, Any], session: RateLimitedSession) -> tuple[str, str, int | None]:
    code = VENUE_CODES.get(str(record.get("venue", "")))
    if not code:
        return "", "", None
    for race_no in range(12, 8, -1):
        response = session.get(
            SUPPLEMENTAL_RACE_URL,
            params={
                "joCode": code,
                "kaisaiBi": str(record["date"]).replace("-", ""),
                "raceNo": str(race_no),
            },
        )
        soup = soup_from(response)
        text = clean_text(soup.get_text(" ", strip=True))
        # 別日・案内ページを誤採用しない。
        if str(record.get("venue", "")) not in text or "競輪" not in text:
            continue
        time_value = extract_supplemental_start_time(soup)
        if time_value:
            return time_value, response.url, race_no
    return "", "", None


def collect(records: list[dict[str, Any]], session: RateLimitedSession, logger: logging.Logger) -> SourceResult:
    targets = [(index, record) for index, record in enumerate(records) if record.get("sport") == "keirin"]
    if not targets:
        return SourceResult(NAME, True, [], [], [])
    patches: list[Patch] = []
    fetched: list[str] = []
    warnings: list[str] = []
    try:
        schedule = session.get(SCHEDULE_URL)
        fetched.append(schedule.url)
        schedule_soup = soup_from(schedule)
        schedule_text = schedule_soup.get_text(" ", strip=True)
        if "グレード" not in schedule_text or len(schedule_text) < 500:
            raise RuntimeError("競輪グレード日程の内容を確認できません")
        patches.extend(schedule_patches(records, schedule_soup, schedule.url))

        today = now_jst().date()
        for index, record in targets:
            supplemental_fields: dict[str, str] = {}
            try:
                race_date = dt.date.fromisoformat(str(record.get("date", "")))
            except ValueError:
                race_date = today

            # 当日終了後は公開結果を同日中に取得し、翌日の公式年間日程更新を待たずに補完する。
            if race_date <= today and (not str(record.get("winner", "")).strip() or not str(record.get("time", "")).strip()):
                try:
                    supplemental_fields, result_url, result_race_no = _supplemental_result(record, session)
                    if result_url:
                        fetched.append(result_url)
                    if supplemental_fields:
                        patches.append(
                            Patch(
                                index,
                                supplemental_fields,
                                NAME,
                                result_url,
                                f"公開結果によるKEIRIN.JP補完（{result_race_no}R）",
                            )
                        )
                except Exception as exc:
                    warnings.append(f"{record['date']} {record.get('venue','')}: 公開結果取得を見送り ({exc})")

            # 結果ページでも時刻が取れず、既存時刻もない場合だけ公開出走表を参照する。
            if str(record.get("time", "")).strip() or supplemental_fields.get("time"):
                continue
            try:
                time_value, url, race_no = _supplemental_time(record, session)
                if url:
                    fetched.append(url)
                if time_value:
                    patches.append(
                        Patch(
                            index,
                            {"time": time_value},
                            NAME,
                            url,
                            f"公開出走表によるKEIRIN.JP補完（{race_no}R発走時間）",
                        )
                    )
                else:
                    warnings.append(f"{record['date']} {record.get('venue','')}: 発走時刻を特定できませんでした")
            except Exception as exc:
                warnings.append(f"{record['date']} {record.get('venue','')}: 発走時刻取得を見送り ({exc})")
        return SourceResult(NAME, True, patches, list(dict.fromkeys(fetched)), warnings)
    except Exception as exc:
        logger.exception("競輪の取得に失敗しました")
        return SourceResult(NAME, False, patches, fetched, warnings, str(exc))
