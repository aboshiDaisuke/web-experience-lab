// MIRAI GOODS — catalog, makers, shipping rules. Everything here is fictional.

export type CatId = 'utsuwa' | 'glass' | 'kitchen' | 'nuno';
export const CATS: { id: CatId | 'all'; label: string; en: string }[] = [
  { id: 'all', label: 'すべて', en: 'ALL' },
  { id: 'utsuwa', label: '器', en: 'CERAMICS' },
  { id: 'glass', label: 'ガラス', en: 'GLASS' },
  { id: 'kitchen', label: '台所道具', en: 'KITCHEN' },
  { id: 'nuno', label: '布もの', en: 'LINEN' },
];

export type ItemId =
  | 'meshi'
  | 'rinka'
  | 'nanasun'
  | 'shinogi'
  | 'donabe'
  | 'kyusu'
  | 'cup'
  | 'jar'
  | 'board'
  | 'spoon'
  | 'hashi'
  | 'zaru'
  | 'fukin'
  | 'apron'
  | 'pan';

export type Variant = {
  id: string;
  label: string;
  /** swatch colour for the UI */
  swatch: string;
  /** price override (sizes) */
  price?: number;
  /** packing dims override, cm [w, d, h] */
  dims?: [number, number, number];
  stock?: number;
};

export type Review = { name: string; date: string; stars: number; title: string; body: string };

export type Item = {
  id: ItemId;
  name: string;
  kana: string;
  cat: CatId;
  maker: MakerId;
  price: number;
  /** packed bounding box in cm: width (x), depth (z), height (y) */
  dims: [number, number, number];
  fragile: boolean;
  soft?: boolean;
  weight: number;
  variants: Variant[];
  /** 'color' or 'size' */
  variantKind: 'color' | 'size';
  stock: number;
  restock?: string;
  isNew?: boolean;
  lead: string;
  body: string;
  spec: [string, string][];
  care: string[];
  rating: number;
  reviewCount: number;
  dist: [number, number, number, number, number];
  reviews: Review[];
  /** sort weight for "おすすめ順" */
  pick: number;
  added: string;
};

export type MakerId = 'tonoyama' | 'hakuu' | 'hikari' | 'kigoto' | 'takenowa' | 'kanaya' | 'asanoie';
export type Maker = {
  id: MakerId;
  name: string;
  person: string;
  place: string;
  craft: string;
  seal: string;
  since: string;
  lead: string;
  body: string;
  quote: string;
  hue: string;
};

export const MAKERS: Maker[] = [
  {
    id: 'tonoyama',
    name: '砥ノ山窯',
    person: '岡野 まどか',
    place: '山あいの町・砥ノ山',
    craft: '陶器（粉引・鉄釉・土鍋）',
    seal: '砥',
    since: '2009年 築窯',
    lead: '近くの山で掘った土を、半年ねかせてから使う。',
    body:
      '薪と灯油の窯をひとつずつ。粉引は、赤土の上に白い化粧土をかけて焼くため、口縁や高台まわりに土の色がうっすら透けます。毎日の汁気や油をすって、少しずつ表情が変わっていくのも楽しみのひとつです。',
    quote: '使いこんで、いい顔になった器を見せてもらうのがいちばんうれしい。',
    hue: '#8a6a4a',
  },
  {
    id: 'hakuu',
    name: '白雨窯',
    person: '瀬川 透',
    place: '海沿いの町・青ヶ浦',
    craft: '磁器（白磁・青白磁）',
    seal: '白',
    since: '2014年 独立',
    lead: '轆轤で薄く挽いて、しのぎや輪花で光の筋をつくる。',
    body:
      '透けるほど薄い磁器は、じつは丈夫で扱いやすい器です。青白磁は、釉の溜まりにだけ淡い水色がのるように、釉薬の厚みを一枚ずつ調整しています。',
    quote: '白い器は、料理の色をいちばん正直に見せてくれる。',
    hue: '#6f8796',
  },
  {
    id: 'hikari',
    name: '硝子工房 ひかりの',
    person: '高梨 ゆう',
    place: '湖のほとり・澄野',
    craft: '吹きガラス',
    seal: '光',
    since: '2016年 開房',
    lead: '再生ガラスを溶かして、ひとつずつ宙で吹く。',
    body:
      '窓ガラスの端材などを溶かし直した再生ガラスを使っています。ほんの少し気泡や揺らぎが入るのは、手吹きならではのしるしです。',
    quote: '水を注いだとき、テーブルに落ちる影まで見てほしい。',
    hue: '#5f8a86',
  },
  {
    id: 'kigoto',
    name: '木ごと舎',
    person: '須藤 健',
    place: '森の町・杣ヶ里',
    craft: '木工（山桜・くるみ・拭き漆）',
    seal: '木',
    since: '2011年 開業',
    lead: '倒木や間伐材を、乾かして十年待つこともある。',
    body:
      'まな板は刃あたりのやさしい山桜、スプーンは口あたりのよいくるみ。拭き漆は、漆を塗っては拭き取る作業を七回くり返し、木目を生かしたまま丈夫に仕上げます。',
    quote: '木は削ってからも動く。だから、ゆっくり乾かす。',
    hue: '#9a6b44',
  },
  {
    id: 'takenowa',
    name: '竹工房 たけのわ',
    person: '野口 すみ',
    place: '竹林の里・篠原',
    craft: '竹細工',
    seal: '竹',
    since: '2018年 開房',
    lead: '冬に伐った真竹を割り、ひごにして編む。',
    body:
      '水切れがよく乾きやすい竹ざるは、野菜を洗う、そばを盛る、干し野菜をつくる、と一年中使える道具です。',
    quote: '編み目がそろうまで、十年かかりました。',
    hue: '#a08a4f',
  },
  {
    id: 'kanaya',
    name: 'かなや鍛冶',
    person: '金谷 誠',
    place: '川沿いの町・鉄ヶ瀬',
    craft: '鉄の台所道具',
    seal: '鉄',
    since: '1962年 創業',
    lead: '一枚の鉄板を、たたいて絞って、フライパンにする。',
    body:
      '槌目（つちめ）をつけることで油がなじみやすく、焦げつきにくくなります。三代目が、先代の型を少しだけ軽く直しました。',
    quote: '鉄は、使うほど育つ。最初の一年だけ、少し手をかけてください。',
    hue: '#4d4a47',
  },
  {
    id: 'asanoie',
    name: '麻の家',
    person: '中西 ほのか',
    place: '機織りの町・綾瀬川',
    craft: 'リネンの布もの',
    seal: '麻',
    since: '2013年 開業',
    lead: '洗うほどやわらかくなる、少し厚手のリネン。',
    body:
      '織りは町の機屋さんに、縫製と洗いは工房で。一度洗いをかけてからお届けするので、届いたその日から手になじみます。',
    quote: 'ふきんは、台所でいちばん働く布だと思う。',
    hue: '#7d8a6a',
  },
];
export const makerOf = (id: MakerId) => MAKERS.find((m) => m.id === id)!;

