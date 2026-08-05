from __future__ import annotations

import io
import re
from dataclasses import dataclass
from datetime import date
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from monthly.scripts.common import OfficialSession, SourceResult, clean_text, normalize_grade

SPORT = "auto"
VENUES = {
    "川口": "kawaguchi",
    "伊勢崎": "isesaki",
    "浜松": "hamamatsu",
    "飯塚": "iizuka",
    "山陽": "sanyo",
}
SLUG_TO_VENUE = {slug: venue for venue, slug in VENUES.items()}
PDF_URL = "https://autorace.jp/calendar/first/schedule.pdf"
VENUE_COLORS = {
    "川口": (1.0, 0.0, 1.0),
    "伊勢崎": (0.0, 0.0, 0.0),
    "浜松": (0.0, 0.439, 0.753),
    "飯塚": (1.0, 1.0, 0.0),
    "山陽": (1.0, 0.753, 0.0),
}
FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")

TITLE_IDENTITY_RE = re.compile(
    r"(?P<year>\d{4})[/-](?P<month>\d{1,2})[/-](?P<day>\d{1,2})"
    r"\s*出走表\s*[|｜]\s*"
    r"(?P<venue>川口|伊勢崎|浜松|飯塚|山陽)オート"
)
VENUE_HEADING_RE = re.compile(r"^(?P<venue>川口|伊勢崎|浜松|飯塚|山陽)オート(?:レース)?(?:\s+出走表)?$")
DATE_RE = re.compile(r"(?P<year>\d{4})[/-](?P<month>\d{1,2})[/-](?P<day>\d{1,2})")
TIME_RE = re.compile(r"(?:発走(?:予定)?|締切(?:予定)?|投票締切)\s*[:：]?\s*([0-2]?\d:[0-5]\d)")
NOT_FOUND_TOKENS = ("ページが見つかりません", "404 Not Found")
GRADE_RE = re.compile(r"(特別G[ⅠⅡⅢ1-3]|SG|G[ⅠⅡⅢ1-3])", re.I)


@dataclass(frozen=True)
class PageIdentity:
    venue: str
    target_date: date


def _close_color(value: Any, expected: tuple[float, float, float], tolerance: float = 0.025) -> bool:
    return (
        isinstance(value, tuple)
        and len(value) == 3
        and all(abs(float(value[index]) - expected[index]) <= tolerance for index in range(3))
    )


def _months_from_pdf_text(text: str) -> tuple[int, list[int]]:
    normalized = text.translate(FULLWIDTH_DIGITS)
    match = re.search(r"(20\d{2})年([0-9・･]+)月オートレース日程表", normalized)
    if not match:
        return 0, []
    months = [int(value) for value in re.findall(r"\d{1,2}", match.group(2))]
    return int(match.group(1)), months


def _session_from_context(context_text: str) -> str:
    if "オーバーミッドナイト" in context_text or "ミッドナイト" in context_text:
        return "midnight"
    if "ナイター" in context_text or "ナイトレース" in context_text or "アフター" in context_text:
        return "night"
    if "アーリー" in context_text:
        return "morning"
    return ""


def _grade_from_context(context_text: str) -> str:
    match = GRADE_RE.search(context_text.replace(" ", ""))
    if not match:
        return "普通"
    value = match.group(1).replace("特別", "特G")
    return normalize_grade(SPORT, value)


