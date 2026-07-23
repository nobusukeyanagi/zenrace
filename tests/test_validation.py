import datetime as dt
from pathlib import Path
import sys

from bs4 import BeautifulSoup

# 本番と同じく、gradedracesを作業ディレクトリとしてscriptsを読み込む。
PROJECT_DIR = Path(__file__).resolve().parents[1] / "gradedraces"
sys.path.insert(0, str(PROJECT_DIR))

from scripts.common import Patch, merge_patches, same_name, strip_edition  # noqa: E402
from scripts.sources.autorace import grade_schedule_patches  # noqa: E402
from scripts.sources.boatrace import parse_official_result_page  # noqa: E402
from scripts.sources.keirin import (  # noqa: E402
    extract_supplemental_result_fields,
    extract_supplemental_start_time,
    schedule_patches,
)
from scripts.update_races import select_smart_target_indices  # noqa: E402


def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def test_strip_edition() -> None:
    assert strip_edition("第35回 アサヒビールカップ") == "アサヒビールカップ"


def test_same_name() -> None:
    assert same_name("フェアリーステークス", "フェアリーS")


def test_empty_patch_does_not_delete_existing_value() -> None:
    records = [
        {
            "date": "2026-01-01",
            "sport": "jra",
            "venue": "中山",
            "grade": "GⅠ",
            "name": "テスト",
            "winner": "既存",
        }
    ]
    patched, changes = merge_patches(
        records,
        [Patch(0, {"winner": ""}, "test", "https://example.com")],
    )
    assert patched[0]["winner"] == "既存"
    assert changes == []


def test_smart_selection_retries_unresolved_instead_of_only_fixed_lookback() -> None:
    records = [
        {"date": "2026-07-18", "sport": "boat", "time": "16:35", "winner": ""},
        {"date": "2026-07-18", "sport": "nar", "time": "18:00", "winner": "入力済み"},
        {"date": "2026-05-01", "sport": "keirin", "time": "20:30", "winner": "入力済み"},
        {"date": "2026-07-30", "sport": "auto", "time": "", "winner": ""},
    ]
    indices, reasons = select_smart_target_indices(
        records,
        dt.date(2026, 7, 21),
        upcoming_days=14,
        unresolved_retry_days=90,
        recent_verification_days=2,
    )
    assert indices == [0, 3]
    assert "unresolved" in reasons[0]
    assert "upcoming" in reasons[3]


def test_boatrace_winner_registration_number_is_removed() -> None:
    parsed = parse_official_result_page(
        soup(
            """
            <div>締切予定時刻 17:50</div>
            <h3>優勝戦</h3>
            <table>
              <tr><th>着</th><th>枠</th><th>選手</th></tr>
              <tr><td>1着</td><td>1</td><td>4166 吉田 拡郎</td></tr>
            </table>
            """
        )
    )
    assert parsed["winner"] == "吉田 拡郎"


def test_winner_patch_registration_number_is_removed() -> None:
    records = [{"date": "2026-07-22", "sport": "boat", "venue": "児島", "winner": ""}]
    patched, _ = merge_patches(
        records,
        [Patch(0, {"winner": "4166 吉田 拡郎"}, "test", "https://example.com")],
    )
    assert patched[0]["winner"] == "吉田 拡郎"


def test_boatrace_official_result_parser() -> None:
    parsed = parse_official_result_page(
        soup(
            """
            <div>締切予定時刻 10:37 11:03 11:32 12:01 12:30 12:59 13:33 14:07 14:42 15:18 15:56 16:35</div>
            <h3>優勝戦 1800m</h3>
            <table>
              <tr><th>着</th><th>枠</th><th>登録番号</th><th>ボートレーサー</th><th>レースタイム</th></tr>
              <tr><td>１</td><td>1</td><td>3845</td><td>中谷 朋子</td><td>1'51&quot;0</td></tr>
            </table>
            """
        )
    )
    assert parsed == {"time": "16:35", "winner": "中谷 朋子"}


def test_keirin_official_schedule_winner_parser() -> None:
    records = [
        {
            "date": "2026-07-20",
            "sport": "keirin",
            "venue": "高知",
            "grade": "GⅡ",
            "name": "サマーナイトフェスティバル",
            "time": "",
            "winner": "",
        }
    ]
    patches = schedule_patches(
        records,
        soup(
            """
            <table>
              <tr><td>7月</td><td>第２２回サマーナイトフェスティバル</td><td>高知(17～20)</td><td>88億4649万2400円</td><td>吉田 拓矢</td></tr>
            </table>
            """
        ),
        "https://keirin.jp/pc/graderaceschedule",
    )
    assert len(patches) == 1
    assert patches[0].fields == {"winner": "吉田 拓矢"}


def test_keirin_supplemental_start_time_parser() -> None:
    assert (
        extract_supplemental_start_time(
            soup("<div>2000m 発走時間 20:30 締切予定 20:25</div>")
        )
        == "20:30"
    )


