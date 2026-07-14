from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import urljoin

from scripts.common import (
    Patch,
    RateLimitedSession,
    SourceResult,
    choose_first_place_name,
    clean_text,
    extract_times,
    same_name,
    soup_from,
    table_rows,
)


NAME = "地方競馬"

SCHEDULE_URL = "https://www.keiba.go.jp/gradedrace/schedule.html"
RACE_LIST_URL = "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceList"
WINNER_URL = "https://www.keiba.go.jp/KeibaWeb/DataRoom/JyusyoRaceWinhorse"

VENUE_CODES = {
    "帯広": "03",
    "帯広ば": "03",
    "門別": "36",
    "盛岡": "10",
    "水沢": "11",
    "浦和": "18",
    "船橋": "19",
    "大井": "20",
    "川崎": "21",
    "金沢": "22",
    "笠松": "23",
    "名古屋": "24",
    "園田": "27",
    "姫路": "28",
    "高知": "31",
    "佐賀": "32",
}


def _time_from_race_list(
    record: dict[str, Any],
    session: RateLimitedSession,
) -> tuple[str, str, str]:
    venue = str(record.get("venue", ""))
    code = VENUE_CODES.get(venue)

    if not code:
        return "", "", ""

    date_value = str(record["date"]).replace("-", "/")
    params = {
        "k_raceDate": date_value,
        "k_babaCode": code,
    }

    response = session.get(RACE_LIST_URL, params=params)
    url = response.url
    soup = soup_from(response)
    race_name = str(record.get("name", ""))

    for row in soup.select("tr"):
        row_text = clean_text(row.get_text(" ", strip=True))

        if not same_name(row_text, race_name):
            continue

        times = extract_times(row_text)
        time_value = times[-1] if times else ""

        if "中止" in row_text:
            time_value = "中止"

        winner = ""

        # 結果ページへのリンクが行内にあれば、優勝馬を追加取得する。
        links = row.find_all("a", href=True)

        for link in links:
            href = str(link.get("href", ""))

            if "RaceMarkTable" not in href and "RaceResult" not in href:
                continue

            detail = session.get(urljoin(response.url, href))
            winner = choose_first_place_name(
                table_rows(soup_from(detail))
            )

            if winner:
                break

        return time_value, winner, url

    return "", "", url


def _winner_from_archive(
    record: dict[str, Any],
    session: RateLimitedSession,
) -> tuple[str, str]:
    code = VENUE_CODES.get(str(record.get("venue", "")))

    if not code:
        return "", ""

    params = {
        "k_babaCode": code,
        "k_nenndo": str(record["date"])[:4],
    }

    response = session.get(WINNER_URL, params=params)
    soup = soup_from(response)
    race_name = str(record.get("name", ""))

    for cells in table_rows(soup):
        joined = " ".join(cells)

        if not same_name(joined, race_name):
            continue

        for position, cell in enumerate(cells):
            if not same_name(cell, race_name):
                continue

            for candidate in cells[position + 1 :]:
                value = clean_text(candidate)

                if not value:
                    continue
                if "結果" in value:
                    continue
                if re.fullmatch(r"\d+[年月日/.-].*", value):
                    continue
                if 2 <= len(value) <= 30:
                    return value, response.url

    return "", response.url


def collect(
    records: list[dict[str, Any]],
    session: RateLimitedSession,
    logger: logging.Logger,
) -> SourceResult:
    patches: list[Patch] = []
    fetched: list[str] = []
    warnings: list[str] = []

    targets = [
        (index, record)
        for index, record in enumerate(records)
        if record.get("sport") == "nar"
    ]

    if not targets:
        return SourceResult(NAME, True, [], [], [])

    # 年間重賞一覧は補助的に確認する。
    # このページがJavaScript描画などで本文を取得できなくても、
    # 個別の当日メニューは取得できるため、処理全体を停止しない。
    try:
        response = session.get(SCHEDULE_URL)
        fetched.append(response.url)

        schedule_text = soup_from(response).get_text(" ", strip=True)

        if "重賞" not in schedule_text or len(schedule_text) < 1000:
            warnings.append(
                "地方競馬重賞一覧の本文を十分に確認できませんでした。"
                "個別レース情報の取得は継続します。"
            )
    except Exception as exc:
        warnings.append(
            f"地方競馬重賞一覧の取得に失敗しましたが、"
            f"個別レース情報の取得を継続します: {exc}"
        )

    successful_requests = 0

    for index, record in targets:
        try:
            time_value, winner, url = _time_from_race_list(
                record,
                session,
            )

            if url:
                fetched.append(url)
                successful_requests += 1

            fields: dict[str, str] = {}

            if time_value:
                fields["time"] = time_value

            if winner:
                fields["winner"] = winner

            if not winner:
                archive_winner, archive_url = _winner_from_archive(
                    record,
                    session,
                )

                if archive_url:
                    fetched.append(archive_url)

                if archive_winner:
                    fields["winner"] = archive_winner

            if fields:
                patches.append(
                    Patch(
                        index,
                        fields,
                        NAME,
                        url or SCHEDULE_URL,
                        "地方競馬公式レース情報",
                    )
                )

        except Exception as exc:
            warnings.append(
                f"{record['date']} "
                f"{record.get('venue', '')} "
                f"{record.get('name', '')}: {exc}"
            )

    # 個別ページに一度も接続できなかった場合のみ取得失敗とする。
    if successful_requests == 0:
        error = "地方競馬の個別レース情報を取得できませんでした"
        logger.error(error)

        return SourceResult(
            NAME,
            False,
            patches,
            list(dict.fromkeys(fetched)),
            warnings,
            error,
        )

    return SourceResult(
        NAME,
        True,
        patches,
        list(dict.fromkeys(fetched)),
        warnings,
    )
