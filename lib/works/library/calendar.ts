// Opening calendar for みらい市立図書館 (fictional). Japanese public holidays are approximated by rule.

export const WD = ['日', '月', '火', '水', '木', '金', '土'];

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const nthWeekday = (y: number, m: number, wd: number, n: number) => {
  const first = new Date(y, m, 1).getDay();
  return 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
};

const holidayCache = new Map<number, Map<string, string>>();
export function holidays(y: number) {
  const hit = holidayCache.get(y);
  if (hit) return hit;
  const h = new Map<string, string>();
  const add = (m: number, d: number, name: string) => h.set(`${y}-${m}-${d}`, name);
  add(1, 1, '元日');
  add(1, nthWeekday(y, 0, 1, 2), '成人の日');
  add(2, 11, '建国記念の日');
  add(2, 23, '天皇誕生日');
  add(3, Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)), '春分の日');
  add(4, 29, '昭和の日');
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');
  add(7, nthWeekday(y, 6, 1, 3), '海の日');
  add(8, 11, '山の日');
  add(9, nthWeekday(y, 8, 1, 3), '敬老の日');
  add(9, Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4)), '秋分の日');
  add(10, nthWeekday(y, 9, 1, 2), 'スポーツの日');
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');
  // 振替休日・国民の休日
  const base = [...h.keys()];
  for (const k of base) {
    const [yy, mm, dd] = k.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    if (d.getDay() === 0) {
      const n = new Date(d);
      do n.setDate(n.getDate() + 1);
      while (h.has(ymd(n)));
      h.set(ymd(n), '振替休日');
    }
    const n2 = new Date(yy, mm - 1, dd + 2);
    const mid = new Date(yy, mm - 1, dd + 1);
    if (h.has(ymd(n2)) && !h.has(ymd(mid)) && mid.getDay() !== 0) h.set(ymd(mid), '国民の休日');
  }
  holidayCache.set(y, h);
  return h;
}

export type DayInfo = {
  date: Date;
  holiday?: string;
  closed: false | '月曜休館' | '館内整理日' | '特別整理期間' | '年末年始' | '振替休館';
  open?: [number, number];
};

function isHoliday(d: Date) {
  return holidays(d.getFullYear()).get(ymd(d));
}

/** 特別整理期間 (蔵書点検): 11月第2火曜から5日間 */
export function inventoryRange(y: number): [Date, Date] {
  const s = nthWeekday(y, 10, 2, 2);
  return [new Date(y, 10, s), new Date(y, 10, s + 4)];
}

export function dayInfo(d: Date): DayInfo {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const holiday = isHoliday(date);
  const m = date.getMonth();
  const day = date.getDate();
  const wd = date.getDay();
  const info: DayInfo = { date, holiday, closed: false };
  if ((m === 11 && day >= 29) || (m === 0 && day <= 4)) return { ...info, closed: '年末年始' };
  const [is, ie] = inventoryRange(date.getFullYear());
  if (date >= is && date <= ie) return { ...info, closed: '特別整理期間' };
  if (wd === 1 && !holiday) return { ...info, closed: '月曜休館' };
  // 月曜が祝日の場合は、その翌日以降の最初の平日が休館
  if (!holiday && wd !== 0 && wd !== 6) {
    const p = new Date(date);
    p.setDate(p.getDate() - 1);
    let chain = false;
    while (isHoliday(p)) {
      if (p.getDay() === 1) chain = true;
      p.setDate(p.getDate() - 1);
    }
    if (chain) return { ...info, closed: '振替休館' };
  }
  if (wd === 4 && day >= 15 && day <= 21 && !holiday) return { ...info, closed: '館内整理日' };
  const short = wd === 0 || wd === 6 || !!holiday;
  return { ...info, open: short ? [9, 18] : [9, 20] };
}

