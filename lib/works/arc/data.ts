/**
 * MIRAI ARC — product data (fictional). Prices are tax-included yen.
 * Everything here is invented for the portfolio sample.
 */

export type Paint = {
  id: string;
  jp: string;
  kana: string;
  en: string;
  hex: string;
  /** clear-coated paint parameters for the 3D material */
  metal: number;
  rough: number;
  pearl?: number;
  price: number;
  note?: string;
};

export const PAINTS: Paint[] = [
  { id: 'sakin', jp: '砂金', kana: 'さきん', en: 'Sakin Bronze', hex: '#a4825a', metal: 0.78, rough: 0.33, price: 110000, note: '発売記念色' },
  { id: 'hakuji', jp: '白磁', kana: 'はくじ', en: 'Hakuji Pearl', hex: '#e8e6e1', metal: 0.12, rough: 0.28, pearl: 0.45, price: 88000 },
  { id: 'ginnezumi', jp: '銀鼠', kana: 'ぎんねず', en: 'Ginnezumi Silver', hex: '#9da2a6', metal: 0.8, rough: 0.3, price: 55000 },
  { id: 'aitetsu', jp: '藍鉄', kana: 'あいてつ', en: 'Aitetsu Blue', hex: '#253648', metal: 0.66, rough: 0.33, price: 55000 },
  { id: 'kokiake', jp: '深緋', kana: 'こきあけ', en: 'Kokiake Red', hex: '#7c1b20', metal: 0.5, rough: 0.3, price: 55000 },
  { id: 'sumi', jp: '墨', kana: 'すみ', en: 'Sumi Black', hex: '#101114', metal: 0.35, rough: 0.26, price: 0 },
];

export type Wheel = { id: 'aero' | 'sport'; jp: string; size: string; tire: string; price: number; note: string };
export const WHEELS: Wheel[] = [
  { id: 'aero', jp: 'エアロ', size: '20インチ', tire: '245/45R20', price: 0, note: '5枚の羽根で空気を整える。航続距離を優先。' },
  { id: 'sport', jp: 'スポーク', size: '21インチ', tire: '265/35R21', price: 198000, note: '細い10本スポーク。ブレーキが覗く。' },
];

export type Interior = {
  id: string;
  jp: string;
  en: string;
  seat: string;
  accent: string;
  dash: string;
  trim: string;
  trimMetal: number;
  carpet: string;
  headliner: string;
  price: number;
  note: string;
};
export const INTERIORS: Interior[] = [
  { id: 'sumi', jp: '墨', en: 'Sumi', seat: '#17181b', accent: '#2c2d31', dash: '#121315', trim: '#6d6a66', trimMetal: 0.9, carpet: '#101113', headliner: '#2b2c2f', price: 0, note: 'ブラックのレザー調と、艶を抑えたアルミ。' },
  { id: 'kinari', jp: '生成', en: 'Kinari', seat: '#cfc6b8', accent: '#e4ddd2', dash: '#1d1d1f', trim: '#8b7a64', trimMetal: 0.1, carpet: '#2a2826', headliner: '#cbc3b5', price: 0, note: 'あたたかい生成り色と、木目調のトリム。' },
  { id: 'kurikawa', jp: '栗皮', en: 'Kurikawa', seat: '#5b3424', accent: '#7a4a35', dash: '#1b1715', trim: '#b29a78', trimMetal: 0.85, carpet: '#1c1715', headliner: '#3b322d', price: 66000, note: '深い栗色のナッパレザー。シャンパン色の金属。' },
];

export const AMBIENTS = [
  { id: 'tsukishiro', jp: '月白', hex: '#dfe8ff' },
  { id: 'kohaku', jp: '琥珀', hex: '#ffa64a' },
  { id: 'ruri', jp: '瑠璃', hex: '#3d7bff' },
  { id: 'wakatake', jp: '若竹', hex: '#4fe0a2' },
  { id: 'sakura', jp: '桜', hex: '#ff8fb8' },
  { id: 'akane', jp: '茜', hex: '#ff4a3a' },
] as const;

