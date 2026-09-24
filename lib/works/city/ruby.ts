// Tiny markup for hand-authored furigana: "{漢字|かんじ}".
// Every key text is authored as [normal, やさしい日本語] (Tx).
export type Tx = string | readonly [string, string];
export type Seg = string | { b: string; r: string };

const RE = /\{([^|{}]+)\|([^{}]+)\}/g;

export function parseRuby(s: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  RE.lastIndex = 0;
  for (let m = RE.exec(s); m; m = RE.exec(s)) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push({ b: m[1], r: m[2] });
    last = RE.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** base text only (kanji) */
export const plain = (s: string) => s.replace(RE, '$1');
/** readings only (kana) — used for search */
export const reading = (s: string) => s.replace(RE, '$2');
export const pick = (t: Tx, easy: boolean) =>
  typeof t === 'string' ? t : easy ? t[1] : t[0];
export const plainTx = (t: Tx, easy = false) => plain(pick(t, easy));

/** normalize for search: katakana → hiragana, full-width → half-width, lower */
export function norm(s: string) {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・、。「」（）()ー－―‐-]/g, '');
}
