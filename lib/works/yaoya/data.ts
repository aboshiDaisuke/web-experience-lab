// やおや みらい — shop data (fictional sample)

export type ProduceId =
  | 'cabbage'
  | 'daikon'
  | 'tomato'
  | 'carrot'
  | 'onion'
  | 'nasu'
  | 'kaki'
  | 'mikan'
  | 'imo'
  | 'negi'
  | 'shiitake'
  | 'hakusai';

export type Produce = {
  id: ProduceId;
  name: string;
  /** POP headline, written by hand */
  pop: string;
  origin: string;
  unit: string;
  price: number;
  /** one-line shop talk on the POP card */
  talk: string;
  holder: 'zaru' | 'crate';
  paper: 'yellow' | 'white' | 'pink' | 'green';
  months: number[];
};

export const produce: Produce[] = [
  { id: 'cabbage', name: 'キャベツ', pop: '朝どれキャベツ', origin: '群馬・嬬恋', unit: '1玉', price: 198, talk: '巻きかたい！', holder: 'crate', paper: 'yellow', months: [3, 4, 5, 7, 8, 9, 10] },
  { id: 'tomato', name: 'トマト', pop: '桃太郎トマト', origin: '栃木', unit: '3個', price: 298, talk: '完熟です', holder: 'zaru', paper: 'white', months: [6, 7, 8, 9] },
  { id: 'nasu', name: 'なす', pop: '秋なす', origin: '高知', unit: '3本', price: 150, talk: '焼きなすに', holder: 'zaru', paper: 'pink', months: [7, 8, 9, 10] },
  { id: 'kaki', name: '柿', pop: '刀根早生 柿', origin: '奈良', unit: '1個', price: 98, talk: '走りの甘さ', holder: 'zaru', paper: 'yellow', months: [9, 10, 11] },
  { id: 'daikon', name: '大根', pop: '青首大根', origin: '北海道', unit: '1本', price: 158, talk: 'おでんの季節', holder: 'crate', paper: 'white', months: [10, 11, 12, 1, 2] },
  { id: 'imo', name: 'さつまいも', pop: '紅はるか', origin: '千葉', unit: '1本', price: 180, talk: '焼くとねっとり', holder: 'crate', paper: 'pink', months: [9, 10, 11, 12] },
  { id: 'mikan', name: 'みかん', pop: '極早生みかん', origin: '熊本', unit: '6個入り', price: 398, talk: '青いけど甘い', holder: 'zaru', paper: 'green', months: [9, 10, 11, 12, 1] },
  { id: 'shiitake', name: 'しいたけ', pop: '原木しいたけ', origin: '群馬', unit: '1パック', price: 248, talk: '肉厚！', holder: 'zaru', paper: 'white', months: [3, 4, 9, 10, 11] },
  { id: 'negi', name: '長ねぎ', pop: '深谷ねぎ', origin: '埼玉', unit: '2本', price: 198, talk: '鍋にどうぞ', holder: 'crate', paper: 'green', months: [11, 12, 1, 2] },
  { id: 'carrot', name: 'にんじん', pop: 'にんじん', origin: '千葉', unit: '3本', price: 128, talk: '葉つき入荷', holder: 'crate', paper: 'yellow', months: [4, 5, 6, 11, 12, 1] },
  { id: 'onion', name: '玉ねぎ', pop: '玉ねぎ', origin: '北海道', unit: '3個', price: 148, talk: 'よく締まってます', holder: 'zaru', paper: 'white', months: [4, 5, 9, 10] },
  { id: 'hakusai', name: '白菜', pop: '白菜 半割', origin: '長野', unit: '1/2個', price: 148, talk: 'はしりの白菜', holder: 'crate', paper: 'pink', months: [11, 12, 1, 2] },
];

export const produceById = Object.fromEntries(produce.map((p) => [p.id, p])) as Record<
  ProduceId,
  Produce
>;

