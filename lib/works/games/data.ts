/** MIRAI GAMES — every title, person, place and number here is fictional. */

export type AgeKey = 'ALL' | '12' | '16';
export const AGE: Record<AgeKey, { label: string; jp: string; color: string }> = {
  ALL: { label: 'ALL', jp: '全年齢', color: '#2bd49a' },
  '12': { label: '12+', jp: '12才以上', color: '#ffc93d' },
  '16': { label: '16+', jp: '16才以上', color: '#ff5a7a' },
};

export type TitleId = 'neon' | 'sky' | 'abyss' | 'garden' | 'orbit' | 'mikoshi';
export type Title = {
  id: TitleId;
  en: string;
  jp: string;
  tagline: string;
  genre: string;
  platforms: string[];
  release: string;
  status: 'soon' | 'out' | 'dev';
  age: AgeKey;
  players: string;
  price: string;
  desc: string;
  points: string[];
  /** cover palette: background, accent, highlight */
  pal: [string, string, string];
};

export const TITLES: Title[] = [
  {
    id: 'neon',
    en: 'NEON ASTRAY',
    jp: 'ネオン・アストレイ',
    tagline: '雨の街で、名前を取り戻せ。',
    genre: 'サイバーパンク・アクション',
    platforms: ['LUMEN 5', 'PC'],
    release: '2026.11.19',
    status: 'soon',
    age: '16',
    players: '1人',
    price: '¥8,580（税込）',
    desc: '記憶をなくした配達人が、ネオンの迷宮都市を駆け抜ける高速アクション。壁を走り、ビルの谷間を跳び、追っ手を振り切る。雨の一粒まで描き込んだ街そのものが、もう一人の主人公です。',
    points: ['壁走り・滑空・グラップルを組み合わせる移動アクション', '昼と夜で姿を変える、縦に8層の都市', '選んだ配達ルートで結末が変わるマルチエンディング'],
    pal: ['#1a0b33', '#ff3e8a', '#3df2ff'],
  },
  {
    id: 'sky',
    en: 'SKYSHARD',
    jp: 'ソラノカケラ',
    tagline: '空の欠片を、つなぎ直す旅。',
    genre: 'オープンワールドRPG',
    platforms: ['LUMEN 5', 'LUMEN Pocket', 'PC'],
    release: '2025.03.06',
    status: 'out',
    age: 'ALL',
    players: '1人',
    price: '¥7,480（税込）',
    desc: '砕けた空に浮かぶ百の島。風を読み、帆を張り、島と島を結ぶ航路をひとつずつ取り戻していく。累計出荷420万本、Ver.2.4「雲海の祭壇」を配信中です。',
    points: ['風向きで航路が変わる、帆船での空の旅', '島ごとに異なる生態系と、100種の空の生き物', '最大4人で同じ空を旅できるオンライン協力'],
    pal: ['#ffb38a', '#6fb8ff', '#fff3d6'],
  },
  {
    id: 'abyss',
    en: 'ABYSS LANTERN',
    jp: 'アビス・ランタン',
    tagline: '光が届かない場所に、答えがある。',
    genre: '深海探索アドベンチャー',
    platforms: ['PC', 'LUMEN 5'],
    release: '2024.08.22',
    status: 'out',
    age: '12',
    players: '1人',
    price: '¥4,980（税込・ダウンロード専売）',
    desc: 'ランタン一つで、水深1万メートルの海溝へ。灯りの届く範囲だけが見える世界で、消えた調査隊の足跡をたどります。インディーゲーム賞2024 アート部門 受賞。',
    points: ['灯りの色と強さで、近寄る生き物が変わる', '音と気配で進む、静かな探索パズル', '水圧・酸素・電池を管理するサバイバル要素'],
    pal: ['#021a26', '#29e0c8', '#ffb35c'],
  },
  {
    id: 'garden',
    en: 'HOSHIFURU GARDEN',
    jp: 'ほしふる庭',
    tagline: '流れ星をひろって、庭に植える。',
    genre: 'スローライフ・シミュレーション',
    platforms: ['LUMEN Pocket', 'スマートフォン', 'PC'],
    release: '2023.12.07',
    status: 'out',
    age: 'ALL',
    players: '1〜2人',
    price: '¥3,980（税込）／スマートフォン版は基本無料',
    desc: '夜ごとに降る流れ星のかけらを拾って、小さな庭に植えていく。育った星の花は、季節ごとに違う色で光ります。3周年記念イベント「流星の夏祭り」開催中。',
    points: ['1日15分でも遊べる、ゆったりした時間の流れ', '380種の星の花と、組み合わせで咲く新種', '友だちの庭をたずねて、種を交換'],
    pal: ['#1c1e4d', '#ffd36e', '#ff9ec7'],
  },
  {
    id: 'orbit',
    en: 'ORBIT RALLY',
    jp: 'オービット・ラリー',
    tagline: '重力を、置き去りにしろ。',
    genre: '反重力レーシング',
    platforms: ['LUMEN 5', 'PC'],
    release: '2027年 春',
    status: 'dev',
    age: 'ALL',
    players: '1〜4人（オンライン最大16人）',
    price: '未定',
    desc: '惑星の輪を周回する、時速1200kmの反重力レース。コースの裏側や壁面まで走れる立体コースで、重力の向きそのものを味方につけます。',
    points: ['重力の向きが変わる、ねじれた立体コース', '機体を組み替えるガレージと、48のパーツ', 'ゴーストと競える、世界ランキング'],
    pal: ['#07060d', '#ff7a1a', '#ffe0b8'],
  },
  {
    id: 'mikoshi',
    en: 'MIKOSHI PANIC!',
    jp: 'みこしパニック！',
    tagline: 'みんなでかつげば、だいたい転ぶ。',
    genre: 'パーティーゲーム',
    platforms: ['LUMEN Pocket', 'LUMEN 5'],
    release: '2022.07.14',
    status: 'out',
    age: 'ALL',
    players: '1〜4人',
    price: '¥5,280（税込）',
    desc: '4人でひとつのおみこしをかついで、坂道・屋台・大波を越えていく協力パーティーゲーム。息が合わないほど笑える、夏祭りの大騒ぎです。',
    points: ['1台の本体を分け合って、4人ですぐ遊べる', '町内を丸ごと駆け抜ける全24コース', '家族向けの「ゆっくりモード」つき'],
    pal: ['#ffcf3a', '#ff3b30', '#1d1a3a'],
  },
];

