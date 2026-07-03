/**
 * guard-step.js の検証。実行: node zapier/guard-step.test.js
 */
const assert = require('assert');
const { guardReservation } = require('./guard-step');

// --- 1. 既知書式（peakmanager）: AI出力を無視して正規表現で確定 ---
const peakBody = [
  'この度は「LUXAS五反田東口（ラクサス五反田東口）」にご予約いただきありがとうございます。',
  '2026-06-28（日） 20:10〜',
  '予約ID 241436141',
  '☆ご新規様限定☆お試し全身ボディケア90分（??8,800円）',
].join('\n');
const r1 = guardReservation({
  emailBody: peakBody,
  aiStart: '2026-06-29T10:10', // AIがまた間違えても…
  aiTitle: '間違ったタイトル',
});
assert.strictEqual(r1.source, 'regex');
assert.strictEqual(r1.startDateTime, '2026-06-28T20:10:00+09:00', '既知書式: 開始');
assert.strictEqual(r1.endDateTime, '2026-06-28T21:40:00+09:00', '既知書式: 終了');
assert.strictEqual(r1.title, 'LUXAS五反田東口 - お試し全身ボディケア');

// --- 2. 未知書式 + AIが正しい → 照合に通って採用 ---
const meetingBody =
  'お世話になっております。打ち合わせは 7月10日 14:00 より1時間、弊社会議室にて。';
const r2 = guardReservation({
  emailBody: meetingBody,
  aiStart: '2026-07-10T14:00',
  aiEnd: '2026-07-10T15:00',
  aiTitle: '打ち合わせ',
});
assert.strictEqual(r2.source, 'ai-validated');
assert.strictEqual(r2.startDateTime, '2026-07-10T14:00:00+09:00', 'AI正: 開始');
assert.strictEqual(r2.endDateTime, '2026-07-10T15:00:00+09:00', 'AI正: 終了');

// --- 3. 未知書式 + AIが時刻を取り違え（14:00→02:00相当のズレ）→ 止まる ---
assert.throws(
  () =>
    guardReservation({
      emailBody: meetingBody,
      aiStart: '2026-07-10T02:00',
      aiTitle: '打ち合わせ',
    }),
  /検証NG: AIの開始時刻/,
  'AM/PM取り違えを検出できていない'
);

// --- 4. 未知書式 + AIが日付をずらす → 止まる ---
assert.throws(
  () =>
    guardReservation({
      emailBody: meetingBody,
      aiStart: '2026-07-11T14:00',
      aiTitle: '打ち合わせ',
    }),
  /検証NG: AIの日付/,
  '日付ずれを検出できていない'
);

// --- 5. AI出力が解釈不能 → 止まる ---
assert.throws(
  () => guardReservation({ emailBody: meetingBody, aiStart: '来週の木曜' }),
  /解釈できません/,
  '不正なAI出力を検出できていない'
);

console.log('✅ guard-step: すべてのテストに合格しました');
