// MIRAI MOTORS — fictional stock, service and trade-in data (all invented).

export type BodyKey = 'kei' | 'compact' | 'minivan' | 'suv' | 'sedan';
export type Shape = 'keiTall' | 'keiWagon' | 'compact' | 'minivan' | 'suv' | 'sedan';

export const BODY: { key: BodyKey; jp: string; en: string }[] = [
  { key: 'kei', jp: '軽', en: 'K-CAR' },
  { key: 'compact', jp: 'コンパクト', en: 'COMPACT' },
  { key: 'minivan', jp: 'ミニバン', en: 'MINIVAN' },
  { key: 'suv', jp: 'SUV', en: 'SUV' },
  { key: 'sedan', jp: 'セダン', en: 'SEDAN' },
];
export const BODY_SHAPE: Record<BodyKey, Shape> = {
  kei: 'keiTall',
  compact: 'compact',
  minivan: 'minivan',
  suv: 'suv',
  sedan: 'sedan',
};

export type Paint = { name: string; hex: string };
export type Car = {
  id: string;
  body: BodyKey;
  shape: Shape;
  maker: string;
  model: string;
  grade: string;
  year: number;
  km: number; // kilometres
  shaken: string; // 車検満了
  repair: string; // 修復歴
  total: number; // 支払総額 (yen)
  base: number; // 車両本体価格 (yen)
  paint: Paint;
  paints: Paint[];
  cc: string;
  fuel: string;
  seats: number;
  drive: string;
  mission: string;
  size: [number, number, number]; // L W H (mm)
  note: string;
  tags: string[];
};

const P = {
  pearl: { name: 'パールホワイト', hex: '#e9e8e3' },
  silver: { name: 'シルバー', hex: '#aeb3b8' },
  black: { name: 'ブラック', hex: '#1b1d21' },
  navy: { name: 'ディープネイビー', hex: '#1f2f4d' },
  red: { name: 'ソウルレッド', hex: '#a3151c' },
  mint: { name: 'ミントグリーン', hex: '#9fcbb8' },
  blue: { name: 'スカイブルー', hex: '#3f7fbf' },
  olive: { name: 'オリーブ', hex: '#5f6446' },
  grey: { name: 'ガンメタル', hex: '#4b5057' },
  wine: { name: 'ワインレッド', hex: '#5c1a24' },
  beige: { name: 'サンドベージュ', hex: '#cdb999' },
  orange: { name: 'サンセットオレンジ', hex: '#d76a2c' },
};