export type Grade = {
  id: string;
  name: string;
  drive: string;
  price: number;
  battery: number;
  range: number;
  power: number;
  torque: number;
  accel: number;
  weight: number;
  wh: number;
  lead: string;
  std: string[];
};
export const GRADES: Grade[] = [
  {
    id: 'arc', name: 'ARC', drive: 'RWD（後輪駆動）', price: 5480000, battery: 77, range: 612, power: 250, torque: 440, accel: 6.4, weight: 2030, wh: 128,
    lead: 'いちばん遠くまで走る、基本のグレード。',
    std: ['20インチ エアロホイール', 'ガラスルーフ（調光なし）', '15.6インチ センターディスプレイ', 'アダプティブクルーズ'],
  },
  {
    id: 'awd', name: 'ARC AWD', drive: 'AWD（前後2モーター）', price: 6280000, battery: 88, range: 578, power: 360, torque: 680, accel: 4.8, weight: 2190, wh: 141,
    lead: '雪道も山道も、前後2つのモーターで。',
    std: ['20インチ エアロホイール', '調光ガラスルーフ', 'ヒートポンプ＋バッテリー予熱', 'ハンズフリー パワーテールゲート'],
  },
  {
    id: 'sig', name: 'ARC Signature', drive: 'AWD（前後2モーター）', price: 7380000, battery: 88, range: 545, power: 430, torque: 760, accel: 3.9, weight: 2230, wh: 149,
    lead: 'すべてを揃えた、最上級の一台。',
    std: ['21インチ スポークホイール', 'ドライバーアシスト プラス', '14スピーカー プレミアムサウンド', '前席ベンチレーション＆マッサージ'],
  },
];

export type Option = { id: string; jp: string; price: number; note: string; stdOn?: string[] };
export const OPTIONS: Option[] = [
  { id: 'assist', jp: 'ドライバーアシスト プラス', price: 275000, note: '高速道路での手放し運転（渋滞時）と自動車線変更', stdOn: ['sig'] },
  { id: 'sound', jp: '14スピーカー プレミアムサウンド', price: 143000, note: 'ヘッドレストスピーカー付き', stdOn: ['sig'] },
  { id: 'seat', jp: '前席ベンチレーション＆マッサージ', price: 110000, note: '夏の長距離に', stdOn: ['sig'] },
  { id: 'home', jp: '自宅用 普通充電器（6kW）設置パック', price: 165000, note: '標準工事費込み（架空）' },
  { id: 'v2l', jp: '給電アダプター（1,500W）', price: 44000, note: 'キャンプや停電時に家電を使える' },
  { id: 'coat', jp: 'ボディガラスコーティング', price: 66000, note: '5年間の艶保証（架空）' },
];

export const SUBSIDY = { national: 650000, city: 150000 };
export const APR = 2.9;
export const TERMS = [36, 48, 60, 72, 84] as const;

export const DEALERS = ['MIRAI ARC 本店（みらい市）', 'MIRAI ARC 港北ギャラリー', 'MIRAI ARC みなと駅前'];

export const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`;

export function optionPrice(o: Option, grade: string) {
  return o.stdOn?.includes(grade) ? 0 : o.price;
}
export function wheelPrice(w: Wheel, grade: string) {
  return w.id === 'sport' && grade === 'sig' ? 0 : w.price;
}

/** Standard loan payment (年率 APR, n months). */
export function monthly(principal: number, months: number, apr = APR) {
  if (principal <= 0) return 0;
  const r = apr / 100 / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

/** Charging power (kW) at state of charge s (0..1) for a charger rated kW. */
export function chargePower(s: number, rated: number, battery: number) {
  // DC: flat to ~50%, then tapering; AC: flat to 95%.
  if (rated <= 22) return s < 0.95 ? rated : rated * (1 - (s - 0.95) / 0.05) * 0.8 + 0.4;
  const peak = Math.min(rated, battery >= 85 ? 250 : 225);
  if (s < 0.1) return peak * (0.75 + 2.5 * s);
  if (s < 0.5) return peak;
  if (s < 0.8) return peak * (1 - 1.55 * (s - 0.5));
  return peak * 0.535 * Math.max(0.12, 1 - 3.6 * (s - 0.8));
}

/** Minutes to charge from a to b (percent). */
export function chargeMinutes(a: number, b: number, rated: number, battery: number) {
  if (b <= a) return 0;
  let m = 0;
  for (let p = a; p < b; p += 0.5) {
    const kw = Math.max(0.5, chargePower(p / 100, rated, battery));
    m += ((battery * 0.005) / (kw * 0.93)) * 60;
  }
  return m;
}

export const SPEC_COMMON: [string, string][] = [
  ['全長／全幅／全高', '4,760／1,930／1,560 mm'],
  ['ホイールベース', '2,920 mm'],
  ['最低地上高', '175 mm'],
  ['最小回転半径', '5.5 m'],
  ['乗車定員', '5名'],
  ['荷室容量', '520 L（後席格納時 1,410 L）＋ フロント 48 L'],
  ['急速充電', '最大 250 kW（10→80% 約18分）'],
  ['普通充電', '最大 11 kW（0→100% 約8時間半）'],
];
