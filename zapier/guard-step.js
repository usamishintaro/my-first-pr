/**
 * Zapier「Code by Zapier (JavaScript)」用の検証ステップ。
 * AI by Zapier ステップの直後・Google Calendar ステップの直前に置く。
 *
 * 動作:
 *   1. 本文が既知の予約メール書式（peakmanager 等の
 *      `YYYY-MM-DD（曜） HH:MM〜` + `NN分`）なら、AIの出力を使わず
 *      正規表現で確実に抽出する。
 *   2. それ以外のメールは AI の抽出結果を使うが、
 *      「AIが出した日付・時刻が本文に実在するか」を照合し、
 *      一致しなければイベントを作らずエラーで止める
 *      （間違った予定を静かに登録するより、失敗通知の方が安全）。
 *
 * Zapier 側の Input Data:
 *   emailBody = Gmail トリガーの「Body Plain」
 *   aiStart   = AI ステップが出した開始日時（例: 2026-06-28T20:10 / 2026-06-28 20:10）
 *   aiEnd     = AI ステップが出した終了日時（任意）
 *   aiTitle   = AI ステップが出したタイトル（任意）
 *
 * 出力: title / startDateTime / endDateTime（+09:00 付き ISO8601）/ source
 *   Google Calendar には startDateTime / endDateTime / title を割り当てる。
 */
function guardReservation(input) {
  const body = String(input.emailBody || '').replace(/　/g, ' ');
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (t) =>
    `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(
      t.getUTCHours()
    )}:${pad(t.getUTCMinutes())}:00+09:00`;
  const jst = (y, mo, d, h, mi) => new Date(Date.UTC(y, mo - 1, d, h, mi));

  // --- 経路1: 既知書式なら正規表現で確定（AIより優先） ---
  const dt = body.match(
    /(\d{4})-(\d{2})-(\d{2})\s*[（(][^）)]*[）)]\s*(\d{1,2}):(\d{2})/
  );
  if (dt) {
    const [, y, mo, d, h, mi] = dt.map(Number);
    const dur = body.match(/(\d{1,3})\s*分/);
    const durationMin = dur ? parseInt(dur[1], 10) : 60;
    const store = (body.match(/「([^（(」]+)/) || [, ''])[1].trim();
    const menuM = body.match(/☆([^☆（(]*?)\d{1,3}\s*分/);
    const menu = menuM ? menuM[1].replace(/^[☆\s]+/, '').trim() : '';
    const start = jst(y, mo, d, h, mi);
    const end = new Date(start.getTime() + durationMin * 60000);
    const title =
      (menu ? `${store} - ${menu}` : store) || String(input.aiTitle || '予定');
    return {
      source: 'regex',
      title,
      startDateTime: fmt(start),
      endDateTime: fmt(end),
    };
  }

  // --- 経路2: AI の抽出結果を本文と照合してから採用 ---
  const s = String(input.aiStart || '');
  const m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})/);
  if (!m) {
    throw new Error(`AI出力の開始日時を解釈できません: "${s}"`);
  }
  const [, y, mo, d, h, mi] = m.map(Number);

  // 時刻の照合: 「H:MM」または「HH:MM」または「HH時MM分」が本文に実在するか。
  // 20:10 を 10:10 と取り違えた場合、10:10 は本文に無いのでここで止まる。
  const timeRe = new RegExp(
    `(^|[^\\d])(${h}|${pad(h)}):${pad(mi)}|${h}時${mi ? pad(mi) + '分' : ''}`
  );
  if (!timeRe.test(body)) {
    throw new Error(
      `検証NG: AIの開始時刻 ${pad(h)}:${pad(mi)} が本文に存在しません（AM/PM取り違えの可能性）。イベントは作成しません。`
    );
  }

  // 日付の照合: 2026-06-28 / 2026/06/28 / 6月28日 / 06月28日 のいずれかが本文に実在するか
  const dateOk =
    body.includes(`${y}-${pad(mo)}-${pad(d)}`) ||
    body.includes(`${y}/${pad(mo)}/${pad(d)}`) ||
    body.includes(`${y}/${mo}/${d}`) ||
    body.includes(`${mo}月${d}日`) ||
    body.includes(`${pad(mo)}月${pad(d)}日`);
  if (!dateOk) {
    throw new Error(
      `検証NG: AIの日付 ${y}-${pad(mo)}-${pad(d)} が本文に存在しません（日付ずれの可能性）。イベントは作成しません。`
    );
  }

  const start = jst(y, mo, d, h, mi);

  // 終了時刻: 本文の「NN分」→ AIの終了時刻 → 60分、の優先順
  let end;
  const dur = body.match(/(\d{1,3})\s*分/);
  if (dur) {
    end = new Date(start.getTime() + parseInt(dur[1], 10) * 60000);
  } else {
    const e = String(input.aiEnd || '').match(
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})/
    );
    if (e) {
      const [, ey, emo, ed, eh, emi] = e.map(Number);
      end = jst(ey, emo, ed, eh, emi);
    }
    if (!end || end <= start) {
      end = new Date(start.getTime() + 60 * 60000);
    }
  }

  return {
    source: 'ai-validated',
    title: String(input.aiTitle || '予定'),
    startDateTime: fmt(start),
    endDateTime: fmt(end),
  };
}

// ===== Zapier 実行部 =====
if (typeof inputData !== 'undefined') {
  output = guardReservation(inputData);
}

// テスト用エクスポート（Zapier では参照されない）
if (typeof module !== 'undefined') {
  module.exports = { guardReservation };
}