const R = (name: string, date: string, stars: number, title: string, body: string): Review => ({ name, date, stars, title, body });

export const ITEMS: Item[] = [
  {
    id: 'donabe',
    name: '土鍋 六号',
    kana: 'どなべ',
    cat: 'utsuwa',
    maker: 'tonoyama',
    price: 11000,
    dims: [26, 21, 16],
    fragile: true,
    weight: 2400,
    variantKind: 'color',
    variants: [
      { id: 'kuro', label: '黒', swatch: '#2c2622' },
      { id: 'ame', label: '飴', swatch: '#7a4a22' },
    ],
    stock: 5,
    isNew: true,
    lead: '二〜三人用。ごはんを炊くのも、鍋ものにも。',
    body:
      '厚手の土で、ゆっくり温まってなかなか冷めない土鍋です。ふたの縁を深く取っているので、吹きこぼれにくく、二合のごはんがふっくら炊けます。直火専用（IH不可）。',
    spec: [
      ['サイズ', '径 21cm（取っ手含む 26cm）× 高さ 16cm'],
      ['容量', '約 1.8L（満水）／ごはん 2合'],
      ['重さ', '約 2.4kg'],
      ['素材', '陶器（耐熱土）'],
      ['使用', '直火 ○／IH ×／電子レンジ ×／食洗機 ×'],
    ],
    care: ['はじめて使う前に、おかゆを炊いて目止めをしてください。', '空だきと、急な温度変化は割れの原因になります。', '洗ったあとは、底までよく乾かしてからしまいます。'],
    rating: 4.8,
    reviewCount: 42,
    dist: [36, 5, 1, 0, 0],
    reviews: [
      R('ほうじ茶 さん（40代）', '2026.09.14', 5, 'ごはんが甘い', '炊飯器をやめました。おこげも上手にできます。黒は食卓がしまって見えます。'),
      R('k.m さん（30代）', '2026.08.30', 5, '箱を開けたら紙のクッションだらけ', 'ていねいな梱包で安心しました。取っ手が持ちやすいです。'),
      R('ゆず さん（60代）', '2026.07.02', 4, '少し重い', '重さはありますが、そのぶん冷めにくいです。'),
    ],
    pick: 100,
    added: '2026-09-10',
  },
  {
    id: 'meshi',
    name: '粉引の飯碗',
    kana: 'こひきのめしわん',
    cat: 'utsuwa',
    maker: 'tonoyama',
    price: 3300,
    dims: [12.5, 12.5, 7],
    fragile: true,
    weight: 190,
    variantKind: 'color',
    variants: [
      { id: 'kohiki', label: '粉引', swatch: '#ece6da' },
      { id: 'hai', label: '灰釉', swatch: '#a7a58a' },
      { id: 'ame', label: '飴釉', swatch: '#8a5328' },
    ],
    stock: 18,
    lead: '手のひらにすっぽり収まる、少し深めの飯碗。',
    body:
      '赤土に白い化粧土をかけた粉引は、やわらかな白と、ところどころに出る鉄の点が特徴です。高台は削りを深めにとり、熱いごはんでも持ちやすくしています。',
    spec: [
      ['サイズ', '径 12.5cm × 高さ 7cm'],
      ['容量', '約 300ml（ごはん 1膳半）'],
      ['重さ', '約 190g'],
      ['素材', '陶器'],
      ['使用', '電子レンジ ○／食洗機 △（手洗い推奨）／オーブン ×'],
    ],
    care: ['粉引はしみこみやすい器です。使う前に水にくぐらせてください。', 'つけ置き洗いは避け、よく乾かしてからしまいます。'],
    rating: 4.7,
    reviewCount: 128,
    dist: [98, 22, 6, 2, 0],
    reviews: [
      R('いちご さん（30代）', '2026.09.20', 5, '家族四人でそろえました', '一つずつ鉄の点の出かたがちがって、どれが自分のか分かります。'),
      R('としお さん（70代）', '2026.09.01', 5, '軽い', '見た目よりずっと軽く、持ちやすいです。'),
      R('みさ さん（40代）', '2026.08.11', 4, 'しみに注意', '最初にカレーを入れたら少し色が残りました。いまは味だと思っています。'),
    ],
    pick: 95,
    added: '2026-04-02',
  },
  {
    id: 'rinka',
    name: '輪花の五寸皿',
    kana: 'りんかのごすんざら',
    cat: 'utsuwa',
    maker: 'hakuu',
    price: 2640,
    dims: [15, 15, 2.8],
    fragile: true,
    weight: 210,
    variantKind: 'color',
    variants: [
      { id: 'hakuji', label: '白磁', swatch: '#f4f2ec' },
      { id: 'seihakuji', label: '青白磁', swatch: '#cfe0e0' },
      { id: 'ki', label: '黄釉', swatch: '#d9c07a' },
    ],
    stock: 3,
    lead: '縁が五つの花びらのように波打つ、取り皿にちょうどいい五寸。',
    body:
      '型を使わず、挽いた皿の縁を指で押して花の形にしています。和え物、ケーキ、パン皿にも。重ねてもかさばりません。',
    spec: [
      ['サイズ', '径 15cm × 高さ 2.8cm'],
      ['重さ', '約 210g'],
      ['素材', '磁器'],
      ['使用', '電子レンジ ○／食洗機 ○／オーブン ×'],
    ],
    care: ['磁器なのでしみこみにくく、ふだん使いに気兼ねなく。', '縁の薄いところは、ぶつけないようにご注意ください。'],
    rating: 4.9,
    reviewCount: 64,
    dist: [58, 5, 1, 0, 0],
    reviews: [
      R('なな さん（20代）', '2026.09.09', 5, '青白磁がきれい', '溜まったところだけ水色になっていて、光にかざしたくなります。'),
      R('ことり さん（50代）', '2026.07.21', 5, '毎日つかう', '取り皿を全部これにしました。'),
    ],
    pick: 90,
    added: '2026-05-18',
  },
  {
    id: 'nanasun',
    name: '鉄釉の七寸皿',
    kana: 'てつゆうのななすんざら',
    cat: 'utsuwa',
    maker: 'tonoyama',
    price: 5280,
    dims: [21, 21, 3.2],
    fragile: true,
    weight: 520,
    variantKind: 'color',
    variants: [
      { id: 'tetsu', label: '鉄釉', swatch: '#3b2a20' },
      { id: 'shiro', label: '白マット', swatch: '#dcd6ca' },
    ],
    stock: 9,
    lead: '主菜をのせる、少し深さのある七寸。',
    body:
      '鉄分の多い釉薬が、溜まったところで黒く、薄いところで茶色く焼き上がります。煮物の汁を受けとめる、ほどよい深さがあります。',
    spec: [
      ['サイズ', '径 21cm × 高さ 3.2cm'],
      ['重さ', '約 520g'],
      ['素材', '陶器'],
      ['使用', '電子レンジ ○／食洗機 ○／オーブン ×'],
    ],
    care: ['金属のカトラリーで強くこすると、跡が残ることがあります。'],
    rating: 4.6,
    reviewCount: 37,
    dist: [26, 9, 2, 0, 0],
    reviews: [
      R('さば さん（40代）', '2026.08.25', 5, '焼き魚がおいしそうに見える', '黒い器は料理が映えますね。'),
      R('ym さん（30代）', '2026.06.14', 4, 'ちょっと重め', '大皿なので、このくらいの重さは仕方ないと思います。'),
    ],
    pick: 70,
    added: '2026-03-12',
  },
  {
    id: 'shinogi',
    name: 'しのぎのマグカップ',
    kana: 'しのぎのまぐかっぷ',
    cat: 'utsuwa',
    maker: 'hakuu',
    price: 3850,
    dims: [11.5, 8.5, 9],
    fragile: true,
    weight: 230,
    variantKind: 'color',
    variants: [
      { id: 'oribe', label: '織部', swatch: '#3f6a4c' },
      { id: 'shiro', label: '白', swatch: '#f1eee6' },
      { id: 'ruri', label: '瑠璃', swatch: '#24406a' },
    ],
    stock: 22,
    lead: '胴を縦に削ったしのぎが、手にすっと沿う。',
    body:
      '一本ずつカンナで削ったしのぎに釉薬が溜まり、稜線だけが淡く光ります。取っ手は指が三本かかる大きさです。',
    spec: [
      ['サイズ', '径 8.5cm（取っ手含む 11.5cm）× 高さ 9cm'],
      ['容量', '約 280ml'],
      ['重さ', '約 230g'],
      ['素材', '磁器'],
      ['使用', '電子レンジ ○／食洗機 ○'],
    ],
    care: ['織部の緑は、焼き上がりで濃淡が一点ずつ異なります。'],
    rating: 4.7,
    reviewCount: 88,
    dist: [66, 17, 4, 1, 0],
    reviews: [
      R('朝のコーヒー さん（30代）', '2026.09.17', 5, '織部の緑が深い', '写真より実物のほうがずっといい色でした。'),
      R('tn さん（50代）', '2026.08.02', 4, '取っ手が持ちやすい', '少し大きめですが、たっぷり入るのでうれしいです。'),
    ],
    pick: 85,
    added: '2026-02-20',
  },
  {
    id: 'kyusu',
    name: '白磁の急須',
    kana: 'はくじのきゅうす',
    cat: 'utsuwa',
    maker: 'hakuu',
    price: 7700,
    dims: [17, 11, 11],
    fragile: true,
    weight: 280,
    variantKind: 'color',
    variants: [
      { id: 'hakuji', label: '白磁', swatch: '#f4f2ec' },
      { id: 'seihakuji', label: '青白磁', swatch: '#cfe0e0' },
    ],
    stock: 0,
    restock: '10月中旬',
    lead: '二人分のお茶にちょうどいい、横手の急須。',
    body:
      '茶こしは本体と一体の細かな穴。注ぎ口は液だれしにくいよう、先を鋭く削っています。ふたの裏まで釉をかけているので、茶渋がつきにくいつくりです。',
    spec: [
      ['サイズ', '幅 17cm × 奥行 11cm × 高さ 11cm'],
      ['容量', '約 360ml'],
      ['重さ', '約 280g'],
      ['素材', '磁器'],
      ['使用', '電子レンジ ×／食洗機 △'],
    ],
    care: ['注ぎ口の先は欠けやすいため、洗うときは手で。'],
    rating: 4.9,
    reviewCount: 23,
    dist: [21, 2, 0, 0, 0],
    reviews: [R('まっちゃ さん（60代）', '2026.06.30', 5, '液だれしない', '最後の一滴まで、すっと切れます。')],
    pick: 75,
    added: '2026-01-15',
  },
  {
    id: 'cup',
    name: '手吹きのコップ',
    kana: 'てぶきのこっぷ',
    cat: 'glass',
    maker: 'hikari',
    price: 2860,
    dims: [7.5, 7.5, 9.5],
    fragile: true,
    weight: 160,
    variantKind: 'color',
    variants: [
      { id: 'clear', label: '透明', swatch: '#e8eeec' },
      { id: 'aqua', label: '淡青', swatch: '#a9cfc9' },
      { id: 'amber', label: '琥珀', swatch: '#c28a3e' },
    ],
    stock: 16,
    lead: '水、麦茶、ビール。いちばん出番の多いコップ。',
    body:
      '底を少し厚くして、置いたときに安定するようにしています。口元はうすく、飲み物がすっと入ってきます。',
    spec: [
      ['サイズ', '径 7.5cm × 高さ 9.5cm'],
      ['容量', '約 250ml'],
      ['重さ', '約 160g'],
      ['素材', '再生ガラス'],
      ['使用', '電子レンジ ×／食洗機 ×／熱湯 ×'],
    ],
    care: ['急な温度変化に弱いので、熱い飲み物は避けてください。'],
    rating: 4.8,
    reviewCount: 156,
    dist: [132, 18, 5, 1, 0],
    reviews: [
      R('のあ さん（20代）', '2026.09.19', 5, '影がきれい', '琥珀色の影がテーブルに落ちるのが好きです。'),
      R('ひろ さん（40代）', '2026.09.03', 5, '丈夫', '毎日使って一年、まだ割れていません。'),
    ],
    pick: 92,
    added: '2026-05-01',
  },
  {
    id: 'jar',
    name: 'ガラスの保存びん',
    kana: 'がらすのほぞんびん',
    cat: 'glass',
    maker: 'hikari',
    price: 3960,
    dims: [10, 10, 14],
    fragile: true,
    weight: 420,
    variantKind: 'size',
    variants: [
      { id: 'm', label: 'M（高さ11cm）', swatch: '#e8eeec', price: 3520, dims: [10, 10, 11] },
      { id: 'l', label: 'L（高さ14cm）', swatch: '#e8eeec', price: 3960, dims: [10, 10, 14] },
    ],
    stock: 7,
    lead: '山桜のふたの、乾物や茶葉の保存びん。',
    body:
      'ふたには細いシリコンの輪を入れて、しっかり閉まるようにしています。並べたときに高さがそろう、M と L の二種類です。',
    spec: [
      ['サイズ', '径 10cm × 高さ 11cm（M）／14cm（L）'],
      ['容量', '約 520ml（M）／720ml（L）'],
      ['重さ', '約 360g（M）／420g（L）'],
      ['素材', '再生ガラス、山桜（ふた）、シリコン'],
      ['使用', '電子レンジ ×／食洗機 ×（ふた）'],
    ],
    care: ['木のふたは水につけおきせず、さっと洗ってすぐ拭いてください。'],
    rating: 4.6,
    reviewCount: 31,
    dist: [22, 7, 2, 0, 0],
    reviews: [R('こめこ さん（30代）', '2026.07.12', 5, '台所がととのう', 'M を三つ並べて、粉ものを入れています。')],
    pick: 60,
    added: '2026-06-20',
  },
  {
    id: 'board',
    name: '山桜のまな板',
    kana: 'やまざくらのまないた',
    cat: 'kitchen',
    maker: 'kigoto',
    price: 6600,
    dims: [36, 20, 2],
    fragile: false,
    weight: 780,
    variantKind: 'size',
    variants: [
      { id: 'l', label: 'L（36×20cm）', swatch: '#b27a52', price: 6600, dims: [36, 20, 2] },
      { id: 's', label: 'S（27×15cm）', swatch: '#b27a52', price: 4400, dims: [27, 15, 2] },
    ],
    stock: 6,
    lead: '刃あたりがやさしく、そのまま食卓にも出せる。',
    body:
      '一枚板の山桜に、持ち手の穴をあけました。パンやチーズをのせてそのまま食卓へ。仕上げは、えごま油です。',
    spec: [
      ['サイズ', 'L 36×20×2cm／S 27×15×2cm'],
      ['重さ', 'L 約 780g／S 約 450g'],
      ['素材', '山桜（えごま油仕上げ）'],
      ['使用', '食洗機 ×'],
    ],
    care: ['使う前に水でぬらすと、においや色がつきにくくなります。', '乾いてきたら、えごま油やくるみ油を薄く塗ってください。'],
    rating: 4.8,
    reviewCount: 54,
    dist: [45, 7, 2, 0, 0],
    reviews: [
      R('パン屋めぐり さん（40代）', '2026.09.05', 5, 'そのまま出せる', 'サンドイッチを切って、そのままテーブルへ。'),
      R('だいご さん（30代）', '2026.08.19', 4, 'L が便利', '大きめを選んで正解でした。'),
    ],
    pick: 80,
    added: '2026-03-28',
  },
  {
    id: 'spoon',
    name: 'くるみの木のスプーン',
    kana: 'くるみのきのすぷーん',
    cat: 'kitchen',
    maker: 'kigoto',
    price: 1980,
    dims: [18, 4.5, 2.4],
    fragile: false,
    weight: 22,
    variantKind: 'color',
    variants: [{ id: 'kurumi', label: 'くるみ', swatch: '#8a6547' }],
    stock: 34,
    lead: 'カレーにも、スープにも。口あたりのやわらかいスプーン。',
    body:
      '一本ずつ小刀で削り出し、先を薄く仕上げています。木なので熱が伝わりにくく、熱いものでも口あたりがやさしいです。',
    spec: [
      ['サイズ', '長さ 18cm × 幅 4.5cm'],
      ['重さ', '約 22g'],
      ['素材', 'くるみ（くるみ油仕上げ）'],
      ['使用', '食洗機 ×'],
    ],
    care: ['洗ったらすぐに拭いて、風通しのよいところで乾かしてください。'],
    rating: 4.6,
    reviewCount: 71,
    dist: [52, 14, 4, 1, 0],
    reviews: [R('しろくま さん（30代）', '2026.08.08', 5, '子どもも使える', '軽くて、子どもが自分で持ちたがります。')],
    pick: 65,
    added: '2026-05-25',
  },
  {
    id: 'hashi',
    name: '拭き漆の箸',
    kana: 'ふきうるしのはし',
    cat: 'kitchen',
    maker: 'kigoto',
    price: 2750,
    dims: [23.5, 2.4, 1.2],
    fragile: false,
    weight: 16,
    variantKind: 'color',
    variants: [
      { id: 'tame', label: '溜', swatch: '#6a2a1a' },
      { id: 'kuro', label: '黒', swatch: '#1f1a17' },
    ],
    stock: 26,
    lead: '先が細く、つまみやすい八角の箸。',
    body:
      '山桜を八角に削り、漆を七回塗り重ねています。先は滑りにくいよう、漆をやや控えめに。長さは 23cm です。',
    spec: [
      ['サイズ', '長さ 23cm'],
      ['重さ', '約 16g（一膳）'],
      ['素材', '山桜、漆'],
      ['使用', '食洗機 ×'],
    ],
    care: ['漆は、使ううちにつやが増していきます。つけ置き洗いは避けてください。'],
    rating: 4.9,
    reviewCount: 96,
    dist: [88, 7, 1, 0, 0],
    reviews: [
      R('はし好き さん（50代）', '2026.09.12', 5, '豆がつまめる', '先がとても細いのに丈夫です。'),
      R('りょう さん（30代）', '2026.07.29', 5, '贈りものに', 'ギフト包装が上品でした。'),
    ],
    pick: 88,
    added: '2026-02-02',
  },
  {
    id: 'zaru',
    name: '竹の盛りざる',
    kana: 'たけのもりざる',
    cat: 'kitchen',
    maker: 'takenowa',
    price: 4180,
    dims: [21, 21, 5],
    fragile: false,
    weight: 140,
    variantKind: 'color',
    variants: [{ id: 'take', label: '真竹', swatch: '#c9ad6e' }],
    stock: 2,
    lead: 'そばを盛る、野菜を洗う、干し野菜にも。',
    body:
      '真竹のひごを、ござ目に編んでいます。縁は二重に巻いて、長く使っても形がくずれにくくしました。',
    spec: [
      ['サイズ', '径 21cm × 高さ 5cm'],
      ['重さ', '約 140g'],
      ['素材', '真竹'],
    ],
    care: ['使ったあとはたわしで洗い、日かげでよく乾かしてください。'],
    rating: 4.7,
    reviewCount: 19,
    dist: [14, 4, 1, 0, 0],
    reviews: [R('そば打ち さん（60代）', '2026.08.21', 5, '水切れがいい', 'ざるそばが一段とおいしく見えます。')],
    pick: 55,
    added: '2026-07-08',
  },
  {
    id: 'pan',
    name: '鉄のフライパン 20cm',
    kana: 'てつのふらいぱん',
    cat: 'kitchen',
    maker: 'kanaya',
    price: 7480,
    dims: [38, 21, 6],
    fragile: false,
    weight: 980,
    variantKind: 'color',
    variants: [{ id: 'tetsu', label: '鉄', swatch: '#3c3a38' }],
    stock: 9,
    lead: '目玉焼きひとつから。槌目の小さなフライパン。',
    body:
      '一枚の鉄板を絞って、ひとつずつ槌目をつけています。油なじみがよく、強火で焼いた野菜がおいしくなります。IH・直火どちらも使えます。',
    spec: [
      ['サイズ', '径 20cm（柄を含む長さ 38cm）× 深さ 4cm'],
      ['重さ', '約 980g'],
      ['素材', '鉄（焼き込み仕上げ）'],
      ['使用', '直火 ○／IH ○／オーブン ○'],
    ],
    care: ['洗剤を使わず、お湯とたわしで洗ってください。', '火にかけて水気を飛ばし、薄く油をなじませてしまいます。'],
    rating: 4.7,
    reviewCount: 45,
    dist: [34, 8, 2, 1, 0],
    reviews: [R('たまご さん（30代）', '2026.09.07', 5, '目玉焼きの縁がカリッと', '手入れも慣れるとかんたんでした。')],
    pick: 72,
    added: '2026-04-18',
  },
  {
    id: 'fukin',
    name: 'リネンのふきん',
    kana: 'りねんのふきん',
    cat: 'nuno',
    maker: 'asanoie',
    price: 1650,
    dims: [20, 13, 1.6],
    fragile: false,
    soft: true,
    weight: 60,
    variantKind: 'color',
    variants: [
      { id: 'kinari', label: '生成り', swatch: '#e6dccb' },
      { id: 'ai', label: '藍', swatch: '#2e4a63' },
      { id: 'karashi', label: 'からし', swatch: '#c79a3a' },
      { id: 'sumi', label: '墨の縞', swatch: '#4a4845' },
    ],
    stock: 60,
    lead: '食器拭きに、パンを包むのに。一枚あると手放せない。',
    body:
      '少し厚手のリネンを、一度洗ってからお届けします。水をよく吸い、乾きが早いので、毎日洗っても清潔です。',
    spec: [
      ['サイズ', '50 × 70cm（たたんだ状態 20×13cm）'],
      ['重さ', '約 60g'],
      ['素材', 'リネン 100%'],
      ['使用', '洗濯機 ○／漂白剤 ×（塩素系）'],
    ],
    care: ['はじめは少し縮みます（約 3%）。', '乾燥機は縮みの原因になるため避けてください。'],
    rating: 4.8,
    reviewCount: 214,
    dist: [180, 26, 6, 2, 0],
    reviews: [
      R('台所番 さん（40代）', '2026.09.21', 5, '三枚目です', '洗うたびにやわらかくなっていきます。'),
      R('あや さん（20代）', '2026.09.02', 5, '藍が好き', '色落ちもほとんどありません。'),
    ],
    pick: 94,
    added: '2026-01-10',
  },
  {
    id: 'apron',
    name: 'リネンのエプロン',
    kana: 'りねんのえぷろん',
    cat: 'nuno',
    maker: 'asanoie',
    price: 9350,
    dims: [30, 22, 4],
    fragile: false,
    soft: true,
    weight: 280,
    variantKind: 'color',
    variants: [
      { id: 'kinari', label: '生成り', swatch: '#e6dccb' },
      { id: 'sumi', label: '墨', swatch: '#3d3b39' },
      { id: 'akane', label: '茜', swatch: '#9a4a3a' },
    ],
    stock: 4,
    lead: '首にかけず、肩で着るエプロン。',
    body:
      '背中でひもを交差させるので、首や肩が疲れにくい形です。大きなポケットがひとつ。男女どちらにも。',
    spec: [
      ['サイズ', '着丈 85cm × 幅 90cm（フリーサイズ）'],
      ['重さ', '約 280g'],
      ['素材', 'リネン 100%'],
      ['使用', '洗濯機 ○（ネット使用）'],
    ],
    care: ['茜はしばらく色が出ることがあります。はじめは単独で洗ってください。'],
    rating: 4.7,
    reviewCount: 38,
    dist: [29, 7, 2, 0, 0],
    reviews: [R('ちか さん（50代）', '2026.08.16', 5, '肩がこらない', '一日台所に立っても楽でした。')],
    pick: 68,
    added: '2026-06-06',
  },
];

