/**
 * code-step.js の抽出ロジックを検証するテスト。
 * 実行: node zapier/code-step.test.js
 *
 * サンプルは実際の予約確認メール（LUXAS五反田東口）。
 * 以前の自動化は 6/29 10:10-11:10 と誤登録したため、
 * 正しい 6/28 20:10-21:40（90分）になることを確認する。
 */
const assert = require('assert');
const { parseReservation } = require('./code-step');

const sampleBody = [
  'この度は「LUXAS五反田東口（ラクサス五反田東口）」にご予約いただきありがとうございます。',
  '今回のご予約内容は以下のとおりです。',
  '',
  '------------------------------------',
  '2026-06-28（日） 20:10〜',
  '予約ID 241436141',
  '　☆お得☆ ご新規さま限定！今月のキャンペーン♪',
  '☆ご新規様限定☆お試し全身ボディケア90分（??8,800円）',
  '',
  '合計 10,230 円',
  '------------------------------------',
  'ご来店を心よりお待ちしております。',
].join('\n');

const r = parseReservation(sampleBody);
console.log(JSON.stringify(r, null, 2));

assert.strictEqual(r.startDateTime, '2026-06-28T20:10:00+09:00', '開始日時が不正');
assert.strictEqual(r.endDateTime, '2026-06-28T21:40:00+09:00', '終了日時が不正（90分加算）');
assert.strictEqual(r.durationMin, 90, '所要時間が不正');
assert.strictEqual(r.title, 'LUXAS五反田東口 - お試し全身ボディケア', 'タイトルが不正');
assert.strictEqual(r.storeName, 'LUXAS五反田東口', '店舗名が不正');
assert.strictEqual(r.menu, 'お試し全身ボディケア', 'メニュー名が不正');
assert.strictEqual(r.reservationId, '241436141', '予約IDが不正');

// 深夜またぎ: 23:30 + 90分 = 翌01:00
const lateBody = '「テスト店」\n2026-06-28（日） 23:30〜\n☆お試し全身ボディケア90分（8,800円）';
const late = parseReservation(lateBody);
assert.strictEqual(late.startDateTime, '2026-06-28T23:30:00+09:00');
assert.strictEqual(late.endDateTime, '2026-06-29T01:00:00+09:00', '深夜またぎが不正');

console.log('\n✅ すべてのテストに合格しました');