export function monthGrid(y: number, m: number) {
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (DayInfo | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(dayInfo(new Date(y, m, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

const hm = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`;
};
const md = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;

export function nextOpen(from: Date) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  for (let i = 0; i < 40; i++) {
    const info = dayInfo(d);
    if (info.open) return info;
    d.setDate(d.getDate() + 1);
  }
  return null;
}

export type LiveStatus = { state: 'open' | 'before' | 'after' | 'closed'; head: string; sub: string; progress: number };

export function liveStatus(now: Date): LiveStatus {
  const info = dayInfo(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  const nxt = nextOpen(now);
  const nxtText = nxt ? `次の開館は ${md(nxt.date)} ${nxt.open![0]}:00` : '';
  if (!info.open) {
    return { state: 'closed', head: '本日は休館日です', sub: `${info.closed}。${nxtText}から。返却ポストはご利用いただけます。`, progress: 0 };
  }
  const [o, c] = info.open;
  if (mins < o * 60) {
    return { state: 'before', head: `本日 ${o}:00 開館`, sub: `開館まであと${hm(o * 60 - mins)}。本日は ${c}:00 まで開いています。`, progress: 0 };
  }
  if (mins >= c * 60) {
    return { state: 'after', head: '本日の開館は終了しました', sub: `${nxtText}から。返却ポストは24時間ご利用いただけます。`, progress: 1 };
  }
  return {
    state: 'open',
    head: `本日 開館中・閉館まであと${hm(c * 60 - mins)}`,
    sub: `本日は ${o}:00〜${c}:00。${info.holiday ? `${info.holiday}のため18時閉館です。` : ''}`,
    progress: (mins - o * 60) / ((c - o) * 60),
  };
}

// ---------- events ----------
export type LibEvent = {
  id: string;
  kind: 'kids' | 'adult' | 'course';
  title: string;
  lead: string;
  dates: Date[];
  time: string;
  place: string;
  target: string;
  cap: string;
  left: number;
  fee: string;
  note: string;
};

function upcoming(from: Date, pick: (d: Date) => boolean, n: number, limit = 120) {
  const out: Date[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < limit && out.length < n; i++) {
    if (pick(d) && dayInfo(d).open) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
const nth = (d: Date) => Math.ceil(d.getDate() / 7);

export function events(from: Date): LibEvent[] {
  const y = from.getMonth() > 7 || (from.getMonth() === 7 && from.getDate() > 20) ? from.getFullYear() + 1 : from.getFullYear();
  const summer = upcoming(new Date(y, 6, 24), (d) => d.getDay() >= 2 && d.getDay() <= 5, 3, 30);
  return [
    {
      id: 'ohanashi', kind: 'kids', title: 'おはなし会', lead: '絵本の読み聞かせと、手あそび・わらべうた。',
      dates: upcoming(from, (d) => d.getDay() === 6, 4), time: '11:00–11:30', place: '1F おはなしのへや',
      target: '3歳〜小学校低学年と保護者', cap: '20組', left: 7, fee: '無料', note: '当日参加もできます（先着順）。',
    },
    {
      id: 'baby', kind: 'kids', title: 'あかちゃんおはなし会', lead: 'ひざの上で楽しむ、はじめての絵本とわらべうた。',
      dates: upcoming(from, (d) => d.getDay() === 3 && (nth(d) === 2 || nth(d) === 4), 2), time: '10:30–11:00', place: '1F おはなしのへや',
      target: '0〜2歳のお子さんと保護者', cap: '12組', left: 3, fee: '無料', note: 'ベビーカー置き場があります。',
    },
    {
      id: 'roudoku', kind: 'adult', title: '大人のための朗読会', lead: '閉館前の静かな閲覧室で、元アナウンサーが『月の暦』を読みます。',
      dates: upcoming(from, (d) => d.getDay() === 5 && nth(d) === 2, 2), time: '19:00–20:00', place: '2F 閲覧室（特別配置）',
      target: '高校生以上', cap: '30名', left: 11, fee: '無料', note: '照明を落とした会場です。温かい飲みもの付き。',
    },
    {
      id: 'komonjo', kind: 'course', title: '古文書講座 くずし字を読む（全4回）', lead: '『みらい市史 資料編三 近世』の村の記録を、原本の写真で読み解きます。',
      dates: upcoming(new Date(from.getFullYear(), from.getMonth() + 1, 1), (d) => d.getDay() === 0 && (nth(d) === 1 || nth(d) === 3), 4),
      time: '14:00–16:00', place: '2F 郷土資料室', target: '一般（初心者歓迎）', cap: '20名', left: 4, fee: 'テキスト代 300円', note: '4回通しでのお申し込みです。',
    },
    {
      id: 'biblio', kind: 'adult', title: 'ビブリオバトル みらい杯', lead: '5分間で好きな本を紹介し、いちばん読みたくなった本を投票で決めます。',
      dates: upcoming(from, (d) => d.getDay() === 6 && nth(d) === 3, 2), time: '14:00–15:30', place: '2F 多目的室',
      target: '中学生〜大学生（観覧は どなたでも）', cap: '発表者 6名', left: 2, fee: '無料', note: '観覧のみの方は申込不要です。',
    },
    {
      id: 'jiyu', kind: 'course', title: '夏休み 自由研究相談室', lead: 'テーマ探しから資料の見つけ方、まとめ方まで。司書がいっしょに考えます。',
      dates: summer, time: '13:00–16:00（1組30分）', place: '1F こどものへや 調べものカウンター',
      target: '小学生・中学生（保護者同伴可）', cap: '各日12組', left: 12, fee: '無料', note: `受付は${y}年7月1日から。夏休み期間の平日に開きます。`,
    },
  ];
}

export const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`;