export const itemOf = (id: ItemId) => ITEMS.find((i) => i.id === id)!;
export const variantOf = (item: Item, vid: string) => item.variants.find((v) => v.id === vid) ?? item.variants[0];
export const priceOf = (item: Item, vid: string) => variantOf(item, vid).price ?? item.price;
export const dimsOf = (item: Item, vid: string) => variantOf(item, vid).dims ?? item.dims;

// ── boxes & shipping ───────────────────────────────────────────────────────

/** inner dimensions in cm: width (x), depth (z), height (y) */
export type BoxSize = { id: 60 | 80 | 100 | 120 | 140; inner: [number, number, number] };
export const BOXES: BoxSize[] = [
  { id: 60, inner: [25, 18, 13] },
  { id: 80, inner: [33, 24, 19] },
  { id: 100, inner: [41, 30, 25] },
  { id: 120, inner: [48, 36, 32] },
  { id: 140, inner: [56, 42, 38] },
];

export type RegionId = 'hokkaido' | 'tohoku' | 'kanto' | 'chubu' | 'kansai' | 'chushi' | 'kyushu' | 'okinawa';
export const REGIONS: { id: RegionId; label: string; prefs: string; add: number; days: number }[] = [
  { id: 'hokkaido', label: '北海道', prefs: '北海道', add: 660, days: 2 },
  { id: 'tohoku', label: '東北', prefs: '青森・岩手・宮城・秋田・山形・福島', add: 110, days: 1 },
  { id: 'kanto', label: '関東・信越', prefs: '東京・神奈川・埼玉・千葉・茨城・栃木・群馬・山梨・長野・新潟', add: 0, days: 1 },
  { id: 'chubu', label: '中部・北陸', prefs: '静岡・愛知・岐阜・三重・富山・石川・福井', add: 0, days: 1 },
  { id: 'kansai', label: '関西', prefs: '大阪・京都・兵庫・奈良・滋賀・和歌山', add: 110, days: 1 },
  { id: 'chushi', label: '中国・四国', prefs: '鳥取・島根・岡山・広島・山口・徳島・香川・愛媛・高知', add: 220, days: 2 },
  { id: 'kyushu', label: '九州', prefs: '福岡・佐賀・長崎・熊本・大分・宮崎・鹿児島', add: 440, days: 2 },
  { id: 'okinawa', label: '沖縄', prefs: '沖縄', add: 1210, days: 3 },
];
const BASE_FEE: Record<BoxSize['id'], number> = { 60: 880, 80: 1100, 100: 1380, 120: 1650, 140: 1980 };
export const boxFee = (size: BoxSize['id'], region: RegionId) => BASE_FEE[size] + REGIONS.find((r) => r.id === region)!.add;

