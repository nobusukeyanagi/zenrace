# 開催日程

`monthly.js`の年間開催日程を表示します。

## 毎日1時のスマート更新

GitHub Actionsでは、リポジトリ直下で次を実行します。

```bash
python -m monthly.scripts.update_schedule --smart --fail-if-all-sources-fail
```

基準日を指定して確認する場合：

```bash
python -m monthly.scripts.update_schedule --date 2026-08-03 --smart
```

更新範囲はグレードレース更新と共通です。

- 前日
- 当日から14日後まで
- 過去90日以内で、以前の公式取得に失敗して未解決となっている日付・競技
- 当日から15日後以降は、翌月末までの公式月間表を確認し、未登録の開催だけを追加

通常更新範囲では、取得に成功した競技を0件の場合も含めて公式結果へ置換します。取得に失敗した競技だけ既存データを維持し、`schedule_sync_state.json`へ未解決として保存します。翌日以降、90日以内は自動的に再確認します。

同一月の公式月間表は1回の実行内で再利用し、日付ごとの確認で同じページを繰り返し取得しません。同一日・同一競技・同一場の重複は書き込み前に停止します。実行結果は`monthly_update_report.json`へ保存します。

## 1日だけの手動更新

```bash
python -m monthly.scripts.update_schedule --date 2026-08-03
```

指定日だけを5競技の公式情報と照合します。

## 検証済み月間表からの全置換

公式月間表を日単位へ展開したスナップショットは、`monthly/data/official_schedule.json`に保存します。月内の日付不足、未知の開催場、重複、時間帯表記をすべて検証してから、対象月を一括で置換します。

```bash
python -m monthly.scripts.update_schedule --month 2026-07
python -m monthly.scripts.update_schedule --month 2026-08
```

月単位で一括反映するため、一部の日だけ古い開催情報が残る状態を防げます。
