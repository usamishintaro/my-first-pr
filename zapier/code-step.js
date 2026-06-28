/**
 * Zapier「Code by Zapier (JavaScript)」ステップにそのまま貼り付けて使うコード。
 *
 * 目的:
 *   予約確認メール本文から「日付・開始時刻・所要時間・メニュー・店舗名・予約ID」を
 *   正規表現で確実に抽出し、Google カレンダー登録用の値を生成する。
 *   AI解析に任せると 20:10→10:10（AM/PM取り違え）や日付ずれが起きるため、
 *   ここでは推測を一切させず、決まった書式から機械的に取り出す。
 *
 * Zapier 側の設定:
 *   - Input Data:
 *       emailBody    = Gmail トリガーの「Body Plain」(本文プレーンテキスト)
 *       emailSubject = Gmail トリガーの「Subject」(任意)
 *   - 後続の Google Calendar「Create Detailed Event」アクションには
 *       Start Date & Time = この出力の startDateTime
 *       End Date & Time   = この出力の endDateTime
 *       Summary           = この出力の title
 *     を割り当てる。startDateTime / endDateTime は +09:00 付き ISO8601 なので
 *     タイムゾーンの取り違えが起きない。
 */

// inputData / output は Zapier が用意するグローバル。
// このファイル末尾の module.exports はテスト用で、Zapier では無視される。
function parseReservation(rawBody, rawSubject) {
  // 全角スペースを半角に正規化（書式ゆれ対策）
  const body = String(rawBody || '').replace(/　/g, ' ');

  // --- 1. 店舗名 ---
  // 例: この度は「LUXAS五反田東口（ラクサス五反田東口）」にご予約...
  let storeName = '';
  const storeMatch = body.match(/「([^（(」]+)/);
  if (storeMatch) storeName = storeMatch[1].trim();

  // --- 2. 日付 + 開始時刻 ---
  // 例: 2026-06-28（日） 20:10〜
  const dtMatch = body.match(
    /(\d{4})-(\d{2})-(\d{2})\s*[（(][^）)]*[）)]\s*(\d{1,2}):(\d{2})/
  );
  if (!dtMatch) {
    throw new Error(
      '予約日時を抽出できませんでした。メール本文の形式が変わった可能性があります。'
    );
  }
  const year = parseInt(dtMatch[1], 10);
  const month = parseInt(dtMatch[2], 10);
  const day = parseInt(dtMatch[3], 10);
  const hour = parseInt(dtMatch[4], 10);
  const minute = parseInt(dtMatch[5], 10);

  // --- 3. 所要時間（分） ---
  // 例: お試し全身ボディケア90分
  const durMatch = body.match(/(\d{1,3})\s*分/);
  const durationMin = durMatch ? parseInt(durMatch[1], 10) : 60;

  // --- 4. メニュー名 ---
  // 例: ☆ご新規様限定☆お試し全身ボディケア90分（??8,800円）
  let menu = '';
  const menuMatch = body.match(/☆([^☆（(]*?)\d{1,3}\s*分/);
  if (menuMatch) menu = menuMatch[1].replace(/^[☆\s]+/, '').trim();

  // --- 5. 予約ID ---
  const idMatch = body.match(/予約ID\s*([0-9]+)/);
  const reservationId = idMatch ? idMatch[1] : '';

  // --- 6. 開始・終了を +09:00(JST) の ISO8601 で組み立てる ---
  // Date.UTC で「壁掛け時計の値」をそのまま作り、UTC ゲッターで読み戻して
  // 末尾に +09:00 を付ける。ローカルTZの影響を受けず、所要時間ぶん加算しても
  // 日付の繰り上がり（深夜またぎ）まで正しく処理される。
  const pad = (n) => String(n).padStart(2, '0');
  const startUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const endUtc = new Date(startUtc.getTime() + durationMin * 60000);
  const fmt = (dt) =>
    `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
      dt.getUTCDate()
    )}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:00+09:00`;

  const title = menu ? `${storeName} - ${menu}` : storeName;

  return {
    title,
    storeName,
    menu,
    reservationId,
    durationMin,
    startDateTime: fmt(startUtc),
    endDateTime: fmt(endUtc),
  };
}

// ===== Zapier 実行部 =====
// Zapier 上では inputData / output が必ず存在する。
// Node でのテスト時（require した場合）はここを実行しない。
if (typeof inputData !== 'undefined') {
  output = parseReservation(inputData.emailBody, inputData.emailSubject);
}

// テスト用エクスポート（Zapier では参照されない）
if (typeof module !== 'undefined') {
  module.exports = { parseReservation };
}