/** The four title worlds the playable top page runs through. */
export const WORLDS: { id: TitleId; name: string; jp: string }[] = [
  { id: 'neon', name: 'NEON ASTRAY', jp: 'ネオンの迷宮都市' },
  { id: 'sky', name: 'SKYSHARD', jp: '雲の上の群島' },
  { id: 'abyss', name: 'ABYSS LANTERN', jp: '光のとどかない海' },
  { id: 'orbit', name: 'ORBIT RALLY', jp: '惑星の輪のサーキット' },
];

export type NewsCat = 'title' | 'update' | 'event' | 'corp' | 'recruit';
export const NEWS_CAT: Record<NewsCat, { jp: string; en: string }> = {
  title: { jp: '新作', en: 'NEW TITLE' },
  update: { jp: 'アップデート', en: 'UPDATE' },
  event: { jp: 'イベント', en: 'EVENT' },
  corp: { jp: '企業情報', en: 'CORPORATE' },
  recruit: { jp: '採用', en: 'RECRUIT' },
};
export type News = { date: string; cat: NewsCat; title: string; body: string; ref?: TitleId };
export const NEWS: News[] = [
  {
    date: '2026.09.18',
    cat: 'title',
    ref: 'neon',
    title: '『NEON ASTRAY』の発売日が11月19日に決定。予約受付を開始しました',
    body: 'パッケージ版・ダウンロード版の予約受付を本日より開始しました。早期予約特典として、配達人の衣装「夜間便ジャケット」と、サウンドトラック抜粋5曲をお届けします。',
  },
  {
    date: '2026.09.11',
    cat: 'event',
    title: '「みらいゲームショウ 2026」に出展します（ブース B-12）',
    body: '10月10日〜12日に開催される「みらいゲームショウ 2026」に出展します。『NEON ASTRAY』『ORBIT RALLY』の試遊台を各12台ご用意し、開発者によるステージも予定しています。',
  },
  {
    date: '2026.09.02',
    cat: 'update',
    ref: 'sky',
    title: '『SKYSHARD ソラノカケラ』Ver.2.4「雲海の祭壇」を配信しました',
    body: '新しい群島「雲海の祭壇」と、空の生き物12種を追加しました。あわせて、オンライン協力時の同期ずれを改善しています。更新データは無料です。',
  },
  {
    date: '2026.08.27',
    cat: 'recruit',
    title: '2027年度 新卒採用のエントリー受付を開始しました',
    body: 'プログラマー・プランナー・3Dアーティスト・サウンドクリエイター・UI/UXデザイナー・QAエンジニアの6職種で募集します。会社説明会はオンラインで毎週水曜に開催しています。',
  },
  {
    date: '2026.08.08',
    cat: 'corp',
    title: '福岡スタジオを移転・拡張しました',
    body: '福岡スタジオを天神みらいビル8Fへ移転しました。モーションキャプチャ用のスタジオを新設し、席数は約1.5倍になります。',
  },
  {
    date: '2026.07.30',
    cat: 'update',
    ref: 'garden',
    title: '『ほしふる庭』3周年記念イベント「流星の夏祭り」を開催中',
    body: '9月30日まで、夏祭り限定の星の花と、浴衣の衣装を配布しています。3周年を記念して、友だちの庭に一緒に植えられる「ふたごの種」も登場しました。',
  },
  {
    date: '2026.07.15',
    cat: 'title',
    ref: 'orbit',
    title: '新作『ORBIT RALLY』を発表。2027年春に発売予定です',
    body: '重力の向きが変わる立体コースを走る、反重力レーシングゲームです。ティザー映像を公開しました。続報は「みらいゲームショウ 2026」でお届けします。',
  },
  {
    date: '2026.06.03',
    cat: 'event',
    title: '学生向けゲーム制作ワークショップ「ミライ・ジャム」参加者を募集します',
    body: '48時間で1本のゲームをつくる、学生向けのゲームジャムです。当社の開発者がメンターとして各チームにつきます。参加費は無料、機材の貸し出しもあります。',
  },
];