export const CARS: Car[] = [
  {
    id: 'c01', body: 'kei', shape: 'keiTall', maker: 'ヒナタ', model: 'ポッケ', grade: 'X スライドドア', year: 2021, km: 28400,
    shaken: '2027年5月', repair: 'なし', total: 1328000, base: 1218000, paint: P.pearl, paints: [P.pearl, P.mint, P.black, P.beige],
    cc: '658cc', fuel: '21.2km/L', seats: 4, drive: '2WD', mission: 'CVT', size: [3395, 1475, 1785],
    note: '両側スライドドア。後席が広く、チャイルドシートの乗せ降ろしが楽です。', tags: ['ワンオーナー', '禁煙車'],
  },
  {
    id: 'c02', body: 'kei', shape: 'keiWagon', maker: 'アサギ', model: 'コロン', grade: 'L', year: 2019, km: 46200,
    shaken: '2026年12月', repair: 'なし', total: 849000, base: 768000, paint: P.mint, paints: [P.mint, P.pearl, P.beige],
    cc: '658cc', fuel: '25.4km/L', seats: 4, drive: '2WD', mission: 'CVT', size: [3395, 1475, 1640],
    note: '毎日の買い物や通勤に。燃費がよく、維持費をおさえたい方に。', tags: ['禁煙車'],
  },
  {
    id: 'c03', body: 'kei', shape: 'keiTall', maker: 'トキワ', model: 'ルクス', grade: 'ターボ', year: 2023, km: 11800,
    shaken: '2027年9月', repair: 'なし', total: 1620000, base: 1498000, paint: P.navy, paints: [P.navy, P.pearl, P.silver],
    cc: '658cc ターボ', fuel: '19.6km/L', seats: 4, drive: '2WD', mission: 'CVT', size: [3395, 1475, 1780],
    note: 'ターボ付きで高速の合流も余裕。安全装備が充実した上級グレード。', tags: ['メーカー保証', '衝突軽減'],
  },
  {
    id: 'c04', body: 'compact', shape: 'compact', maker: 'ミズホ', model: 'ステラ', grade: 'ハイブリッド Z', year: 2020, km: 39100,
    shaken: '2026年10月', repair: 'なし', total: 1485000, base: 1362000, paint: P.red, paints: [P.red, P.pearl, P.grey],
    cc: '1,490cc HV', fuel: '30.2km/L', seats: 5, drive: '2WD', mission: 'CVT', size: [3995, 1695, 1525],
    note: '街乗りでほとんどエンジンがかからない、静かなハイブリッド。', tags: ['禁煙車', 'ナビ・ETC'],
  },
  {
    id: 'c05', body: 'compact', shape: 'compact', maker: 'ヒナタ', model: 'ピコ', grade: 'S', year: 2017, km: 64500,
    shaken: '2026年8月', repair: 'あり（フロント・軽微）', total: 598000, base: 518000, paint: P.silver, paints: [P.silver, P.blue],
    cc: '1,240cc', fuel: '20.8km/L', seats: 5, drive: '2WD', mission: 'CVT', size: [3890, 1695, 1510],
    note: 'バンパー交換歴あり（骨格部位の損傷なし）。そのぶん、お手頃な価格です。', tags: ['修復歴を開示'],
  },
  {
    id: 'c06', body: 'compact', shape: 'compact', maker: 'アサギ', model: 'リズム', grade: 'e', year: 2024, km: 7600,
    shaken: '2027年3月', repair: 'なし', total: 2140000, base: 1985000, paint: P.blue, paints: [P.blue, P.pearl, P.orange],
    cc: '1,190cc HV', fuel: '28.0km/L', seats: 5, drive: '2WD', mission: 'CVT', size: [3940, 1695, 1520],
    note: '登録済み未使用に近い一台。最新の運転支援つき。', tags: ['メーカー保証', '衝突軽減'],
  },
  {
    id: 'c07', body: 'minivan', shape: 'minivan', maker: 'トキワ', model: 'ファミリア', grade: 'G 8人乗り', year: 2019, km: 55300,
    shaken: '2026年11月', repair: 'なし', total: 2380000, base: 2215000, paint: P.black, paints: [P.black, P.pearl, P.silver],
    cc: '1,980cc', fuel: '14.6km/L', seats: 8, drive: '2WD', mission: 'CVT', size: [4695, 1695, 1850],
    note: '3列シートの8人乗り。部活の送迎や帰省に。', tags: ['両側電動スライド', '後席モニター'],
  },
  {
    id: 'c08', body: 'minivan', shape: 'minivan', maker: 'ミズホ', model: 'ハコブネ', grade: 'ハイブリッド S', year: 2022, km: 31000,
    shaken: '2028年1月', repair: 'なし', total: 2890000, base: 2702000, paint: P.pearl, paints: [P.pearl, P.navy, P.black],
    cc: '1,790cc HV', fuel: '23.0km/L', seats: 7, drive: '2WD', mission: 'CVT', size: [4695, 1730, 1895],
    note: 'ハイブリッドのミニバン。長距離でも疲れにくい運転支援つき。', tags: ['ワンオーナー', '禁煙車'],
  },
  {
    id: 'c09', body: 'suv', shape: 'suv', maker: 'アサギ', model: 'トレイル', grade: '4WD', year: 2020, km: 42100,
    shaken: '2026年9月', repair: 'なし', total: 2650000, base: 2468000, paint: P.olive, paints: [P.olive, P.beige, P.black],
    cc: '1,990cc', fuel: '15.8km/L', seats: 5, drive: '4WD', mission: 'AT', size: [4600, 1855, 1690],
    note: '雪道もキャンプ場も。ルーフレールつきで荷物もたっぷり。', tags: ['4WD', 'ルーフレール'],
  },
  {
    id: 'c10', body: 'suv', shape: 'suv', maker: 'ヒナタ', model: 'ソラ', grade: 'クロス', year: 2022, km: 20400,
    shaken: '2027年7月', repair: 'なし', total: 3180000, base: 2986000, paint: P.grey, paints: [P.grey, P.pearl, P.red],
    cc: '1,490cc ターボ', fuel: '16.4km/L', seats: 5, drive: '2WD', mission: 'AT', size: [4545, 1840, 1655],
    note: '街に似合うSUV。パワーバックドアで荷物の出し入れも楽に。', tags: ['禁煙車', 'パワーバックドア'],
  },
  {
    id: 'c11', body: 'sedan', shape: 'sedan', maker: 'トキワ', model: 'セイラン', grade: '2.0 L', year: 2018, km: 71200,
    shaken: '2026年7月', repair: 'なし', total: 1580000, base: 1452000, paint: P.wine, paints: [P.wine, P.black, P.pearl],
    cc: '1,990cc', fuel: '14.2km/L', seats: 5, drive: '2WD', mission: 'AT', size: [4850, 1840, 1455],
    note: '後席の乗り心地がよい、落ち着いたセダン。整備記録簿そろっています。', tags: ['記録簿あり'],
  },
  {
    id: 'c12', body: 'sedan', shape: 'sedan', maker: 'ミズホ', model: 'アカツキ', grade: 'ハイブリッド G', year: 2021, km: 34600,
    shaken: '2027年4月', repair: 'なし', total: 2790000, base: 2598000, paint: P.pearl, paints: [P.pearl, P.silver, P.navy],
    cc: '2,480cc HV', fuel: '24.8km/L', seats: 5, drive: '2WD', mission: 'CVT', size: [4885, 1840, 1445],
    note: '静かで燃費のよい上級セダン。本革シート・シートヒーター付き。', tags: ['本革', 'ワンオーナー'],
  },
];

