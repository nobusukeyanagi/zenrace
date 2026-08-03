from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
from typing import Any, Iterable

FIELDS = ("date", "sport", "venue", "grade", "name")
DEFAULT_SNAPSHOT = Path(__file__).resolve().parents[1] / "data" / "official_schedule_2026_07_08.json"


def load_snapshot(path: Path = DEFAULT_SNAPSHOT) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    validate_snapshot(data)
    return data


def schedule_identity(record: dict[str, Any]) -> tuple[str, str, str, str, str]:
    return tuple(str(record.get(field, "")).strip() for field in FIELDS)  # type: ignore[return-value]


def month_records(records: Iterable[dict[str, Any]], month: str) -> list[dict[str, str]]:
    selected = [
        {field: str(record.get(field, "")).strip() for field in FIELDS}
        for record in records
        if str(record.get("date", "")).startswith(month)
    ]
    return sorted(selected, key=schedule_identity)


def validate_snapshot(data: dict[str, Any]) -> None:
    months = data.get("months")
    expected_counts = data.get("expected_counts")
    if not isinstance(months, dict) or not isinstance(expected_counts, dict):
        raise ValueError("verified schedule snapshot is missing months or expected_counts")

    for month, records in months.items():
        if not isinstance(records, list):
            raise ValueError(f"{month}: records must be a list")
        identities = [schedule_identity(record) for record in records]
        required_indices = (0, 1, 2, 4)  # grade may legitimately be blank for some local NAR races.
        if any(not all(identity[index] for index in required_indices) for identity in identities):
            raise ValueError(f"{month}: blank required schedule identity field")
        duplicates = [identity for identity, count in Counter(identities).items() if count > 1]
        if duplicates:
            raise ValueError(f"{month}: duplicate schedule identities: {duplicates}")

        expected = expected_counts.get(month, {})
        if len(records) != int(expected.get("total", -1)):
            raise ValueError(f"{month}: total count mismatch")
        actual_by_sport = Counter(record["sport"] for record in records)
        expected_by_sport = Counter(expected.get("by_sport", {}))
        if actual_by_sport != expected_by_sport:
            raise ValueError(
                f"{month}: sport count mismatch: actual={dict(actual_by_sport)}, expected={dict(expected_by_sport)}"
            )


def compare_month(
    records: Iterable[dict[str, Any]],
    month: str,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, list[tuple[str, str, str, str, str]]]:
    verified = snapshot or load_snapshot()
    expected = {schedule_identity(record) for record in verified["months"][month]}
    actual = {schedule_identity(record) for record in month_records(records, month)}
    return {
        "missing": sorted(expected - actual),
        "unexpected": sorted(actual - expected),
    }