export const STUDIOS = [
  {
    id: 'tokyo',
    name: '東京本社スタジオ',
    en: 'TOKYO HQ',
    people: 128,
    focus: '大型タイトルの開発と、社内エンジンの研究開発',
    titles: ['NEON ASTRAY', 'SKYSHARD'],
    note: 'モーションキャプチャ、社内エンジン「KAZAMI」の開発チームが常駐。',
  },
  {
    id: 'fukuoka',
    name: '福岡スタジオ',
    en: 'FUKUOKA',
    people: 64,
    focus: 'スマートフォン向けタイトルの開発と運営',
    titles: ['ほしふる庭', 'MIKOSHI PANIC!'],
    note: '週1回の更新を3年間続けてきた、運営型タイトルのチーム。',
  },
  {
    id: 'sapporo',
    name: '札幌サウンドラボ',
    en: 'SAPPORO SOUND LAB',
    people: 22,
    focus: '全タイトルの音楽・効果音・音声収録',
    titles: ['ABYSS LANTERN', 'ORBIT RALLY'],
    note: '防音ブース3室と、生楽器の録れる中規模スタジオを備えています。',
  },
];

export const FACTS: { v: number; unit: string; label: string; fmt?: 'comma' }[] = [
  { v: 2009, unit: '年', label: '設立' },
  { v: 214, unit: '名', label: '社員数（2026年9月）' },
  { v: 27, unit: '本', label: '発売タイトル' },
  { v: 3800, unit: '万本', label: '累計販売・ダウンロード', fmt: 'comma' },
];

export const PROFILE: [string, string][] = [
  ['商号', '株式会社未来ゲームス（MIRAI GAMES Inc.）'],
  ['設立', '2009年4月1日'],
  ['資本金', '1億円'],
  ['代表者', '代表取締役 天野 湊'],
  ['事業内容', '家庭用ゲーム機・PC・スマートフォン向けゲームの企画、開発、販売、運営'],
  ['本社所在地', '〒100-0999 東京都みらい区星見台2-8-1 MIRAI TOWER 12F'],
  ['拠点', '東京本社スタジオ／福岡スタジオ／札幌サウンドラボ'],
];

// ── recruit ────────────────────────────────────────────────────────────────

export const STAT_AXES = [
  ['論理', 'LOGIC'],
  ['発想', 'IDEA'],
  ['表現', 'ART'],
  ['対話', 'TALK'],
  ['根気', 'GRIT'],
  ['技術', 'TECH'],
] as const;

export type JobId = 'engineer' | 'planner' | 'artist' | 'sound' | 'ui' | 'qa';
export type Job = {
  id: JobId;
  jp: string;
  short: string;
  cls: string;
  clsJp: string;
  color: string;
  stats: [number, number, number, number, number, number];
  special: [string, string];
  lead: string;
  work: string[];
  must: string[];
  want: string[];
  day: [string, string][];
  place: string;
  pay: string;
};

