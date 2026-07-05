/**
 * 最小版: 日時のズレだけを直す Code ステップ（サイレントスキップ版）。
 * AI ステップの直後に置き、Google Calendar の Start/End だけを
 * このステップの startDateTime / endDateTime に差し替える。
 *
 * 日時を安全に特定できないメールは、エラーを投げる代わりに
 * startDateTime を空で返す。直後の Filter ステップで
 * 「startDateTime が存在する場合のみ続行」とすることで、
 * エラー通知メールを出さずに登録だけを止められる。
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
  // 登録しない場合の出力。Filter ステップが startDateTime 空を見て止める。
  const SKIP = (reason) => ({
    startDateTime: '',
    endDateTime: '',
    status: 'skip: ' + reason,
  });

  // 本文に日時が明記されていればそれを最優先（例: 2026-06-28（日） 20:10〜）
  let y, mo, d, h, mi;
  const dt = body.match(
    /(\d{4})-(\d{2})-(\d{2})\s*[（(][^）)]*[）)]\s*(\d{1,2}):(\d{2})/
  );
  if (dt) {
    [, y, mo, d, h, mi] = dt.map(Number);
  } else {
    // 定型が無ければ AI の値を使うが、時刻が本文に実在するか照合する
    const m = String(input.aiStart || '').match(
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})/
    );
    if (!m) return SKIP('開始日時を特定できず');
    [, y, mo, d, h, mi] = m.map(Number);
    if (!new RegExp(`(^|[^\\d])(${h}|${pad(h)}):${pad(mi)}`).test(body)) {
      return SKIP(`AIの時刻 ${pad(h)}:${pad(mi)} が本文に無い`);
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

  return { startDateTime: fmt(start), endDateTime: fmt(end), status: 'ok' };
}

// ===== Zapier 実行部 =====
if (typeof inputData !== 'undefined') {
  output = fixTimes(inputData);
}

if (typeof module !== 'undefined') {
  module.exports = { fixTimes };
}
