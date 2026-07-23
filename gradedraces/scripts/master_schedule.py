from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import hashlib
import json
import logging
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

from bs4 import BeautifulSoup, Tag

from scripts.common import (
    RateLimitedSession,
    clean_text,
    load_json,
    normalize,
    now_jst,
    parse_grade_and_name,
    save_json,
    same_name,
    sanitize_winner_name,
    sort_key,
    soup_from,
    strip_edition,
    table_rows,
)
from scripts.normalize_grades import normalize_grade
from scripts.sources import autorace, boatrace, jra, keirin, nar

LOGGER = logging.getLogger("master_schedule")

RANK_PATTERN = r"(?:III|II|IV|I|[ⅠⅡⅢⅣ]|[1-4])"
GRADE_RE = re.compile(
    rf"(?:J・G{RANK_PATTERN}|Jpn{RANK_PATTERN}|特?G{RANK_PATTERN}|SG|PG{RANK_PATTERN}|GP|"
    rf"BG{RANK_PATTERN}|SP{RANK_PATTERN}|S{RANK_PATTERN}|H{RANK_PATTERN}|M{RANK_PATTERN}|重賞{RANK_PATTERN}?)",
    re.I,
)
DATE_RE = re.compile(r"(?:(?P<year>20\d{2})年)?(?P<month>\d{1,2})[月/](?P<day>\d{1,2})日?")
BOAT_RANGE_RE = re.compile(
    r"(?P<start_month>\d{1,2})/(?P<start_day>\d{1,2})\s*[-～~]\s*"
    r"(?:(?P<end_month>\d{1,2})/)?(?P<end_day>\d{1,2})"
)
KEIRIN_RANGE_RE = re.compile(
    r"(?P<venue>[^()（）]+)[(（](?:(?P<start_month>\d{1,2})/)?(?P<start_day>\d{1,2})"
    r"[～~-](?:(?P<end_month>\d{1,2})/)?(?P<end_day>\d{1,2})[)）]"
)
PERSON_REJECT = re.compile(r"\d|億|万|円|開催|グレード|レース|カップ|杯|賞|記念|選手権|グランプリ")


@dataclasses.dataclass(slots=True)
class MasterRecord:
    date: str
    sport: str
    venue: str
    grade: str
    name: str
    winner: str = ""
    source_url: str = ""
    source_id: str = ""

    def as_race(self) -> dict[str, str]:
        return {
            "date": self.date,
            "time": "",
            "sport": self.sport,
            "venue": self.venue,
            "grade": normalize_master_grade(self.sport, self.grade),
            "name": strip_edition(self.name),
            "winner": sanitize_winner_name(self.winner),
        }


@dataclasses.dataclass(slots=True)
class FetchResult:
    name: str
    ok: bool
    records: list[MasterRecord]
    fetched_urls: list[str]
    warnings: list[str]
    page_hashes: dict[str, str]
    error: str = ""


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def normalize_master_grade(sport: str, value: str) -> str:
    grade = clean_text(value).replace(" ", "")
    upper = grade.upper()
    direct = {
        "SG": "SG",
        "GP": "GP",
        "PG1": "PGⅠ",
        "PGI": "PGⅠ",
    }
    if upper in direct:
        return direct[upper]

    match = re.fullmatch(r"(?P<prefix>J・G|JPN|特G|G|BG|SP|S|H|M|重賞)(?P<rank>III|II|IV|I|[ⅠⅡⅢⅣ]|[1-4])", upper)
    if match:
        prefix = match.group("prefix")
        rank = match.group("rank")
        rank_map = {
            "I": "Ⅰ", "II": "Ⅱ", "III": "Ⅲ", "IV": "Ⅳ",
            "1": "Ⅰ", "2": "Ⅱ", "3": "Ⅲ", "4": "Ⅳ",
            "Ⅰ": "Ⅰ", "Ⅱ": "Ⅱ", "Ⅲ": "Ⅲ", "Ⅳ": "Ⅳ",
        }
        prefix_map = {"JPN": "Jpn"}
        grade = prefix_map.get(prefix, prefix) + rank_map[rank]
    else:
        grade = grade
    return normalize_grade(sport, grade)