def test_keirin_supplemental_result_parser() -> None:
    parsed = extract_supplemental_result_fields(
        soup(
            """
            <div>2000m 発走時間 20:30 締切予定 20:25</div>
            <table>
              <tr><th>着</th><th>車番</th><th>選手名</th><th>府県</th></tr>
              <tr><td>1</td><td>9</td><td>吉田 拓矢</td><td>茨城</td></tr>
            </table>
            """
        )
    )
    assert parsed == {"time": "20:30", "winner": "吉田 拓矢"}


def test_autorace_official_schedule_winner_parser() -> None:
    records = [
        {
            "date": "2026-07-20",
            "sport": "auto",
            "venue": "川口",
            "grade": "GⅠ",
            "name": "キューポラ杯",
            "time": "20:45",
            "winner": "",
        }
    ]
    patches = grade_schedule_patches(
        records,
        soup(
            """
            <table>
              <tr><td>GI</td><td>キューポラ杯(ナイター)</td><td>2026年7月16日(木)～7月20日(月・祝)</td><td>川口</td><td>青山 周平</td><td>14億6220万3300円</td></tr>
            </table>
            """
        ),
        "https://autorace.jp/calendar/graderace/",
    )
    assert len(patches) == 1
    assert patches[0].fields == {"winner": "青山 周平"}

from scripts.master_schedule import (  # noqa: E402
    MasterRecord,
    parse_autorace_master,
    parse_boat_master,
    parse_jra_master,
    parse_keirin_master,
    parse_nar_master,
    reconcile,
)


def test_master_jra_parser() -> None:
    parsed = parse_jra_master(
        soup(
            """
            <table><tr>
              <td>7月5日 日曜</td><td>GⅢ ラジオNIKKEI賞</td><td>福島</td>
              <td>3歳</td><td>芝1800</td><td>テストホース</td>
            </tr></table>
            """
        ),
        2026,
        "https://www.jra.go.jp/example",
    )
    assert parsed[0].date == "2026-07-05"
    assert parsed[0].grade == "GⅢ"
    assert parsed[0].winner == "テストホース"


def test_master_nar_parser() -> None:
    parsed = parse_nar_master(
        soup(
            """
            <h1>重賞競走一覧（2026年）</h1>
            <table><tr>
              <td>7/22</td><td>水</td><td>習志野きらっとスプリント</td>
              <td>SⅠ</td><td>船橋</td><td>1000m</td>
            </tr></table>
            """
        ),
        2026,
        "https://www.keiba.go.jp/gradedrace/schedule.html",
    )
    assert parsed[0].date == "2026-07-22"
    assert parsed[0].venue == "船橋"
    assert parsed[0].grade == "SⅠ"


def test_master_boat_parser() -> None:
    parsed = parse_boat_master(
        soup(
            """
            <table><tr>
              <td>7月</td><td>07/17-07/22</td><td>児島</td>
              <td><img alt="G3">シモデンカップ</td><td></td><td>リンク</td>
            </tr></table>
            """
        ),
        2026,
        "G3",
        "https://www.boatrace.jp/example",
    )
    assert parsed[0].date == "2026-07-22"
    assert parsed[0].name == "シモデンカップ"
    assert parsed[0].grade == "GⅢ"


def test_master_keirin_parser() -> None:
    parsed = parse_keirin_master(
        soup(
            """
            <table><tr>
              <td><img alt="G2"></td><td>第23回サマーナイトフェスティバル</td>
              <td>松阪(16～19)</td><td>7月</td>
            </tr></table>
            """
        ),
        2027,
        "https://keirin.jp/pc/graderaceschedule?scyy=2027",
    )
    assert parsed[0].date == "2027-07-19"
    assert parsed[0].venue == "松阪"
    assert parsed[0].grade == "GⅡ"


def test_master_autorace_parser() -> None:
    parsed = parse_autorace_master(
        soup(
            """
            <table><tr>
              <td>GII</td><td>浜松記念 曳馬野賞</td>
              <td>2026年7月29日(水)～2026年8月2日(日)</td>
              <td>浜松</td><td></td>
            </tr></table>
            """
        ),
        "https://autorace.jp/calendar/graderace/",
    )
    assert parsed[0].date == "2026-08-02"
    assert parsed[0].venue == "浜松"
    assert parsed[0].grade == "GⅡ"


def test_master_reconcile_adds_and_updates_without_deleting_time_on_name_change() -> None:
    current = [
        {
            "date": "2026-07-22",
            "time": "17:50",
            "sport": "boat",
            "venue": "児島",
            "grade": "GⅢ",
            "name": "企業杯",
            "winner": "",
        }
    ]
    official = [
        MasterRecord(
            "2026-07-22",
            "boat",
            "児島",
            "GⅢ",
            "シモデンカップ",
            source_url="https://www.boatrace.jp/example",
        ),
        MasterRecord(
            "2026-07-25",
            "jra",
            "新潟",
            "GⅢ",
            "新規重賞",
            source_url="https://www.jra.go.jp/example",
        ),
    ]
    updated, changes, additions = reconcile(current, official, dt.date(2026, 7, 21))
    boat = next(item for item in updated if item["sport"] == "boat")
    assert boat["name"] == "シモデンカップ"
    assert boat["time"] == "17:50"
    assert len(changes) == 1
    assert len(additions) == 1
