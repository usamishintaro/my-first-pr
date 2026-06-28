# Gmail → Google カレンダー 自動登録（Zapier）

予約確認メールから Google カレンダーへ予定を自動登録する Zapier ワークフロー。

## 直近の不具合と原因

予約確認メール（正）に対し、カレンダー登録が次のようにズレていた:

| 項目 | メール本文（正） | 誤登録 |
|---|---|---|
| 日付 | 2026-06-28（日） | 6月29日（月） |
| 開始時刻 | 20:10 | 10:10 |
| 終了時刻 | 21:40（90分） | 11:10（60分） |

原因は、日時の解析を AI 推測に任せていたこと。`20:10 → 10:10`（AM/PM・24時間表記の取り違え）、`28 → 29`（日付ずれ）、所要時間 90 分の無視が同時に起きていた。

## 対策

このメールは `2026-06-28（日） 20:10〜` / `お試し全身ボディケア90分` のように**書式が固定**なので、AI ではなく**正規表現で機械的に抽出**する [`zapier/code-step.js`](zapier/code-step.js) に置き換える。日時は `+09:00` 付き ISO8601 で出力するため、タイムゾーンの取り違えが起きない。

## Zapier 設定手順

1. **Trigger**: Gmail → *New Email Matching Search*
   - Search String 例: `from:(予約確認の送信元) subject:(ご予約)`
2. **Action**: Code by Zapier → *Run JavaScript*
   - **Input Data** に以下を設定:
     - `emailBody` = Gmail トリガーの **Body Plain**（プレーンテキスト本文）
     - `emailSubject` = Gmail トリガーの **Subject**（任意）
   - **Code** 欄に [`zapier/code-step.js`](zapier/code-step.js) の中身をそのまま貼り付け
3. **Action**: Google Calendar → *Create Detailed Event*
   - **Summary** = ステップ2の出力 `title`
   - **Start Date & Time** = ステップ2の出力 `startDateTime`
   - **End Date & Time** = ステップ2の出力 `endDateTime`
   - ※ Google Calendar アクション側の **Timezone は空欄**にする。`startDateTime` / `endDateTime` に `+09:00` が含まれており、二重指定すると再びズレる原因になる。

## Code ステップの出力フィールド

| フィールド | 例 |
|---|---|
| `title` | `LUXAS五反田東口 - お試し全身ボディケア` |
| `startDateTime` | `2026-06-28T20:10:00+09:00` |
| `endDateTime` | `2026-06-28T21:40:00+09:00` |
| `durationMin` | `90` |
| `menu` | `お試し全身ボディケア` |
| `storeName` | `LUXAS五反田東口` |
| `reservationId` | `241436141` |

## テスト

```bash
node zapier/code-step.test.js
```

実際の予約メールを元に、`6/28 20:10–21:40（90分）` へ正しく変換されること、深夜またぎ（23:30+90分→翌01:00）が正しいことを検証する。
