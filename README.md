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

Zap は「会議・予約全般」を対象にしているため、AI ステップは残しつつ、その直後に**検証ステップ** [`zapier/guard-step.js`](zapier/guard-step.js) を挟む:

1. **既知の予約メール書式**（`2026-06-28（日） 20:10〜` + `NN分`、peakmanager 等）なら、AI の出力を使わず正規表現で確定する。
2. **それ以外のメール**は AI の抽出結果を使うが、「AI が出した日付・時刻の文字列が本文に実在するか」を照合する。一致しなければイベントを作らず**エラーで停止**する（間違った予定を静かに登録するより、Zapier の失敗通知の方が安全）。

日時はいずれも `+09:00` 付き ISO8601 で出力するため、タイムゾーンの取り違えが起きない。

単一の固定書式だけを扱う簡易版は [`zapier/code-step.js`](zapier/code-step.js)（AI ステップ自体を置き換える場合に使用）。

## Zapier 設定手順

1. **Trigger**: Gmail → *New Email Matching Search*
   - 対象メールが届く条件を設定（例: `subject:(ご予約 OR 予約確認 OR 打ち合わせ)`）。特定送信元に絞らない。
2. **Filter / AI by Zapier**: 既存のまま
3. **Action（追加）**: Code by Zapier → *Run JavaScript* — AI ステップの直後に挿入
   - **Input Data**:
     - `emailBody` = Gmail トリガーの **Body Plain**（プレーンテキスト本文）
     - `aiStart` = AI ステップの開始日時フィールド
     - `aiEnd` = AI ステップの終了日時フィールド（任意）
     - `aiTitle` = AI ステップのタイトルフィールド（任意）
   - **Code** 欄に [`zapier/guard-step.js`](zapier/guard-step.js) の中身をそのまま貼り付け
4. **Action**: Google Calendar → *Create Detailed Event*
   - **Summary** = 検証ステップの出力 `title`
   - **Start Date & Time** = 検証ステップの出力 `startDateTime`
   - **End Date & Time** = 検証ステップの出力 `endDateTime`
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
node zapier/guard-step.test.js
node zapier/code-step.test.js
```

実際の予約メールを元に `6/28 20:10–21:40（90分）` へ正しく変換されること、AI が時刻・日付を取り違えた場合に検証で停止すること、深夜またぎ（23:30+90分→翌01:00）が正しいことを検証する。
