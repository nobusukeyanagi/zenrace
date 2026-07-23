# zenrace

公営競技に関する情報を分かりやすく提供する、スマートフォンアプリ構想のデモプロジェクトです。

## 公開ページ

- トップページ  
  https://nobusukeyanagi.github.io/zenrace/

- 公営競技重賞日程  
  https://nobusukeyanagi.github.io/zenrace/gradedraces/

## ディレクトリ構成

```text
zenrace/
├─ index.html
├─ gradedraces/
│  ├─ index.html
│  ├─ races.json
│  ├─ config.json
│  └─ scripts/
├─ tests/
└─ .github/
   └─ workflows/
```

`.github/workflows/graded-race-update.yml`が、毎日25:00にグレード日程と当日の開催場を公式情報から更新します。更新がコミットされると、`deploy-website.yml`がGitHub Pagesを公開します。`notify-discord.yml`は毎日02:00に、グレードレースと開催場をまとめてDiscordへ通知します。

## 共通ボトムナビ

全ページ共通のボトムナビは `shared/bottom-nav.js` で管理します。
新しいページでは、`</body>` の直前に次を追加します。

```html
<zenrace-bottom-nav active="home"></zenrace-bottom-nav>
<script src="../shared/bottom-nav.js" defer></script>
```

`active` はページに応じて `home`、`schedule`、`vote`、`onair`、`mypage` を指定します。
ページの階層に合わせて `bottom-nav.js` への相対パスだけ調整してください。

