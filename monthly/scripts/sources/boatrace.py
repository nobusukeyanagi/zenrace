from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup

from monthly.scripts.common import OfficialSession, SourceResult, clean_text, normalize_grade

SPORT = "boat"
MONTHLY_URL = "https://www.boatrace.jp/owpc/pc/race/monthlyschedule"
VENUE_CODES = {
    "01": "桐生", "02": "戸田", "03": "江戸川", "04": "平和島", "05": "多摩川", "06": "浜名湖",
    "07": "蒲郡", "08": "常滑", "09": "津", "10": "三国", "11": "びわこ", "12": "住之江",
    "13": "尼崎", "14": "鳴門", "15": "丸亀", "16": "児島", "17": "宮島", "18": "徳山",
    "19": "下関", "20": "若松", "21": "芦屋", "22": "福岡", "23": "唐津", "24": "大村",
}
FULLWIDTH = str.maketrans("０１２３４５６７８９", "0123456789")
DAY_RE = re.compile(r"(\d{1,2})月(\d{1,2})日\s*(初日|[０-９0-9]+日目|最終日)")
TIME_RE = re.compile(r"\b1R\s*([0-2]?\d:[0-5]\d)")
GRADE_RE = re.compile(r"\b(SG|PG1|G1|G2|G3)\b", re.I)


def _session_from_text(text: str) -> str:
    if "ミッドナイト" in text:
        return "midnight"
    match = TIME_RE.search(text.translate(FULLWIDTH))
    if not match:
        return ""
    hour = int(match.group(1).split(":", 1)[0])
    if hour <= 9:
        return "morning"
    if hour >= 14:
        return "night"
    return ""


def _grade_from_page(soup: BeautifulSoup, fallback: str = "") -> str:
    candidates = [fallback]
    title_node = soup.find(["h1", "h2"])
    if title_node:
        candidates.append(clean_text(title_node.get_text(" ", strip=True)))
    candidates.extend(clean_text(img.get("alt", "")) for img in soup.find_all("img") if clean_text(img.get("alt", "")))
    for candidate in candidates:
        match = GRADE_RE.fullmatch(clean_text(candidate).upper()) or GRADE_RE.search(clean_text(candidate).upper())
        if match:
            return normalize_grade(SPORT, match.group(1).upper())
    return "一般"


def _meeting_links(soup: BeautifulSoup) -> list[tuple[date, str, str, str]]:
    candidates: list[tuple[date, str, str, str]] = []
    seen: set[tuple[str, str]] = set()
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href", ""))
        if "raceindex" not in href or "jcd=" not in href or "hd=" not in href:
            continue
        parsed = parse_qs(urlparse(href).query)
        hd = (parsed.get("hd") or [""])[0]
        jcd = (parsed.get("jcd") or [""])[0].zfill(2)
        if jcd not in VENUE_CODES or not re.fullmatch(r"\d{8}", hd):
            continue
        end_date = datetime.strptime(hd, "%Y%m%d").date()
        title = clean_text(anchor.get_text(" ", strip=True))
        key = (jcd, hd)
        if key in seen:
            continue
        seen.add(key)
        candidates.append((end_date, jcd, href, title))
    candidates.sort(key=lambda item: (item[0], item[1]))
    return candidates


def _resolve_day_date(end_date: date, month: int, day: int) -> date:
    # 開催詳細には月日だけが表示されるため、終了日を基準に年を補う。
    candidates = []
    for year in (end_date.year - 1, end_date.year, end_date.year + 1):
        try:
            candidate = date(year, month, day)
        except ValueError:
            continue
        if abs((candidate - end_date).days) <= 12:
            candidates.append(candidate)
    return min(candidates, key=lambda value: abs((value - end_date).days)) if candidates else date(end_date.year, month, day)


def _collect_month_uncached(year: int, month: int, session: OfficialSession) -> SourceResult:
    try:
        response = session.get(MONTHLY_URL, params={"ym": f"{year}{month:02d}"})
    except Exception as exc:
        return SourceResult(SPORT, False, fetched_urls=[MONTHLY_URL], error=str(exc))
    soup = BeautifulSoup(response.text, "lxml")
    fetched = [response.url]
    warnings: list[str] = []
    entries: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    for end_date, jcd, href, link_title in _meeting_links(soup):
        # 月末終了の前月跨ぎと、翌月終了の当月開始を拾う。
        if not (date(year, month, 1).replace(day=1) <= end_date):
            continue
        try:
            detail = session.get(href if href.startswith("http") else f"https://www.boatrace.jp{href}")
            fetched.append(detail.url)
            detail_soup = BeautifulSoup(detail.text, "lxml")
            text = clean_text(detail_soup.get_text(" ", strip=True)).translate(FULLWIDTH)
            title_node = detail_soup.find(["h1", "h2"])
            title = clean_text(title_node.get_text(" ", strip=True) if title_node else link_title)
            grade = _grade_from_page(detail_soup, link_title)
            session_name = _session_from_text(text)
            girls = any(keyword in title for keyword in ("オールレディース", "ヴィーナス", "女子", "レディース"))
            for day_month, day_value, label in DAY_RE.findall(text):
                target = _resolve_day_date(end_date, int(day_month), int(day_value))
                if target.year != year or target.month != month:
                    continue
                venue = VENUE_CODES[jcd]
                key = (target.isoformat(), venue)
                if key in seen:
                    continue
                seen.add(key)
                item: dict[str, Any] = {
                    "date": target.isoformat(),
                    "sport": SPORT,
                    "venue": venue,
                    "grade": grade,
                    "day": label.translate(FULLWIDTH),
                }
                if session_name:
                    item["session"] = session_name
                if girls:
                    item["girls"] = True
                entries.append(item)
        except Exception as exc:
            warnings.append(f"{VENUE_CODES[jcd]}: {exc}")

    if not entries and "月間スケジュール" not in soup.get_text(" ", strip=True):
        return SourceResult(SPORT, False, fetched_urls=fetched, warnings=warnings, error="BOAT RACE月間スケジュールを確認できませんでした")
    entries.sort(key=lambda item: (str(item.get("date", "")), str(item.get("venue", ""))))
    return SourceResult(SPORT, True, entries=entries, fetched_urls=fetched, warnings=warnings)


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
    result = collect_month(target.year, target.month, session)
    if not result.ok:
        return result
    entries = [
        {key: value for key, value in item.items() if key != "date"}
        for item in result.entries
        if item.get("date") == target.isoformat()
    ]
    return SourceResult(SPORT, True, entries=entries, fetched_urls=result.fetched_urls, warnings=result.warnings)
