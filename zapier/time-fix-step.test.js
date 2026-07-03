/**
 * time-fix-step.js の検証。実行: node zapier/time-fix-step.test.js
 */
const assert = require('assert');
const { fixTimes } = require('./time-fix-step');

// 1. 予約メール定型: AIが間違えても本文から確定（今回の事故の再現）
const peakBody =
  '「LUXAS五反田東口（ラクサス五反田東口）」\n2026-06-28（日） 20:10〜\n予約ID 241436141\n☆お試し全身ボディケア90分（8,800円）';
const r1 = fixTimes({ emailBody: peakBody, aiStart: '2026-06-29T10:10' });
assert.strictEqual(r1.startDateTime, '2026-06-28T20:10:00+09:00');
assert.strictEqual(r1.endDateTime, '2026-06-28T21:40:00+09:00');

// 2. 定型なし + AIが正しい → そのまま採用
const mtg = '打ち合わせは 7月10日 14:00 より1時間。';
const r2 = fixTimes({ emailBody: mtg, aiStart: '2026-07-10T14:00', aiEnd: '2026-07-10T15:00' });
assert.strictEqual(r2.startDateTime, '2026-07-10T14:00:00+09:00');
assert.strictEqual(r2.endDateTime, '2026-07-10T15:00:00+09:00');

// 3. 定型なし + AIが時刻取り違え → 登録せず停止
assert.throws(
  () => fixTimes({ emailBody: mtg, aiStart: '2026-07-10T02:00' }),
  /時刻取り違え/
);

console.log('✅ time-fix-step: すべてのテストに合格しました');