def page_hash(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def response_soup(session: RateLimitedSession, url: str, **kwargs: Any) -> tuple[BeautifulSoup, str, str]:
    response = session.get(url, **kwargs)
    return soup_from(response), response.url, page_hash(response.text)


def valid_person_name(value: str) -> bool:
    text = clean_text(value)
    if not 2 <= len(text) <= 24 or PERSON_REJECT.search(text):
        return False
    return bool(re.search(r"[一-龯ぁ-んァ-ヶ]", text))


def first_grade(values: Iterable[str]) -> str:
    for value in values:
        match = GRADE_RE.search(clean_text(value))
        if match:
            return match.group(0)
    return ""


def extract_tag_grade(tag: Tag) -> str:
    values = [tag.get_text(" ", strip=True)]
    for image in tag.select("img"):
        values.extend(
            str(image.get(attribute, ""))
            for attribute in ("alt", "title", "src", "class")
        )
    return first_grade(values)


def date_iso(year: int, month: int, day: int) -> str:
    try:
        return dt.date(year, month, day).isoformat()
    except ValueError:
        return ""


def dedupe_master(records: Iterable[MasterRecord]) -> list[MasterRecord]:
    chosen: dict[tuple[str, str, str, str], MasterRecord] = {}
    for record in records:
        if not record.date or not record.sport or not record.venue:
            continue
        key = (record.date, record.sport, normalize(record.venue), normalize(record.name))
        current = chosen.get(key)
        if current is None:
            chosen[key] = record
            continue
        # 同一レースが複数ページにある場合は、情報が多い方を採用する。
        if not current.grade and record.grade:
            current.grade = record.grade
        if not current.name and record.name:
            current.name = record.name
        if not current.winner and record.winner:
            current.winner = record.winner
        if not current.source_url and record.source_url:
            current.source_url = record.source_url
    return sorted(chosen.values(), key=lambda item: sort_key(item.as_race()))


# ---- JRA -----------------------------------------------------------------

def parse_jra_master(soup: BeautifulSoup, year: int, source_url: str) -> list[MasterRecord]:
    records: list[MasterRecord] = []
    for cells in table_rows(soup):
        if len(cells) < 3:
            continue
        match = re.search(r"(\d{1,2})月(\d{1,2})日", cells[0])
        if not match:
            continue
        race_date = date_iso(year, int(match.group(1)), int(match.group(2)))
        grade, name = parse_grade_and_name(cells[1])
        venue = clean_text(cells[2])
        if not race_date or not name or not venue:
            continue
        winner = clean_text(cells[5]) if len(cells) >= 6 else ""
        records.append(
            MasterRecord(race_date, "jra", venue, normalize_master_grade("jra", grade), name, winner, source_url, f"jra:{year}:{race_date}:{normalize(name)}")
        )
    return records


def collect_jra(session: RateLimitedSession, years: list[int]) -> FetchResult:
    records: list[MasterRecord] = []
    fetched: list[str] = []
    warnings: list[str] = []
    hashes: dict[str, str] = {}
    successful = 0
    for year in years:
        url = jra.LIST_URL.format(year=year)
        try:
            soup, final_url, digest = response_soup(session, url)
            parsed = parse_jra_master(soup, year, final_url)
            if not parsed:
                warnings.append(f"{year}年: 重賞一覧を解析できませんでした")
                continue
            records.extend(parsed)
            fetched.append(final_url)
            hashes[final_url] = digest
            successful += 1
        except Exception as exc:
            warnings.append(f"{year}年: 未公開または取得失敗 ({exc})")
    return FetchResult("JRA公式重賞一覧", successful > 0, records, fetched, warnings, hashes, "" if successful else "JRA日程を取得できませんでした")


# ---- 地方競馬 -------------------------------------------------------------

def _nar_page_year(soup: BeautifulSoup, fallback: int) -> int:
    text = clean_text(soup.get_text(" ", strip=True))
    match = re.search(r"重賞競走一覧[（(](20\d{2})年[）)]", text)
    if not match:
        match = re.search(r"(20\d{2})年.*?重賞", text)
    return int(match.group(1)) if match else fallback


def parse_nar_master(soup: BeautifulSoup, fallback_year: int, source_url: str) -> list[MasterRecord]:
    year = _nar_page_year(soup, fallback_year)
    records: list[MasterRecord] = []
    venue_names = sorted(nar.VENUE_CODES, key=len, reverse=True)
    for cells in table_rows(soup):
        date_index = -1
        race_date = ""
        for index, cell in enumerate(cells):
            match = DATE_RE.search(cell)
            if not match:
                continue
            value_year = int(match.group("year") or year)
            race_date = date_iso(value_year, int(match.group("month")), int(match.group("day")))
            date_index = index
            break
        if not race_date:
            continue
        venue_index = next(
            (index for index, cell in enumerate(cells) if clean_text(cell) in venue_names),
            -1,
        )
        if venue_index < 0:
            continue
        venue = clean_text(cells[venue_index])
        grade = first_grade(cells)
        name = ""
        candidate_cells = cells[date_index + 1 : venue_index] if venue_index > date_index else cells
        for candidate in candidate_cells:
            value = clean_text(candidate)
            if not value or GRADE_RE.fullmatch(value):
                continue
            if re.fullmatch(r"(?:祝|休)?[月火水木金土日]", value):
                continue
            if re.fullmatch(r"\d{3,4}m", value, re.I):
                continue
            if any(token in value for token in ("シリーズ", "交流", "牝馬", "3歳", "2歳")) and len(value) < 12:
                continue
            name = strip_edition(value)
            break
        if not name:
            # 日付・場・格・距離などを除いた最初の名称候補。
            for candidate in cells:
                value = clean_text(candidate)
                if not value or value == venue or DATE_RE.search(value) or GRADE_RE.fullmatch(value):
                    continue
                if re.fullmatch(r"(?:祝|休)?[月火水木金土日]|\d{3,4}m", value, re.I):
                    continue
                if len(value) >= 3:
                    name = strip_edition(value)
                    break
        if not name:
            continue
        records.append(
            MasterRecord(race_date, "nar", venue, normalize_master_grade("nar", grade), name, "", source_url, f"nar:{race_date}:{normalize(venue)}:{normalize(name)}")
        )
    return records


def collect_nar(session: RateLimitedSession, current_year: int) -> FetchResult:
    try:
        soup, final_url, digest = response_soup(session, nar.SCHEDULE_URL)
        records = parse_nar_master(soup, current_year, final_url)
        warnings = [] if records else ["重賞一覧からレース行を抽出できませんでした"]
        return FetchResult("地方競馬公式重賞一覧", bool(records), records, [final_url], warnings, {final_url: digest}, "" if records else "地方競馬日程を解析できませんでした")
    except Exception as exc:
        return FetchResult("地方競馬公式重賞一覧", False, [], [], [], {}, str(exc))


# ---- BOAT RACE ------------------------------------------------------------
BOAT_PG1_TITLES = {
    "BBCトーナメント",
    "スピードクイーンメモリアル",
    "マスターズチャンピオン",
    "レディースチャンピオン",
    "ヤングダービー",
    "クイーンズクライマックス",
}
BOAT_G2_TOKENS = (
    "モーターボート大賞",
    "レディースオールスター",
    "全国ボートレース甲子園",
    "ボートレースバトルチャンピオントーナメント",
)


def infer_boat_grade(group: str, row: Tag, title: str) -> str:
    grade = extract_tag_grade(row)
    if grade:
        return normalize_master_grade("boat", grade)
    if group == "SG":
        return "PGⅠ" if any(same_name(title, value) for value in BOAT_PG1_TITLES) else "SG"
    if group == "G1G2":
        return "GⅡ" if any(token in title for token in BOAT_G2_TOKENS) else "GⅠ"
    return "GⅢ"


def parse_boat_master(soup: BeautifulSoup, year: int, group: str, source_url: str) -> list[MasterRecord]:
    records: list[MasterRecord] = []
    for row in soup.select("tr"):
        cells = [clean_text(cell.get_text(" ", strip=True)) for cell in row.select("th,td")]
        if not cells:
            continue
        joined = " | ".join(cells)
        match = BOAT_RANGE_RE.search(joined)
        if not match:
            continue
        start_month = int(match.group("start_month"))
        end_month = int(match.group("end_month") or start_month)
        end_year = year + (1 if start_month == 12 and end_month == 1 else 0)
        race_date = date_iso(end_year, end_month, int(match.group("end_day")))
        venue_index = next((i for i, value in enumerate(cells) if value in boatrace.VENUE_CODES), -1)
        if venue_index < 0 or not race_date:
            continue
        venue = cells[venue_index]
        title = ""
        title_index = -1
        for candidate_index, candidate in enumerate(cells[venue_index + 1 :], start=venue_index + 1):
            value = clean_text(candidate)
            if not value or value in {"レース結果", "優勝者", "リンク"}:
                continue
            if re.search(r"\d{1,2}/\d{1,2}", value):
                continue
            if any(token in value for token in ("モーニング", "ナイター", "サマータイム", "ミッドナイト")) and len(value) < 12:
                continue
            title = strip_edition(parse_grade_and_name(value)[1])
            title_index = candidate_index
            if title:
                break
        if not title:
            # 開催場より前にタイトルが置かれるDOMにも対応。
            for candidate in reversed(cells[:venue_index]):
                value = clean_text(candidate)
                if not value or BOAT_RANGE_RE.search(value) or re.fullmatch(r"\d{1,2}月", value):
                    continue
                title = strip_edition(parse_grade_and_name(value)[1])
                if title:
                    break
        if not title:
            continue
        winner = ""
        winner_candidates = cells[title_index + 1 :] if title_index >= 0 else cells[venue_index + 1 :]
        for candidate in winner_candidates:
            if valid_person_name(candidate) and not same_name(candidate, title):
                winner = clean_text(candidate)
                break
        grade = infer_boat_grade(group, row, title)
        records.append(
            MasterRecord(race_date, "boat", venue, grade, title, winner, source_url, f"boat:{year}:{group}:{race_date}:{normalize(venue)}:{normalize(title)}")
        )
    return records


def collect_boat(session: RateLimitedSession, years: list[int]) -> FetchResult:
    records: list[MasterRecord] = []
    fetched: list[str] = []
    warnings: list[str] = []
    hashes: dict[str, str] = {}
    successful = 0
    for year in years:
        for group, base_url in boatrace.SCHEDULE_URLS.items():
            try:
                soup, final_url, digest = response_soup(session, base_url, params={"year": str(year)})
                parsed = parse_boat_master(soup, year, group, final_url)
                if not parsed:
                    warnings.append(f"{year}年 {group}: 日程を解析できませんでした")
                    continue
                records.extend(parsed)
                fetched.append(final_url)
                hashes[final_url] = digest
                successful += 1
            except Exception as exc:
                warnings.append(f"{year}年 {group}: 未公開または取得失敗 ({exc})")
    return FetchResult("BOAT RACE公式グレード日程", successful > 0, records, fetched, warnings, hashes, "" if successful else "BOAT RACE日程を取得できませんでした")


# ---- KEIRIN ---------------------------------------------------------------

def fiscal_calendar_year(fiscal_year: int, month: int) -> int:
    return fiscal_year if month >= 4 else fiscal_year + 1


def _keirin_title(cells: list[Tag], venue_index: int, previous_venue_index: int) -> str:
    for cell in reversed(cells[previous_venue_index + 1 : venue_index]):
        value = clean_text(cell.get_text(" ", strip=True))
        if not value or re.fullmatch(r"\d{1,2}月", value):
            continue
        if GRADE_RE.fullmatch(value) or re.search(r"億|万|円", value):
            continue
        if KEIRIN_RANGE_RE.search(value):
            continue
        if valid_person_name(value) and len(value) <= 8:
            continue
        return strip_edition(value)
    return ""


def parse_keirin_master(soup: BeautifulSoup, fiscal_year: int, source_url: str) -> list[MasterRecord]:
    records: list[MasterRecord] = []
    current_month: int | None = None
    for row in soup.select("tr"):
        cells = list(row.select("th,td"))
        if not cells:
            continue
        for cell in cells:
            month_match = re.fullmatch(r"(\d{1,2})月", clean_text(cell.get_text(" ", strip=True)))
            if month_match:
                current_month = int(month_match.group(1))
        venue_positions: list[tuple[int, re.Match[str]]] = []
        for index, cell in enumerate(cells):
            match = KEIRIN_RANGE_RE.search(clean_text(cell.get_text(" ", strip=True)))
            if match and clean_text(match.group("venue")) in keirin.VENUE_CODES:
                venue_positions.append((index, match))
        previous_venue_index = -1
        for position_index, (venue_index, match) in enumerate(venue_positions):
            start_month = int(match.group("start_month") or current_month or 0)
            end_month = int(match.group("end_month") or start_month)
            if not end_month:
                continue
            end_year = fiscal_calendar_year(fiscal_year, end_month)
            race_date = date_iso(end_year, end_month, int(match.group("end_day")))
            venue = clean_text(match.group("venue"))
            title = _keirin_title(cells, venue_index, previous_venue_index)
            segment_start = previous_venue_index + 1
            segment_end = venue_positions[position_index + 1][0] if position_index + 1 < len(venue_positions) else len(cells)
            grade = first_grade(extract_tag_grade(cell) for cell in cells[segment_start : venue_index + 1]) or "GⅢ"
            winner = ""
            for cell in cells[venue_index + 1 : segment_end]:
                value = clean_text(cell.get_text(" ", strip=True))
                if valid_person_name(value):
                    winner = value
                    break
            if race_date and venue:
                records.append(
                    MasterRecord(race_date, "keirin", venue, normalize_master_grade("keirin", grade), title, winner, source_url, f"keirin:{fiscal_year}:{race_date}:{normalize(venue)}:{normalize(title)}")
                )
                # 高松宮記念杯とパールカップは同一開催内で決勝日が異なる。
                if "高松宮記念杯" in title and "パールカップ" in title:
                    start_year = fiscal_calendar_year(fiscal_year, start_month)
                    try:
                        pearl_date = (dt.date(start_year, start_month, int(match.group("start_day"))) + dt.timedelta(days=2)).isoformat()
                    except ValueError:
                        pearl_date = ""
                    if pearl_date:
                        records[-1].name = "高松宮記念杯競輪"
                        records.append(
                            MasterRecord(pearl_date, "keirin", venue, normalize_master_grade("keirin", grade), "パールカップ", "", source_url, f"keirin:{fiscal_year}:{pearl_date}:{normalize(venue)}:pearl")
                        )
            previous_venue_index = venue_index
    return records


def collect_keirin(session: RateLimitedSession, fiscal_years: list[int]) -> FetchResult:
    records: list[MasterRecord] = []
    fetched: list[str] = []
    warnings: list[str] = []
    hashes: dict[str, str] = {}
    successful = 0
    for year in fiscal_years:
        try:
            soup, final_url, digest = response_soup(session, keirin.SCHEDULE_URL, params={"scyy": str(year)})
            parsed = parse_keirin_master(soup, year, final_url)
            if not parsed:
                warnings.append(f"{year}年度: 日程を解析できませんでした")
                continue
            records.extend(parsed)
            fetched.append(final_url)
            hashes[final_url] = digest
            successful += 1
        except Exception as exc:
            warnings.append(f"{year}年度: 未公開または取得失敗 ({exc})")
    return FetchResult("KEIRIN.JP公式グレード日程", successful > 0, records, fetched, warnings, hashes, "" if successful else "競輪日程を取得できませんでした")


# ---- AutoRace -------------------------------------------------------------

def parse_autorace_master(soup: BeautifulSoup, source_url: str) -> list[MasterRecord]:
    records: list[MasterRecord] = []
    for row in soup.select("tr"):
        cells = [clean_text(cell.get_text(" ", strip=True)) for cell in row.select("th,td")]
        if not cells:
            continue
        joined = " | ".join(cells)
        end_date = autorace._parse_end_date(joined)  # 公式ページの既存解析関数を共有
        if not end_date:
            continue
        venue_index = next((i for i, value in enumerate(cells) if value in autorace.VENUE_SLUGS), -1)
        if venue_index < 0:
            continue
        venue = cells[venue_index]
        grade = extract_tag_grade(row) or first_grade(cells)
        title = ""
        for candidate in cells[:venue_index]:
            value = clean_text(candidate)
            if not value or GRADE_RE.fullmatch(value) or DATE_RE.search(value):
                continue
            if "～" in value or "~" in value:
                continue
            title = strip_edition(value)
            break
        winner = ""
        for candidate in cells[venue_index + 1 :]:
            if valid_person_name(candidate):
                winner = clean_text(candidate)
                break
        if title:
            records.append(
                MasterRecord(end_date, "auto", venue, normalize_master_grade("auto", grade), title, winner, source_url, f"auto:{end_date}:{normalize(venue)}:{normalize(title)}")
            )
    return records


def collect_autorace(session: RateLimitedSession, fiscal_years: list[int], current_fiscal: int) -> FetchResult:
    records: list[MasterRecord] = []
    fetched: list[str] = []
    warnings: list[str] = []
    hashes: dict[str, str] = {}
    successful = 0
    for year in fiscal_years:
        url = autorace.GRADE_URL if year == current_fiscal else f"https://autorace.jp/calendar/graderace/{year}.php"
        try:
            soup, final_url, digest = response_soup(session, url)
            parsed = parse_autorace_master(soup, final_url)
            if not parsed:
                warnings.append(f"{year}年度: 日程を解析できませんでした")
                continue
            records.extend(parsed)
            fetched.append(final_url)
            hashes[final_url] = digest
            successful += 1
        except Exception as exc:
            warnings.append(f"{year}年度: 未公開または取得失敗 ({exc})")
    return FetchResult("AutoRace.JP公式年間日程", successful > 0, records, fetched, warnings, hashes, "" if successful else "オートレース日程を取得できませんでした")


# ---- 照合 -----------------------------------------------------------------

def race_signature(record: dict[str, Any] | MasterRecord) -> tuple[str, str, str, str]:
    if isinstance(record, MasterRecord):
        return record.date, record.sport, normalize(record.venue), normalize(record.name)
    return (
        str(record.get("date", "")),
        str(record.get("sport", "")),
        normalize(record.get("venue", "")),
        normalize(record.get("name", "")),
    )


def find_match(records: list[dict[str, Any]], official: MasterRecord) -> tuple[int | None, str]:
    exact = [i for i, item in enumerate(records) if race_signature(item) == race_signature(official)]
    if len(exact) == 1:
        return exact[0], "exact"

    date_venue = [
        i for i, item in enumerate(records)
        if item.get("sport") == official.sport
        and item.get("date") == official.date
        and normalize(item.get("venue")) == normalize(official.venue)
    ]
    if len(date_venue) == 1:
        return date_venue[0], "date_venue"

    if not official.name:
        return None, ""

    same_event: list[tuple[int, int]] = []
    try:
        official_date = dt.date.fromisoformat(official.date)
    except ValueError:
        official_date = None
    for index, item in enumerate(records):
        if item.get("sport") != official.sport:
            continue
        if not same_name(str(item.get("name", "")), official.name):
            continue
        venue_equal = normalize(item.get("venue")) == normalize(official.venue)
        try:
            item_date = dt.date.fromisoformat(str(item.get("date", "")))
        except ValueError:
            continue
        distance = abs((item_date - official_date).days) if official_date else 999
        if venue_equal and distance <= 45:
            same_event.append((distance, index))
        elif item.get("date") == official.date and distance == 0:
            same_event.append((10, index))
    if same_event:
        same_event.sort()
        if len(same_event) == 1 or same_event[0][0] < same_event[1][0]:
            return same_event[0][1], "same_event"
    return None, ""


def reconcile(
    original: list[dict[str, Any]],
    official_records: list[MasterRecord],
    today: dt.date,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    records = [dict(item) for item in original]
    changes: list[dict[str, Any]] = []
    additions: list[dict[str, Any]] = []

    for official in official_records:
        index, match_type = find_match(records, official)
        incoming = official.as_race()
        if index is None:
            records.append(incoming)
            additions.append({**incoming, "source_url": official.source_url, "source_id": official.source_id})
            continue

        current = records[index]
        before = dict(current)
        date_or_venue_changed = current.get("date") != official.date or normalize(current.get("venue")) != normalize(official.venue)
        current["date"] = official.date
        current["venue"] = official.venue
        if official.grade:
            current["grade"] = normalize_master_grade(official.sport, official.grade)
        if official.name:
            current["name"] = strip_edition(official.name)
        if official.winner:
            current["winner"] = clean_text(official.winner)
        if date_or_venue_changed:
            try:
                event_date = dt.date.fromisoformat(official.date)
            except ValueError:
                event_date = today
            if event_date >= today:
                current["time"] = ""
                if not official.winner:
                    current["winner"] = ""
        if current != before:
            changes.append(
                {
                    "type": "master_updated",
                    "match_type": match_type,
                    "before": before,
                    "after": dict(current),
                    "source_url": official.source_url,
                    "source_id": official.source_id,
                }
            )

    records.sort(key=sort_key)
    return records, changes, additions


def duplicate_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str, str, str], list[int]] = defaultdict(list)
    for index, record in enumerate(records):
        groups[race_signature(record)].append(index)
    result = []
    for signature, indices in groups.items():
        if len(indices) <= 1:
            continue
        result.append({"signature": list(signature), "count": len(indices), "indices": indices})
    return result