export const FREE_SHIPPING = 11000;
export const OKINAWA_FLAT = 1100;
export const GIFT_FEE = 330;
export const COD_FEE = 330;

export const TIME_SLOTS = ['指定なし', '午前中', '14〜16時', '16〜18時', '18〜20時', '19〜21時'];

/** Order before 14:00 on a weekday ships the same day. Returns ship date. */
export function shipDate(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const wd = (x: Date) => x.getDay() !== 0 && x.getDay() !== 6;
  if (!(wd(d) && now.getHours() < 14)) {
    do d.setDate(d.getDate() + 1);
    while (!wd(d));
  }
  return d;
}
export function earliestDelivery(region: RegionId, now = new Date()) {
  const d = shipDate(now);
  d.setDate(d.getDate() + REGIONS.find((r) => r.id === region)!.days);
  return d;
}
const WD = ['日', '月', '火', '水', '木', '金', '土'];
export const mdw = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;

export const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;

// ── features ────────────────────────────────────────────────────────────────

export const FEATURE = {
  kicker: '九月の特集　FEATURE No.27',
  title: '土鍋で炊く、\n秋のごはん。',
  lead: '新米の季節がきました。ことしは土鍋で、ごはんを炊いてみませんか。砥ノ山窯の土鍋と、よそう器、つまむ箸をそろえました。',
  picks: [
    { id: 'donabe' as ItemId, v: 'kuro' },
    { id: 'meshi' as ItemId, v: 'kohiki' },
    { id: 'hashi' as ItemId, v: 'tame' },
  ],
};

