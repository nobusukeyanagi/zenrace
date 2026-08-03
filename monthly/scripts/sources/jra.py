from __future__ import annotations

import calendar
import re
from datetime import date
from typing import Any
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from monthly.scripts.common import OfficialSession, SourceResult, clean_text

SPORT = "jra"
URL = "https://www.jra.go.jp/keiba/calendar{year}/{year}/{month}/{month:02d}{day:02d}.html"
MONTHLY_URL = "https://www.jra.go.jp/keiba/calendar{year}/{month_name}.html"
MONTH_NAMES = {
    1: "jan", 2: "feb", 3: "mar", 4: "apr", 5: "may", 6: "jun",
    7: "jul", 8: "aug", 9: "sep", 10: "oct", 11: "nov", 12: "dec",
}
VENUES = ["札幌", "函館", "福島", "新潟", "東京", "中山", "中京", "京都", "阪神", "小倉"]
DAY_LINK_RE = re.compile(r"/(?:20\d{2})/(?P<month>\d{1,2})/(?P<md>\d{4})\.html(?:$|[?#])")


def _ancestor_text(anchor: Tag) -> str:
    candidates: list[str] = []
    node: Tag | None = anchor
    for _ in range(6):
        if node is None:
            break
        text = clean_text(node.get_text(" ", strip=True))
        if text:
            candidates.append(text)
        if any(venue in text for venue in VENUES) and len(text) <= 500:
            return text
        parent = node.parent
        node = parent if isinstance(parent, Tag) else None
    return min(candidates, key=len) if candidates else ""


def _collect_month_uncached(year: int, month: int, session: OfficialSession) -> SourceResult:
    url = MONTHLY_URL.format(year=year, month_name=MONTH_NAMES[month])
    try:
        response = session.get(url)
    except Exception as exc:
        return SourceResult(SPORT, False, fetched_urls=[url], error=str(exc))
    soup = BeautifulSoup(response.text, "lxml")
    text = clean_text(soup.get_text(" ", strip=True))
    if f"{year}年{month}月" not in text or "開催日程" not in text:
        return SourceResult(SPORT, False, fetched_urls=[response.url], error="JRA月間開催日程を確認できませんでした")

    entries_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    linked_dates: set[date] = set()
    for anchor in soup.find_all("a", href=True):
        href = str(anchor.get("href", ""))
        absolute = urljoin(response.url, href)
        match = DAY_LINK_RE.search(absolute)
        if not match:
            continue
        md = match.group("md")
        day_month = int(md[:2])
        day_value = int(md[2:])
        if day_month != month:
            continue
        try:
            target = date(year, month, day_value)
        except ValueError:
            continue
        linked_dates.add(target)
        context = _ancestor_text(anchor)
        for venue in VENUES:
            if venue not in context:
                continue
            key = (target.isoformat(), venue)
            entries_by_key[key] = {"date": target.isoformat(), "sport": SPORT, "venue": venue}

    # 月間ページの構造変更でリンク周辺から開催場を取れない場合は、開催日の番組ページだけを確認する。
    if not entries_by_key:
        warnings = ["月間ページから開催場を抽出できなかったため、掲載された開催日リンクを個別確認します。"]
        fetched = [response.url]
        entries: list[dict[str, Any]] = []
        candidates = sorted(linked_dates)
        if not candidates:
            warnings.append("開催日リンクも取得できなかったため、土日候補を個別確認します。")
            candidates = [
                date(year, month, day_value)
                for day_value in range(1, calendar.monthrange(year, month)[1] + 1)
                if date(year, month, day_value).weekday() in {5, 6}
            ]
        for target in candidates:
            result = collect(target, session, use_month_hint=False)
            fetched.extend(result.fetched_urls)
            warnings.extend(result.warnings)
            if result.ok:
                entries.extend({"date": target.isoformat(), **item} for item in result.entries)
        return SourceResult(SPORT, True, entries=entries, fetched_urls=fetched, warnings=warnings)

    entries = sorted(entries_by_key.values(), key=lambda item: (str(item["date"]), str(item["venue"])))
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

def collect(target: date, session: OfficialSession, *, use_month_hint: bool = True) -> SourceResult:
    if use_month_hint:
        monthly = collect_month(target.year, target.month, session)
        if monthly.ok and not any(item.get("date") == target.isoformat() for item in monthly.entries):
            return SourceResult(SPORT, True, entries=[], fetched_urls=monthly.fetched_urls, warnings=monthly.warnings)

    url = URL.format(year=target.year, month=target.month, day=target.day)
    try:
        response = session.get(url)
    except Exception as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status == 404:
            return SourceResult(SPORT, True, entries=[], fetched_urls=[url])
        return SourceResult(SPORT, False, fetched_urls=[url], error=str(exc))

    soup = BeautifulSoup(response.text, "lxml")
    text = clean_text(soup.get_text(" ", strip=True))
    if f"{target.year}年{target.month}月{target.day}日" not in text or "競馬番組" not in text:
        return SourceResult(SPORT, False, fetched_urls=[response.url], error="JRA競馬番組の対象日を確認できませんでした")
    entries: list[dict[str, Any]] = []
    for venue in VENUES:
        if re.search(rf"\d+回{re.escape(venue)}\d+日", text):
            entries.append({"sport": SPORT, "venue": venue})
    return SourceResult(SPORT, True, entries=entries, fetched_urls=[response.url])