def registered_only_records(
    records: list[dict[str, Any]],
    official: list[MasterRecord],
) -> list[dict[str, Any]]:
    coverage: dict[str, tuple[str, str]] = {}
    by_sport: dict[str, list[str]] = defaultdict(list)
    for item in official:
        by_sport[item.sport].append(item.date)
    for sport, dates in by_sport.items():
        coverage[sport] = (min(dates), max(dates))

    missing: list[dict[str, Any]] = []
    for record in records:
        sport = str(record.get("sport", ""))
        if sport not in coverage:
            continue
        start, end = coverage[sport]
        if not start <= str(record.get("date", "")) <= end:
            continue
        matched = any(
            item.sport == sport
            and item.date == str(record.get("date", ""))
            and normalize(item.venue) == normalize(record.get("venue"))
            and (
                not item.name
                or not str(record.get("name", "")).strip()
                or same_name(str(record.get("name", "")), item.name)
            )
            for item in official
        )
        if matched:
            continue
        missing.append(
            {
                "date": record.get("date", ""),
                "sport": sport,
                "venue": record.get("venue", ""),
                "grade": record.get("grade", ""),
                "name": record.get("name", ""),
            }
        )
    return missing


def update_state(path: Path, fetch_results: list[FetchResult]) -> dict[str, Any]:
    previous = load_json(path) if path.exists() else {"pages": {}}
    previous_pages = previous.get("pages", {}) if isinstance(previous, dict) else {}
    checked_at = now_jst().isoformat()
    pages: dict[str, Any] = dict(previous_pages)
    for result in fetch_results:
        for url, digest in result.page_hashes.items():
            old = previous_pages.get(url, {}) if isinstance(previous_pages, dict) else {}
            changed = old.get("content_hash") != digest
            if changed:
                pages[url] = {
                    "source": result.name,
                    "content_hash": digest,
                    "last_changed_at": checked_at,
                }
            elif url not in pages:
                pages[url] = {
                    "source": result.name,
                    "content_hash": digest,
                    "last_changed_at": checked_at,
                }
    return {"pages": pages}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="公式年間・月間日程を全件照合し、重賞マスターを同期します。")
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--date", help="基準日 YYYY-MM-DD。省略時は日本時間の当日")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--fail-if-all-sources-fail", action="store_true")
    return parser.parse_args()


