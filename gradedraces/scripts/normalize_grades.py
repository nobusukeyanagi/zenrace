from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

ROMAN_TO_ARABIC = {
    "Ⅰ": "1",
    "Ⅱ": "2",
    "Ⅲ": "3",
    "１": "1",
    "２": "2",
    "３": "3",
}


def normalize_grade(sport: str, grade: str) -> str:
    """Normalize only official local systems that use H1-H3 / M1-M3."""
    value = str(grade or "").strip()
    if sport != "nar":
        return value

    match = re.fullmatch(r"([HM])([ⅠⅡⅢ１２３123])", value, flags=re.IGNORECASE)
    if not match:
        return value

    prefix, rank = match.groups()
    return prefix.upper() + ROMAN_TO_ARABIC.get(rank, rank)


def normalize_file(path: Path, start_date: str = "2026-01-01") -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("races.jsonの最上位は配列である必要があります。")

    changes: list[dict[str, Any]] = []
    for record in payload:
        if not isinstance(record, dict):
            continue
        if str(record.get("date", "")) < start_date:
            continue
        before = str(record.get("grade", ""))
        after = normalize_grade(str(record.get("sport", "")), before)
        if after != before:
            record["grade"] = after
            changes.append(
                {
                    "date": record.get("date", ""),
                    "venue": record.get("venue", ""),
                    "name": record.get("name", ""),
                    "before": before,
                    "after": after,
                }
            )

    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return changes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="races.json")
    parser.add_argument("--start", default="2026-01-01")
    parser.add_argument("--report", default="grade_normalization_report.json")
    args = parser.parse_args()

    changes = normalize_file(Path(args.path), args.start)
    Path(args.report).write_text(
        json.dumps(changes, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"地方競馬のH/M格表記を{len(changes)}件修正しました。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