def _parse_pdf_layout(rects: list[dict[str, Any]], words: list[dict[str, Any]], text: str) -> list[dict[str, Any]]:
    year, months = _months_from_pdf_text(text)
    if not year or not months:
        return []

    kawaguchi_color = VENUE_COLORS["川口"]
    section_starts = sorted(
        float(rect["top"])
        for rect in rects
        if float(rect.get("x0", 999)) < 70
        and 100 <= float(rect.get("x1", 0)) <= 103
        and float(rect.get("height", 0)) >= 20
        and _close_color(rect.get("non_stroking_color"), kawaguchi_color)
    )
    if len(section_starts) < len(months):
        return []
    section_starts = section_starts[: len(months)]

    first_top = section_starts[0]
    boundaries = sorted(
        {
            round(float(rect["x0"]), 1)
            for rect in rects
            if 100 <= float(rect.get("x0", 0)) <= 810
            and float(rect.get("width", 99)) <= 2.0
            and float(rect.get("top", 999)) < first_top
            and float(rect.get("bottom", 0)) >= first_top - 1.5
            and _close_color(rect.get("non_stroking_color"), (0.0, 0.0, 0.0), 0.01)
        }
    )
    if len(boundaries) < 31:
        return []
    # 左端101px台から始まる日付列だけに絞り、右端までを境界として使う。
    boundaries = [value for value in boundaries if value >= 100]
    if len(boundaries) < 31:
        return []

    results: dict[tuple[str, str], dict[str, Any]] = {}
    for section_index, month in enumerate(months):
        section_start = section_starts[section_index]
        section_end = section_starts[section_index + 1] if section_index + 1 < len(section_starts) else max(
            [float(rect.get("bottom", 0)) for rect in rects] + [section_start + 140]
        )
        try:
            from calendar import monthrange

            last_day = monthrange(year, month)[1]
        except ValueError:
            continue
        if len(boundaries) < last_day + 2:
            continue
        centers = [(boundaries[index + 1] + boundaries[index + 2]) / 2 for index in range(last_day)]

        for venue, color in VENUE_COLORS.items():
            venue_rects = [
                rect
                for rect in rects
                if section_start - 0.5 <= float(rect.get("top", 999)) < section_end
                and float(rect.get("x0", 0)) >= boundaries[0] - 1
                and float(rect.get("width", 0)) >= 4
                and float(rect.get("height", 0)) >= 4
                and _close_color(rect.get("non_stroking_color"), color)
            ]
            for rect in venue_rects:
                x0 = float(rect["x0"])
                x1 = float(rect["x1"])
                context_words = [
                    str(word.get("text", ""))
                    for word in words
                    if x0 - 1 <= (float(word.get("x0", 0)) + float(word.get("x1", 0))) / 2 <= x1 + 1
                    and float(rect.get("top", 0)) - 2 <= (float(word.get("top", 0)) + float(word.get("bottom", 0))) / 2 <= float(rect.get("bottom", 0)) + 2
                ]
                context = clean_text(" ".join(context_words))
                for day_index, center in enumerate(centers, start=1):
                    if not (x0 - 0.8 <= center <= x1 + 0.8):
                        continue
                    target = date(year, month, day_index)
                    key = (target.isoformat(), venue)
                    item = results.setdefault(
                        key,
                        {
                            "date": target.isoformat(),
                            "sport": SPORT,
                            "venue": venue,
                            "grade": _grade_from_context(context),
                        },
                    )
                    session_name = _session_from_context(context)
                    if session_name:
                        item["session"] = session_name
                    grade = _grade_from_context(context)
                    if grade != "普通":
                        item["grade"] = grade

    return sorted(results.values(), key=lambda item: (str(item["date"]), str(item["venue"])))


def _collect_month_uncached(year: int, month: int, session: OfficialSession) -> SourceResult:
    try:
        response = session.get(PDF_URL)
    except Exception as exc:
        return SourceResult(SPORT, False, fetched_urls=[PDF_URL], error=str(exc))
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(response.content)) as document:
            entries: list[dict[str, Any]] = []
            for page in document.pages:
                page_entries = _parse_pdf_layout(page.rects, page.extract_words(), page.extract_text() or "")
                entries.extend(
                    item for item in page_entries if item.get("date", "").startswith(f"{year}-{month:02d}-")
                )
    except Exception as exc:
        return SourceResult(SPORT, False, fetched_urls=[response.url], error=f"オートレース日程PDF解析失敗: {exc}")
    if not entries:
        return SourceResult(SPORT, False, fetched_urls=[response.url], error="オートレース日程PDFに対象月が見つかりませんでした")
    return SourceResult(SPORT, True, entries=entries, fetched_urls=[response.url])


def _session_from_text(context_text: str, first_time: str) -> str:
    if "オーバーミッドナイト" in context_text or "ミッドナイト" in context_text:
        return "midnight"
    if "ナイター" in context_text or "アフター5" in context_text or "アフター５" in context_text:
        return "night"
    if "アーリー" in context_text:
        return "morning"
    if first_time:
        hour = int(first_time.split(":", 1)[0])
        if hour <= 10:
            return "morning"
        if hour >= 14:
            return "night"
    return ""


def _title_candidates(soup: BeautifulSoup) -> list[str]:
    candidates: list[str] = []
    if soup.title:
        candidates.append(soup.title.get_text(" ", strip=True))
    for attrs in ({"property": "og:title"}, {"name": "twitter:title"}):
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content"):
            candidates.append(str(tag.get("content")))
    return [clean_text(value) for value in candidates if clean_text(value)]


def _heading_identity(soup: BeautifulSoup, requested_date: date) -> PageIdentity | None:
    main = soup.find("main")
    if not main:
        return None
    headings = [clean_text(node.get_text(" ", strip=True)) for node in main.find_all(("h1", "h2"), limit=5)]
    venue = ""
    page_date: date | None = None
    for heading in headings:
        match = VENUE_HEADING_RE.match(heading)
        if match:
            venue = match.group("venue")
        date_match = DATE_RE.search(heading)
        if date_match:
            page_date = date(
                int(date_match.group("year")),
                int(date_match.group("month")),
                int(date_match.group("day")),
            )
    if venue and (page_date is None or page_date == requested_date):
        return PageIdentity(venue=venue, target_date=requested_date)
    return None


