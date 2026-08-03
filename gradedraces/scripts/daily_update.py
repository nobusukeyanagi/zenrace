from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


def run(command: list[str], cwd: Path) -> dict[str, Any]:
    print("[daily-update]", " ".join(command), flush=True)
    completed = subprocess.run(command, cwd=cwd, check=False)
    return {"command": command, "returncode": completed.returncode}


def load_json(path: Path) -> Any:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="公式日程同期・直近詳細・結果補完・全件監査を1日1回まとめて実行します。")
    parser.add_argument("--date", help="基準日 YYYY-MM-DD。省略時は日本時間の当日")
    parser.add_argument("--fail-if-all-sources-fail", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    python = sys.executable
    date_args = ["--date", args.date] if args.date else []
    fail_args = ["--fail-if-all-sources-fail"] if args.fail_if_all_sources_fail else []

    steps = [
        run([python, "-m", "scripts.master_schedule", *date_args, *fail_args], root),
        run([python, "-m", "scripts.update_races", *date_args, "--smart", *fail_args], root),
        run([python, "-m", "scripts.validate_races", "races.json"], root),
        run([python, "-m", "scripts.sync_html", "--json", "races.json", "--html", "graded_races_schedule.html"], root),
    ]

    if steps[-1]["returncode"] == 0:
        (root / "index.html").write_text(
            (root / "graded_races_schedule.html").read_text(encoding="utf-8"),
            encoding="utf-8",
            newline="\n",
        )

    master = load_json(root / "master_schedule_report.json")
    details = load_json(root / "changes.json")
    incomplete = load_json(root / "incomplete_records.json")
    status = load_json(root / "source_status.json")
    report = {
        "generated_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "base_date": args.date or datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat(),
        "steps": steps,
        "summary": {
            "master_official_records": master.get("official_record_count", 0),
            "master_added": master.get("added_count", 0),
            "master_deferred_additions": master.get("deferred_addition_count", 0),
            "master_new_addition_end": master.get("new_addition_end", ""),
            "master_updated": master.get("updated_count", 0),
            "master_review_required": master.get("registered_only_count", 0),
            "master_duplicates": master.get("duplicate_count", 0),
            "detail_targets": details.get("target_count", 0),
            "detail_changes": details.get("change_count", 0),
            "past_unresolved": incomplete.get("past_unresolved_count", 0),
            "upcoming_missing_time": incomplete.get("upcoming_missing_time_count", 0),
            "detail_source_failures": sum(1 for item in status.get("sources", []) if not item.get("ok")),
        },
    }
    (root / "daily_update_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    failed = [step for step in steps if step["returncode"] != 0]
    if failed:
        print(f"[daily-update] failed steps: {len(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