export const JOBS: Job[] = [
  {
    id: 'engineer',
    jp: 'プログラマー',
    short: 'プログラマー',
    cls: 'ENGINEER',
    clsJp: '機工士',
    color: '#3df2ff',
    stats: [10, 6, 4, 6, 8, 10],
    special: ['最適化の一閃', '重い場面を見つけて、60fpsに戻す。'],
    lead: '「気持ちいい操作」を、コードで実現する仕事です。',
    work: ['キャラクター操作・カメラ・敵AIなど、ゲームプレイの実装', '社内エンジン「KAZAMI」の描画・物理・ツールの開発', 'プロファイラを使ったパフォーマンスの改善'],
    must: ['C++ または C# でのアプリケーション開発経験（3年以上）', 'チームでのバージョン管理（Git など）の経験'],
    want: ['シェーダーやレンダリングの知識', 'ゲームエンジンでの開発・リリース経験', '線形代数・物理シミュレーションの知識'],
    day: [
      ['10:00', 'メールとビルド結果の確認'],
      ['10:30', 'チームの朝会（15分）'],
      ['11:00', '新しいジャンプ操作の実装'],
      ['13:00', 'ランチ'],
      ['14:00', 'プランナーと試遊して手ざわりを調整'],
      ['16:30', 'コードレビュー'],
      ['18:30', '退社'],
    ],
    place: '東京本社スタジオ／福岡スタジオ',
    pay: '年収 520万〜1,000万円',
  },
  {
    id: 'planner',
    jp: 'プランナー',
    short: 'プランナー',
    cls: 'STRATEGIST',
    clsJp: '軍師',
    color: '#ffd84a',
    stats: [8, 10, 5, 9, 6, 5],
    special: ['仕様書の陣', '「なぜ面白いか」を、誰にでもわかる言葉にする。'],
    lead: 'ゲームの面白さを考え、形にし、最後まで守る仕事です。',
    work: ['ゲームのルール・レベル・イベントの企画と仕様書の作成', 'パラメータの調整と、試遊会での検証', 'プレイデータを読み解いた改善提案（運営タイトル）'],
    must: ['ゲームの企画・運営・レベルデザインいずれかの実務経験（2年以上）', '表計算ソフトでのデータ作成・分析の経験'],
    want: ['自作ゲームや、ボードゲームの制作経験', 'スクリプト言語（Lua・Python など）の経験'],
    day: [
      ['10:00', '昨日のプレイデータを確認'],
      ['10:30', 'チームの朝会'],
      ['11:00', '新ステージの仕様書を更新'],
      ['13:00', 'ランチ'],
      ['14:00', '試遊会・フィードバックの整理'],
      ['16:00', 'アーティストと演出の打ち合わせ'],
      ['18:30', '退社'],
    ],
    place: '東京本社スタジオ／福岡スタジオ',
    pay: '年収 480万〜900万円',
  },
  {
    id: 'artist',
    jp: '3Dアーティスト',
    short: '3Dアート',
    cls: 'SCULPTOR',
    clsJp: '造形師',
    color: '#ff5fa8',
    stats: [5, 8, 10, 6, 8, 7],
    special: ['千のポリゴン', '限られたデータ量で、いちばん美しい形を探す。'],
    lead: 'キャラクターや世界を、立体として生み出す仕事です。',
    work: ['キャラクター・背景・小物の3Dモデルとテクスチャの制作', 'ゲームエンジン上でのライティングとルック調整', 'テクニカルアーティストと組んだ、制作パイプラインの改善'],
    must: ['Blender・Maya・3ds Max いずれかでの制作経験（2年以上）', 'PBRテクスチャの制作経験'],
    want: ['ZBrush などでのスカルプト経験', 'リギング・アニメーションの経験', 'デッサン・美術の素養'],
    day: [
      ['10:00', '昨日のモデルをエンジンで確認'],
      ['10:30', 'アートの朝会'],
      ['11:00', 'キャラクターのスカルプト'],
      ['13:00', 'ランチ'],
      ['14:00', 'アートディレクターのレビュー'],
      ['15:00', 'テクスチャとルック調整'],
      ['18:30', '退社'],
    ],
    place: '東京本社スタジオ',
    pay: '年収 450万〜850万円',
  },
  {
    id: 'sound',
    jp: 'サウンドクリエイター',
    short: 'サウンド',
    cls: 'BARD',
    clsJp: '吟遊詩人',
    color: '#39e58c',
    stats: [6, 8, 9, 7, 7, 7],
    special: ['残響の歌', '音だけで、画面の外の気配を伝える。'],
    lead: '耳で遊べるゲームをつくる仕事です。音楽・効果音・声のすべてを扱います。',
    work: ['BGM・効果音の制作と、ゲーム内への組み込み', '声優収録のディレクションと編集', 'インタラクティブミュージック（状況で変わる音楽）の設計'],
    must: ['DAW を使った楽曲または効果音の制作経験（2年以上）', '作品のポートフォリオ（音源）の提出'],
    want: ['Wwise・FMOD などのサウンドミドルウェアの経験', '生楽器・フィールドレコーディングの経験'],
    day: [
      ['10:00', '札幌サウンドラボに出社'],
      ['10:30', '各タイトルとのオンライン朝会'],
      ['11:00', 'ボス戦BGMのアレンジ'],
      ['13:00', 'ランチ'],
      ['14:00', '効果音の収録（雪を踏む音）'],
      ['16:00', 'ゲーム内で鳴らして調整'],
      ['18:30', '退社'],
    ],
    place: '札幌サウンドラボ',
    pay: '年収 450万〜850万円',
  },
  {
    id: 'ui',
    jp: 'UI/UXデザイナー',
    short: 'UI/UX',
    cls: 'ILLUSIONIST',
    clsJp: '幻術師',
    color: '#ff8a3d',
    stats: [7, 8, 9, 8, 6, 6],
    special: ['迷わせない魔法', '説明書を読まなくても、次に押すボタンがわかる。'],
    lead: 'プレイヤーが迷わず、気持ちよく遊べる画面をつくる仕事です。',
    work: ['メニュー・HUD・ショップなど、ゲーム画面のUIデザイン', '画面遷移とアニメーションの設計、プロトタイプ制作', 'ユーザーテストの実施と改善'],
    must: ['アプリまたはゲームのUIデザイン経験（2年以上）', 'Figma などでのプロトタイプ制作経験'],
    want: ['ゲームエンジン上でのUI実装経験', 'モーションデザインの経験', 'アクセシビリティへの知識'],
    day: [
      ['10:00', 'ユーザーテストの録画を確認'],
      ['10:30', 'チームの朝会'],
      ['11:00', 'ショップ画面のプロトタイプ'],
      ['13:00', 'ランチ'],
      ['14:00', 'プログラマーと実装の相談'],
      ['16:00', 'アイコンの仕上げ'],
      ['18:30', '退社'],
    ],
    place: '東京本社スタジオ／福岡スタジオ',
    pay: '年収 450万〜850万円',
  },
  {
    id: 'qa',
    jp: 'QAエンジニア',
    short: 'QA',
    cls: 'SCOUT',
    clsJp: '斥候',
    color: '#b7f23d',
    stats: [8, 6, 4, 8, 10, 7],
    special: ['百の目', 'プレイヤーより先に、すべての落とし穴を踏む。'],
    lead: '発売前のゲームを誰よりも遊び、品質を守る仕事です。',
    work: ['テスト計画の作成と、機能・通しプレイのテスト', '不具合の再現手順の調査と報告', '自動テスト・テストツールの整備'],
    must: ['ソフトウェアのテストまたは品質保証の実務経験（1年以上）', '不具合を正確に文章で伝える力'],
    want: ['テスト自動化（Python など）の経験', '家庭用ゲーム機の発売前審査への対応経験'],
    day: [
      ['10:00', '最新ビルドの動作確認'],
      ['10:30', 'QAチームの朝会'],
      ['11:00', 'ステージ3の通しプレイ'],
      ['13:00', 'ランチ'],
      ['14:00', '不具合の再現と報告'],
      ['16:00', '自動テストの結果を確認'],
      ['18:30', '退社'],
    ],
    place: '東京本社スタジオ／福岡スタジオ',
    pay: '年収 400万〜700万円',
  },
];

export const PERKS = [
  ['ゲーム購入補助', '月1万円まで。研究のためのゲームは経費です。'],
  ['フレックス・在宅', 'コアタイム11:00〜16:00。在宅勤務は週2日まで。'],
  ['社内ゲームジャム', '年2回、48時間。ここから生まれたタイトルもあります。'],
  ['機材は自分で選ぶ', 'PC・モニター・椅子を、予算内で自由に選べます。'],
  ['学びの補助', '書籍・講座・カンファレンス参加を会社が負担。'],
  ['休日', '完全週休2日（土日祝）・年間休日127日・リフレッシュ休暇。'],
];

export const FLOW = ['エントリー', '書類選考', '実技課題', '面接（2回）', '内定'];