export const man = (yen: number) => (yen / 10000).toFixed(1);

/** Monthly payment (yen) — equal instalments. */
export function monthly(principal: number, annualPct: number, n: number) {
  if (principal <= 0) return 0;
  const r = annualPct / 100 / 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -n)));
}

// ── 車検 ─────────────────────────────────────────────────────────────────
export const SHAKEN: { key: string; jp: string; note: string; basic: number; weight: number; jibai: number; stamp: number; w: number }[] = [
  { key: 'k', jp: '軽自動車', note: '660cc以下', basic: 19800, weight: 6600, jibai: 17540, stamp: 1800, w: 0.62 },
  { key: 's', jp: '小型乗用車', note: '車両重量 〜1.0t', basic: 24800, weight: 16400, jibai: 17650, stamp: 1800, w: 0.78 },
  { key: 'm', jp: '中型乗用車', note: '車両重量 〜1.5t', basic: 27800, weight: 24600, jibai: 17650, stamp: 1800, w: 0.9 },
  { key: 'l', jp: '大型乗用車', note: '車両重量 〜2.0t', basic: 30800, weight: 32800, jibai: 17650, stamp: 1800, w: 1 },
];

export const PARTS: { id: string; jp: string; x: number; y: number; items: string[]; cycle: string; cost: string }[] = [
  {
    id: 'light',
    jp: 'ライト',
    x: 378,
    y: 118,
    items: ['ヘッドライトの光軸・明るさ', 'ウインカー・ブレーキランプの点灯', 'レンズのくもり・黄ばみ'],
    cycle: '車検ごと（光量不足は車検に通りません）',
    cost: 'バルブ交換 ¥1,650〜 ／ レンズ磨き ¥6,600〜',
  },
  {
    id: 'battery',
    jp: 'バッテリー',
    x: 320,
    y: 100,
    items: ['電圧・始動性のテスト', '端子のゆるみ・腐食', '液量（開放型のみ）'],
    cycle: '2〜3年が交換の目安',
    cost: '交換 ¥9,900〜（工賃込み）',
  },
  {
    id: 'oil',
    jp: 'エンジンオイル',
    x: 352,
    y: 136,
    items: ['オイル量・汚れ・にじみ', 'オイルフィルターの状態', 'ベルト類の張り・ひび'],
    cycle: '5,000km または 6ヶ月ごと',
    cost: 'オイル交換 ¥3,300〜 ／ フィルター ¥1,540〜',
  },
  {
    id: 'brake',
    jp: 'ブレーキ',
    x: 318,
    y: 170,
    items: ['パッドの残量（mm単位で計測）', 'ディスクローターの摩耗', 'ブレーキフルードの劣化'],
    cycle: 'パッドは 3〜4万km が目安',
    cost: 'パッド交換 ¥8,800〜／1軸',
  },
  {
    id: 'tire',
    jp: 'タイヤ',
    x: 62,
    y: 170,
    items: ['溝の深さ（1.6mm未満は車検不可）', 'ひび割れ・偏摩耗', '空気圧・ホイールナット'],
    cycle: '4〜5年、または溝 4mm で交換を',
    cost: '組替え ¥2,200〜／本 ／ 保管 ¥13,200／年',
  },
];

