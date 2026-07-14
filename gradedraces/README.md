# 公営競技重賞日程

`zenrace`内の、公営競技グレードレース日程ページです。

## 公開URL

https://nobusukeyanagi.github.io/zenrace/gradedraces/

## 対象競技

- JRA
- 地方競馬
- ボートレース
- 競輪
- オートレース

## 主なファイル

```text
gradedraces/
├─ index.html
├─ graded_races_schedule.html
├─ races.json
├─ config.json
├─ changes.json
├─ source_status.json
├─ discord_notification_state.json
├─ requirements.txt
└─ scripts/
```

- `races.json`：レース一覧データ
- `graded_races_schedule.html`：更新元となるHTML
- `index.html`：公開用HTML。自動更新時に上記HTMLから同期
- `changes.json`：直近の自動更新差分
- `source_status.json`：各公式サイトの取得状況
- `discord_notification_state.json`：当日の重複通知を防ぐ状態ファイル

## 自動更新

`.github/workflows/daily-update.yml`が、毎朝次の順で処理します。

1. 公式サイトから時刻・結果を取得
2. `races.json`とHTMLを更新
3. GitHub Pagesへ公開
4. 今回のページが公開されたことを確認
5. 当日のグレードレースをDiscordへ通知

通常実行は日本時間6:17、予備実行は6:47です。予備実行では、当日すでに通知済みならDiscordへ再送しません。

## GitHub設定

Repository secret：

```text
DISCORD_WEBHOOK_URL
```

Repository variable：

```text
SITE_URL=https://nobusukeyanagi.github.io/zenrace/gradedraces/
```

GitHub PagesのSourceは`GitHub Actions`を使用します。

## 手動実行

```text
Actions
→ Daily graded-race update
→ Run workflow
```

- `base_date`：空欄なら日本時間の当日
- `force_notify`：同じ日付でも再通知するときだけチェック