export const SETS: { id: string; title: string; kicker: string; lead: string; lines: { id: ItemId; v: string; q: number }[]; gift?: boolean }[] = [
  {
    id: 'hajime',
    kicker: 'はじめての器',
    title: 'ひとり暮らしの、最初の五点',
    lead: '飯碗、取り皿を二枚、マグ、箸。これだけあれば、毎日の食卓はたいてい間に合います。',
    lines: [
      { id: 'meshi', v: 'kohiki', q: 1 },
      { id: 'rinka', v: 'hakuji', q: 2 },
      { id: 'shinogi', v: 'oribe', q: 1 },
      { id: 'hashi', v: 'tame', q: 1 },
    ],
  },
  {
    id: 'gift',
    kicker: '贈りもの',
    title: 'ふたりへ、コップとふきん',
    lead: '結婚や引っ越しのお祝いに。ギフト包装でお届けします（包装料 ¥330）。',
    lines: [
      { id: 'cup', v: 'amber', q: 2 },
      { id: 'fukin', v: 'ai', q: 2 },
    ],
    gift: true,
  },
  {
    id: 'kitchen',
    kicker: '台所をととのえる',
    title: '木と鉄と竹の、三つの道具',
    lead: 'まな板、フライパン、ざる。長く使うほど、手になじんでいく道具です。',
    lines: [
      { id: 'board', v: 'l', q: 1 },
      { id: 'pan', v: 'tetsu', q: 1 },
      { id: 'zaru', v: 'take', q: 1 },
    ],
  },
];

export const NEWS = [
  { date: '2026.09.24', text: '砥ノ山窯の土鍋が再入荷しました（黒・飴）。' },
  { date: '2026.09.18', text: '秋のお休み：10月12日（月・祝）は発送をお休みします。' },
  { date: '2026.09.05', text: '白雨窯の急須は、10月中旬に入荷予定です。' },
];

const PREF_REGION: [RegionId, string][] = [
  ['hokkaido', '北海道'],
  ['tohoku', '青森県 岩手県 宮城県 秋田県 山形県 福島県'],
  ['kanto', '茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 山梨県 長野県 新潟県'],
  ['chubu', '富山県 石川県 福井県 岐阜県 静岡県 愛知県 三重県'],
  ['kansai', '滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県'],
  ['chushi', '鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県'],
  ['kyushu', '福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県'],
  ['okinawa', '沖縄県'],
];
export const PREFS: { name: string; region: RegionId }[] = PREF_REGION.flatMap(([region, s]) => s.split(' ').map((name) => ({ name, region })));