/** 旬の早見盤 — what the grocer would write for each month */
export const seasonWords: string[][] = [
  ['白菜', '大根', '長ねぎ', 'みかん', '金柑'],
  ['菜の花', 'ほうれん草', '小松菜', 'れんこん', 'いちご'],
  ['春キャベツ', '新玉ねぎ', 'うど', 'いちご', 'せり'],
  ['たけのこ', 'アスパラ', '新玉ねぎ', 'さやえんどう', '春キャベツ'],
  ['そら豆', '新じゃが', 'グリーンピース', '新ごぼう', 'にんじん'],
  ['きゅうり', '梅', 'らっきょう', 'さくらんぼ', 'トマト'],
  ['とうもろこし', '枝豆', 'すいか', 'ピーマン', 'トマト'],
  ['なす', 'ゴーヤ', '桃', 'みょうが', 'かぼちゃ'],
  ['梨', 'ぶどう', '栗', 'さつまいも', '秋なす'],
  ['柿', '里芋', 'しいたけ', 'れんこん', 'りんご'],
  ['みかん', 'かぶ', '春菊', 'ゆず', '白菜'],
  ['大根', 'ほうれん草', 'ゆず', '長ねぎ', '白菜'],
];

export const seasonNotes: string[] = [
  '寒さで甘みがのる月。白菜は外葉ごと買うと長もちします。',
  '菜の花が並ぶと、店先が一気に春になります。',
  '春キャベツはやわらかい。千切りより、ざく切りでさっと。',
  'たけのこは掘ったその日にゆでるのがいちばん。糠もつけます。',
  'そら豆はさやごと焼くと、ほっくり甘い。',
  '梅しごとの季節。青梅・完熟梅、どちらも予約できます。',
  '夏野菜が一年でいちばん安くておいしい時期です。',
  'なすとトマトは、冷やしすぎないのがコツ。',
  '梨・ぶどう・栗。秋の果物が一気にそろいます。',
  '柿は店主の好物。熟れ具合を言ってくれたら選びます。',
  'みかんは箱買いがお得。配達も承ります。',
  '年末は予約が混み合います。お早めにどうぞ。',
];

/** 今日の入荷 — chalkboard content */
export const boardItems = [
  { name: '朝どれキャベツ', origin: '群馬・嬬恋', price: '198', unit: '1玉', hot: true },
  { name: '紅はるか', origin: '千葉', price: '180', unit: '1本', hot: false },
  { name: '秋なす', origin: '高知', price: '150', unit: '3本', hot: false },
  { name: '刀根早生 柿', origin: '奈良', price: '98', unit: '1個', hot: false },
  { name: '原木しいたけ', origin: '群馬', price: '248', unit: '1P', hot: false },
];
export const boardWord = [
  '今朝の市場、キャベツが',
  'とにかく良かった。巻きが',
  'かたくて、ずっしり重い。',
  'ざく切りで蒸すと甘いよ。',
];

export const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

// 国民の祝日 (2026–2027)
export const holidays: Record<string, string> = {
  '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日', '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日', '2026-04-29': '昭和の日', '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日', '2026-05-06': '振替休日', '2026-07-20': '海の日', '2026-08-11': '山の日',
  '2026-09-21': '敬老の日', '2026-09-22': '国民の休日', '2026-09-23': '秋分の日', '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
  '2027-01-01': '元日', '2027-01-11': '成人の日', '2027-02-11': '建国記念の日', '2027-02-23': '天皇誕生日',
  '2027-03-21': '春分の日', '2027-03-22': '振替休日', '2027-04-29': '昭和の日', '2027-05-03': '憲法記念日',
  '2027-05-04': 'みどりの日', '2027-05-05': 'こどもの日', '2027-07-19': '海の日', '2027-08-11': '山の日',
  '2027-09-20': '敬老の日', '2027-09-23': '秋分の日', '2027-10-11': 'スポーツの日', '2027-11-03': '文化の日',
  '2027-11-23': '勤労感謝の日',
};