export const MENUS = [
  { key: 'shaken', jp: '車検', min: 60, note: '最短60分・立会い' },
  { key: 'tenken', jp: '12ヶ月点検', min: 60, note: '法定点検' },
  { key: 'oil', jp: 'オイル交換', min: 20, note: '予約で待ち時間なし' },
  { key: 'tire', jp: 'タイヤ交換', min: 30, note: '履き替え・組替え' },
] as const;

export const SLOTS = ['10:00', '11:30', '13:30', '15:00', '16:30'];

/** Deterministic availability for a date (0 = full … 3 = plenty). */
export function availability(d: Date, slot: number) {
  const k = d.getFullYear() * 400 + (d.getMonth() + 1) * 32 + d.getDate();
  const h = Math.sin(k * 12.9898 + slot * 78.233) * 43758.5453;
  const f = h - Math.floor(h);
  const busy = d.getDay() === 0 || d.getDay() === 6 ? 0.35 : 0;
  return Math.max(0, Math.min(3, Math.floor((f - busy) * 4.2)));
}

// ── 買取 ─────────────────────────────────────────────────────────────────
const NEW_PRICE: Record<BodyKey, number> = { kei: 170, compact: 230, minivan: 350, suv: 360, sedan: 390 };
const DEMAND: Record<BodyKey, number> = { kei: 1.08, compact: 0.98, minivan: 1.04, suv: 1.12, sedan: 0.9 };

/** Rough trade-in range in 万円 for the quick estimate. */
export function estimate(body: BodyKey, year: number, km: number) {
  const age = Math.max(0, 2026 - year);
  const expected = Math.max(8000, age * 9000);
  const kmF = Math.max(0.3, 1 - km / 240000) * (km < expected * 0.8 ? 1.06 : km > expected * 1.3 ? 0.9 : 1);
  const v = NEW_PRICE[body] * 0.82 * Math.pow(0.855, age) * kmF * DEMAND[body];
  const lo = Math.max(3, Math.round(v * 0.86));
  const hi = Math.max(lo + 3, Math.round(v * 1.1));
  return [lo, hi] as const;
}
