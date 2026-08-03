from __future__ import annotations

import calendar
import re
from datetime import date
from typing import Any

from bs4 import BeautifulSoup

from monthly.scripts.common import OfficialSession, SourceResult, clean_text

SPORT = "nar"
URL = "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceList"
MONTHLY_URL = "https://www.keiba.go.jp/KeibaWeb/MonthlyConveneInfo/MonthlyConveneInfoTop"
VENUE_CODES = {
    "帯広": "03", "門別": "36", "盛岡": "10", "水沢": "11", "浦和": "18", "船橋": "19", "大井": "20",
    "川崎": "21", "金沢": "22", "笠松": "23", "名古屋": "24", "園田": "27", "姫路": "28", "高知": "31", "佐賀": "32",
}
DISPLAY_TO_VENUE = {**{venue: venue for venue in VENUE_CODES}, "帯広ば": "帯広"}
TIME_RE = re.compile(r"\b(?:1[0-9]|2[0-3]|[0-9]):[0-5][0-9]\b")
EVENT_MARKS = ("●", "☆", "Ｄ", "D", "△")


def _table_rows(soup: BeautifulSoup) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for tr in soup.find_all("tr"):
        cells = tr.find_all(["th", "td"], recursive=False)
        if cells:
            rows.append(cells)
    return rows


def _collect_month_uncached(year: int, month: int, session: OfficialSession) -> SourceResult:
    try:
        response = session.get(MONTHLY_URL, params={"k_year": str(year), "k_month": str(month)})
    except Exception as exc:
        return SourceResult(SPORT, False, fetched_urls=[MONTHLY_URL], error=str(exc))
    soup = BeautifulSoup(response.text, "lxml")
    text = clean_text(soup.get_text(" ", strip=True))
    expected = f"{year}年{month}月分"
    if expected not in text or "月別開催日程" not in text:
        return SourceResult(SPORT, False, fetched_urls=[response.url], error="地方競馬の月別開催日程を確認できませんでした")

    entries: list[dict[str, Any]] = []
    last_day = calendar.monthrange(year, month)[1]
    for cells in _table_rows(soup):
        labels = [clean_text(cell.get_text(" ", strip=True)) for cell in cells]
        venue = next((DISPLAY_TO_VENUE[label] for label in labels if label in DISPLAY_TO_VENUE), "")
        if not venue:
            continue
        venue_index = next(index for index, label in enumerate(labels) if label in DISPLAY_TO_VENUE)
        day_cells = cells[venue_index + 1 : venue_index + 1 + last_day]
        for day_number, cell in enumerate(day_cells, start=1):
            marker = clean_text(cell.get_text(" ", strip=True))
            alt_text = " ".join(clean_text(img.get("alt", "")) for img in cell.find_all("img"))
            combined = clean_text(f"{marker} {alt_text}")
            if not combined or not (cell.find("a") or any(mark in combined for mark in EVENT_MARKS)):
                continue
            item: dict[str, Any] = {
                "date": date(year, month, day_number).isoformat(),
                "sport": SPORT,
                "venue": venue,
            }
            if "☆" in combined or "ナイター" in combined:
                item["session"] = "night"
            entries.append(item)

    entries.sort(key=lambda item: (str(item.get("date", "")), str(item.get("venue", ""))))
    return SourceResult(SPORT, True, entries=entries, fetched_urls=[response.url])


def collect_month(year: int, month: int, session: OfficialSession) -> SourceResult:
    cache_key = (SPORT, year, month)
    cache = getattr(session, "source_cache", None)
    if cache is None:
        cache = {}
        try:
            setattr(session, "source_cache", cache)
        except Exception:
            pass
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    result = _collect_month_uncached(year, month, session)
    cache[cache_key] = result
    return result

def collect(target: date, session: OfficialSession) -> SourceResult:
    monthly = collect_month(target.year, target.month, session)
    scheduled_venues = {
        str(item.get("venue", ""))
        for item in monthly.entries
        if item.get("date") == target.isoformat()
    } if monthly.ok else set(VENUE_CODES)

    entries: list[dict[str, Any]] = []
    fetched: list[str] = list(monthly.fetched_urls)
    warnings: list[str] = list(monthly.warnings)
    successful_requests = 0
    expected_date = f"{target.year}年{target.month}月{target.day}日"

    for venue in VENUE_CODES:
        if venue not in scheduled_venues:
            continue
        code = VENUE_CODES[venue]
        try:
            response = session.get(URL, params={"k_raceDate": target.strftime("%Y/%m/%d"), "k_babaCode": code})
            fetched.append(response.url)
            soup = BeautifulSoup(response.text, "lxml")
            text = clean_text(soup.get_text(" ", strip=True))
            successful_requests += 1
            venue_tokens = {venue, "帯広ば" if venue == "帯広" else venue}
            if expected_date not in text or not any(token in text for token in venue_tokens) or "当日メニュー" not in text:
                continue
            item: dict[str, Any] = {"sport": SPORT, "venue": venue}
            times = TIME_RE.findall(text)
            if times and max(int(value.split(":", 1)[0]) * 60 + int(value.split(":", 1)[1]) for value in times) >= 18 * 60:
                item["session"] = "night"
            entries.append(item)
        except Exception as exc:
            warnings.append(f"{venue}: {exc}")

    if not scheduled_venues and monthly.ok:
        return SourceResult(SPORT, True, entries=[], fetched_urls=fetched, warnings=warnings)
    if successful_requests == 0:
        return SourceResult(SPORT, False, fetched_urls=fetched, warnings=warnings, error="地方競馬当日メニューへ接続できませんでした")
    return SourceResult(SPORT, True, entries=entries, fetched_urls=fetched, warnings=warnings)
