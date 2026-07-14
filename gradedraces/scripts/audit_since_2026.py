from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def load_max_date(path: Path) -> date:
    payload = json.loads(path.read_text(encoding="utf-8"))
    values = [parse_date(str(item["date"])) for item in payload if isinstance(item, dict) and item.get("date")]
    return max(values)


def ranges(start: date, end: date, days: int):
    cursor = start
    while cursor <= end:
        chunk_end = min(end, cursor + timedelta(days=days - 1))
        yield cursor, chunk_end
        cursor = chunk_end + timedelta(days=1)


def run_chunk(chunk_start: date, chunk_end: date) -> int:
    center = chunk_start + (chunk_end - chunk_start) // 2
    before = (center - chunk_start).days
    after = (chunk_end - center).days
    command = [
        sys.executable,
        "-m",
        "scripts.update_races",
        "--date",
        center.isoformat(),
        "--before",
        str(before),
        "--after",
        str(after),
    ]
    print(f"[audit] {chunk_start}〜{chunk_end}", flush=True)
    return subprocess.run(command, check=False).returncode


def main() -> int:
    parser = argparse.ArgumentParser(
        description="2026年1月以降の登録レースを公式取得処理で分割再点検します。"
    )
    parser.add_argument("--start", default="2026-01-01")
    parser.add_argument(
        "--end",
        default="",
        help="空欄では実行日から45日後まで（races.json最終日を上限）",
    )
    parser.add_argument("--chunk-days", type=int, default=31)
    parser.add_argument("--races", default="races.json")
    args = parser.parse_args()

    races_path = Path(args.races)
    start = parse_date(args.start)
    max_date = load_max_date(races_path)
    if args.end:
        end = min(parse_date(args.end), max_date)
    else:
        end = min(datetime.now(JST).date() + timedelta(days=45), max_date)

    if end < start:
        raise ValueError("終了日は開始日以降にしてください。")
    if args.chunk_days < 1 or args.chunk_days > 62:
        raise ValueError("chunk-daysは1〜62で指定してください。")

    results = []
    success_count = 0
    for chunk_start, chunk_end in ranges(start, end, args.chunk_days):
        code = run_chunk(chunk_start, chunk_end)
        results.append(
            {
                "start": chunk_start.isoformat(),
                "end": chunk_end.isoformat(),
                "returncode": code,
            }
        )
        if code == 0:
            success_count += 1

    normalize = subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.normalize_grades",
            str(races_path),
            "--start",
            start.isoformat(),
        ],
        check=False,
    )

    summary = {
        "audit_start": start.isoformat(),
        "audit_end": end.isoformat(),
        "chunk_days": args.chunk_days,
        "successful_chunks": success_count,
        "total_chunks": len(results),
        "grade_normalization_returncode": normalize.returncode,
        "chunks": results,
    }
    Path("full_audit_report.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if success_count == 0 or normalize.returncode != 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
