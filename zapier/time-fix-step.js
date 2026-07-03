/**
 * 最小版: 日時のズレだけを直す Code ステップ。
 * AI ステップの直後に置き、Google Calendar の Start/End だけを
 * このステップの startDateTime / endDateTime に差し替える。
 * タイトル・場所など他のフィールドは従来どおり AI ステップの値を使う。
 *
 * Input Data:
 *   emailBody = Gmail トリガーの「Body Plain」
 *   aiStart   = AI ステップの開始日時
 *   aiEnd     = AI ステップの終了日時（任意）
 */
function fixTimes(input) {
  const body = String(input.emailBody || '').replace(/　/g, ' ');
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (t) =>
    `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(
      t.getUTCHours()
    )}:${pad(t.getUTCMinutes())}:00+09:00`;

  // 本文に日時が明記されていればそれを最優先（例: 2026-06-28（日） 20:10〜）
  let y, mo, d, h, mi;
  const dt = body.match(
    /(\d{4})-(\d{2})-(\d{2})\s*[（(][^）)]*[）)]\s*(\d{1,2}):(\d{2})/
  );
  if (dt) {
    [, y, mo, d, h, mi] = dt.map(Number);
  } else {
    // 本文に定型が無ければ AI の値を使うが、時刻が本文に実在するか照合する
    const m = String(input.aiStart || '').match(
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})/
    );
    if (!m) throw new Error('開始日時を特定できません: ' + input.aiStart);
    [, y, mo, d, h, mi] = m.map(Number);
    if (!new RegExp(`(^|[^\\d])(${h}|${pad(h)}):${pad(mi)}`).test(body)) {
      throw new Error(
        `AIの開始時刻 ${pad(h)}:${pad(mi)} が本文にありません（時刻取り違えの可能性）。登録を中止します。`
      );
    }
  }
  const start = new Date(Date.UTC(y, mo - 1, d, h, mi));

  // 終了: 本文の「NN分」→ AIの終了時刻 → 60分、の優先順
  let end = null;
  const dur = body.match(/(\d{1,3})\s*分/);
  if (dur) {
    end = new Date(start.getTime() + parseInt(dur[1], 10) * 60000);
  } else {
    const e = String(input.aiEnd || '').match(
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})/
    );
    if (e) {
      const [, ey, emo, ed, eh, emi] = e.map(Number);
      end = new Date(Date.UTC(ey, emo - 1, ed, eh, emi));
    }
    if (!end || end <= start) end = new Date(start.getTime() + 60 * 60000);
  }

  return { startDateTime: fmt(start), endDateTime: fmt(end) };
}

// ===== Zapier 実行部 =====
if (typeof inputData !== 'undefined') {
  output = fixTimes(inputData);
}

if (typeof module !== 'undefined') {
  module.exports = { fixTimes };
}