// 臨時休業・短縮営業
export const specialDays: Record<string, { kind: 'closed' | 'short'; note: string }> = {
  '2026-08-13': { kind: 'closed', note: 'お盆休み' },
  '2026-08-14': { kind: 'closed', note: 'お盆休み' },
  '2026-08-15': { kind: 'closed', note: 'お盆休み' },
  '2026-09-30': { kind: 'short', note: '商店街の会合のため 17:00 閉店' },
  '2026-10-14': { kind: 'closed', note: '商店街組合の研修旅行' },
  '2026-11-11': { kind: 'closed', note: '市場休市日' },
  '2026-12-30': { kind: 'short', note: '年末は 20:00 まで営業' },
  '2026-12-31': { kind: 'short', note: '大晦日は 17:00 閉店' },
  '2027-01-02': { kind: 'closed', note: '年始休み' },
  '2027-01-03': { kind: 'closed', note: '年始休み' },
  '2027-01-04': { kind: 'closed', note: '年始休み' },
};

export const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type DayState = { open: boolean; label?: string; kind?: 'sun' | 'holiday' | 'closed' | 'short' };
export function dayState(d: Date): DayState {
  const k = key(d);
  const sp = specialDays[k];
  if (sp?.kind === 'closed') return { open: false, label: sp.note, kind: 'closed' };
  if (holidays[k]) return { open: false, label: holidays[k], kind: 'holiday' };
  if (d.getDay() === 0) return { open: false, label: '定休日', kind: 'sun' };
  if (sp) return { open: true, label: sp.note, kind: 'short' };
  return { open: true };
}

/** 商店街マップ — the street runs left (station) to right */
export type Shop = { id: string; name: string; kind: string; side: 'n' | 's'; x: number; w: number; note: string; color: string };
export const shops: Shop[] = [
  { id: 'kissa', name: '喫茶ミライ', kind: '喫茶店', side: 'n', x: 150, w: 70, note: '昭和の純喫茶。モーニングのサラダはうちの野菜です。', color: '#8a5a3a' },
  { id: 'hon', name: '未来堂書店', kind: '本屋', side: 'n', x: 228, w: 64, note: '料理本の棚が充実。旬の献立に迷ったらここ。', color: '#5a6a4a' },
  { id: 'niku', name: '肉のみらい屋', kind: '精肉店', side: 'n', x: 300, w: 76, note: '揚げたてコロッケ 1個 90円。じゃがいもはうちから。', color: '#b0452e' },
  { id: 'yaoya', name: 'やおや みらい', kind: '八百屋', side: 'n', x: 384, w: 92, note: 'ここです。のれんが目印。', color: '#1d2f4f' },
  { id: 'tofu', name: '豆腐の未来屋', kind: '豆腐店', side: 'n', x: 484, w: 62, note: '朝6時から。湯豆腐には大根おろしを。', color: '#8c8a78' },
  { id: 'kashi', name: '和菓子 未来庵', kind: '和菓子', side: 'n', x: 554, w: 70, note: '秋は栗蒸し羊羹。栗はうちと同じ茨城産。', color: '#9a4a6a' },
  { id: 'pan', name: 'パンのみらい', kind: 'パン屋', side: 's', x: 150, w: 84, note: 'かぼちゃあんぱんの季節です。', color: '#c08a3a' },
  { id: 'sakana', name: '魚みらい', kind: '鮮魚店', side: 's', x: 242, w: 70, note: '秋刀魚には、うちのすだちと大根を。', color: '#2f6a8a' },
  { id: 'yu', name: 'みらい湯', kind: '銭湯', side: 's', x: 320, w: 96, note: '冬至はゆず湯。ゆずはうちが納めてます。', color: '#3d6b5a' },
  { id: 'kusuri', name: 'みらい薬局', kind: '薬局', side: 's', x: 424, w: 62, note: '商店街の保健室。', color: '#4a7a9a' },
  { id: 'hana', name: '花のみらい', kind: '花屋', side: 's', x: 494, w: 62, note: '店先の菊が目印。', color: '#a8568a' },
  { id: 'sakaya', name: '未来酒店', kind: '酒屋', side: 's', x: 564, w: 60, note: '角打ちあり。お通しはうちの浅漬け。', color: '#6a4a2a' },
];