def main() -> int:
    configure_logging()
    args = parse_args()
    root = Path(__file__).resolve().parents[1]
    config = load_json((root / args.config).resolve())
    today = dt.date.fromisoformat(args.date) if args.date else now_jst().date()
    years_ahead = int(config.get("master_schedule_years_ahead", 1))
    calendar_years = list(range(today.year, today.year + years_ahead + 1))
    current_fiscal = today.year if today.month >= 4 else today.year - 1
    fiscal_years = list(range(current_fiscal, current_fiscal + years_ahead + 1))

    session = RateLimitedSession(
        timeout=int(config.get("request_timeout_seconds", 25)),
        interval=float(config.get("request_interval_seconds", 0.8)),
        user_agent=str(config.get("user_agent", "zenrace-gradedraces-updater/1.0")),
    )

    fetch_results = [
        collect_jra(session, calendar_years),
        collect_nar(session, today.year),
        collect_boat(session, calendar_years),
        collect_keirin(session, fiscal_years),
        collect_autorace(session, fiscal_years, current_fiscal),
    ]
    official = dedupe_master(item for result in fetch_results for item in result.records)

    data_path = root / str(config.get("data_file", "races.json"))
    report_path = root / str(config.get("master_schedule_report_file", "master_schedule_report.json"))
    state_path = root / str(config.get("schedule_sync_state_file", "schedule_sync_state.json"))
    original = load_json(data_path)
    if not isinstance(original, list):
        raise TypeError("races.jsonの最上位は配列である必要があります")

    updated, changes, additions = reconcile(original, official, today)
    registered_only = registered_only_records(updated, official)
    duplicates = duplicate_records(updated)
    source_summary = [
        {
            "name": result.name,
            "ok": result.ok,
            "record_count": len(result.records),
            "fetched_urls": result.fetched_urls,
            "warnings": result.warnings,
            "error": result.error,
        }
        for result in fetch_results
    ]
    report = {
        "generated_at": now_jst().isoformat(),
        "base_date": today.isoformat(),
        "calendar_years": calendar_years,
        "fiscal_years": fiscal_years,
        "official_record_count": len(official),
        "added_count": len(additions),
        "updated_count": len(changes),
        "registered_only_count": len(registered_only),
        "duplicate_count": len(duplicates),
        "additions": additions,
        "changes": changes,
        "registered_only": registered_only,
        "duplicates": duplicates,
        "sources": source_summary,
        "note": "公式日程に見つからない登録済みレースは自動削除せず、要確認として記録します。",
    }
    save_json(report_path, report)
    save_json(state_path, update_state(state_path, fetch_results))
    if not args.dry_run:
        save_json(data_path, updated)

    LOGGER.info(
        "公式日程=%d件 追加=%d件 更新=%d件 要確認=%d件 重複=%d件",
        len(official), len(additions), len(changes), len(registered_only), len(duplicates),
    )
    for item in registered_only[:20]:
        print(f"::warning::公式日程との照合要確認 {item['date']} {item['venue']} {item['name']}", flush=True)
    if len(registered_only) > 20:
        print(f"::warning::照合要確認は他に{len(registered_only) - 20}件あります", flush=True)

    if args.fail_if_all_sources_fail and all(not result.ok for result in fetch_results):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