def _page_identity(soup: BeautifulSoup, requested_date: date) -> PageIdentity | None:
    for candidate in _title_candidates(soup):
        match = TITLE_IDENTITY_RE.search(candidate)
        if not match:
            continue
        return PageIdentity(
            venue=match.group("venue"),
            target_date=date(
                int(match.group("year")),
                int(match.group("month")),
                int(match.group("day")),
            ),
        )
    return _heading_identity(soup, requested_date)


def _canonical_slug(soup: BeautifulSoup) -> str:
    canonical = soup.find("link", rel=lambda value: value and "canonical" in value)
    if not canonical or not canonical.get("href"):
        return ""
    parts = [part for part in urlparse(str(canonical.get("href"))).path.split("/") if part]
    for part in parts:
        if part in SLUG_TO_VENUE:
            return part
    return ""


def _event_context(soup: BeautifulSoup) -> str:
    candidates = _title_candidates(soup)
    main = soup.find("main")
    if main:
        for heading in main.find_all(("h1", "h2", "h3"), limit=8):
            candidates.append(clean_text(heading.get_text(" ", strip=True)))
        for selector in (".race-title", ".event-title", ".meeting-title", ".race-name"):
            for element in main.select(selector)[:3]:
                candidates.append(clean_text(element.get_text(" ", strip=True)))
    return clean_text(" ".join(value for value in candidates if value))


def _first_time(soup: BeautifulSoup) -> str:
    main = soup.find("main") or soup.body or soup
    main_text = clean_text(main.get_text(" ", strip=True))
    times = TIME_RE.findall(main_text)
    return times[0] if times else ""


def _candidate_urls(slug: str, target: date) -> tuple[str, str]:
    base = f"https://autorace.jp/race_info/Program/{slug}/{target.isoformat()}"
    return base, f"{base}_01"


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
    expected_venues = {
        str(item.get("venue", ""))
        for item in monthly.entries
        if item.get("date") == target.isoformat()
    } if monthly.ok else set(VENUES)
    if monthly.ok and not expected_venues:
        return SourceResult(SPORT, True, entries=[], fetched_urls=monthly.fetched_urls, warnings=monthly.warnings)

    entries_by_venue: dict[str, dict[str, Any]] = {}
    fetched: list[str] = list(monthly.fetched_urls)
    warnings: list[str] = list(monthly.warnings)
    reachable_pages = 0
    identified_pages = 0

    for expected_venue, slug in VENUES.items():
        if expected_venue not in expected_venues:
            continue
        accepted = False
        last_mismatch = ""

        for url in _candidate_urls(slug, target):
            try:
                response = session.get(url)
                reachable_pages += 1
                fetched.append(response.url)
                soup = BeautifulSoup(response.text, "lxml")
                page_text = clean_text(soup.get_text(" ", strip=True))
                if any(token in page_text for token in NOT_FOUND_TOKENS):
                    continue

                identity = _page_identity(soup, target)
                if identity is None:
                    continue
                identified_pages += 1

                if identity.target_date != target:
                    last_mismatch = (
                        f"{expected_venue}: {target.isoformat()}を要求しましたが、"
                        f"{identity.target_date.isoformat()}のページが返されたため除外しました。"
                    )
                    continue
                if identity.venue != expected_venue:
                    last_mismatch = (
                        f"{expected_venue}: 取得ページは{identity.venue}の出走表だったため、"
                        "非開催場として除外しました。"
                    )
                    continue

                canonical_slug = _canonical_slug(soup)
                if canonical_slug and canonical_slug != slug:
                    warnings.append(
                        f"{expected_venue}: canonical URLが{canonical_slug}を指していましたが、"
                        "ページタイトルの開催場を優先して確認しました。"
                    )

                first_time = _first_time(soup)
                item: dict[str, Any] = {
                    "sport": SPORT,
                    "venue": expected_venue,
                    "grade": "普通",
                }
                session_name = _session_from_text(_event_context(soup), first_time)
                if session_name:
                    item["session"] = session_name
                entries_by_venue[expected_venue] = item
                accepted = True
                break
            except Exception as exc:
                last_mismatch = f"{expected_venue}: {exc}"

        if not accepted and last_mismatch:
            warnings.append(last_mismatch)

    if reachable_pages == 0:
        return SourceResult(
            SPORT,
            False,
            fetched_urls=fetched,
            warnings=warnings,
            error="AutoRace.JPの当日出走表へ接続できませんでした",
        )

    entries = [entries_by_venue[venue] for venue in VENUES if venue in entries_by_venue]
    if identified_pages > 0 and not entries:
        return SourceResult(
            SPORT,
            False,
            fetched_urls=fetched,
            warnings=warnings,
            error="AutoRace.JPのページタイトルから対象日の開催場を確定できませんでした",
        )
    if len(entries) == len(VENUES):
        return SourceResult(
            SPORT,
            False,
            fetched_urls=fetched,
            warnings=warnings,
            error="オートレース全5場が同日に検出されたため、共通ページ誤認として更新を停止しました",
        )

    return SourceResult(SPORT, True, entries=entries, fetched_urls=fetched, warnings=warnings)
