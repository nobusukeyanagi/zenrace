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

`.github/workflows/daily-update.yml`が、重賞情報の更新、GitHub Pagesへの公開、Discord通知を行います。
