# 開催日程

`monthly.js`の年間開催日程を表示します。

## 毎日の公式情報更新

リポジトリ直下で次を実行します。

```bash
python -m monthly.scripts.update_schedule
```

日付指定：

```bash
python -m monthly.scripts.update_schedule --date 2026-08-03
```

当日の開催場を、KEIRIN.JP、AutoRace.JP、BOAT RACE、地方競馬情報サイト、JRAの公式ページと照合します。

- 取得に成功した競技は、0件の場合を含め公式結果へ置換します。
- 公式ページの取得に失敗した競技だけ、既存データを維持します。
- 同一日・同一競技・同一場の重複は書き込み前に停止します。
- 取得結果は`monthly_update_report.json`へ保存します。

## 検証済み月間表からの全置換

公式月間表を日単位へ展開したスナップショットは、`monthly/data/official_schedule.json`に保存します。月内の日付不足、未知の開催場、重複、時間帯表記をすべて検証してから、対象月を一括で置換します。

```bash
python -m monthly.scripts.update_schedule --month 2026-07
python -m monthly.scripts.update_schedule --month 2026-08
```

月単位で一括反映するため、一部の日だけ古い開催情報が残る状態を防げます。公式発表後に開催変更・中止が発生した場合は、毎日の公式情報更新で当日分を反映します。
