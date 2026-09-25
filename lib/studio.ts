export const goals = [
  { id: 'all', label: 'すべて' },
  { id: 'brand', label: '会社・ブランドを伝えたい' },
  { id: 'booking', label: '予約・申込みを増やしたい' },
  { id: '3d', label: '3Dで製品・空間を見せたい' },
  { id: 'estate', label: '物件を内覧で見せたい' },
  { id: 'photo', label: '写真で魅せたい' },
  { id: 'shop', label: 'ネットで商品を売りたい' },
  { id: 'local', label: '地域のお店・公共施設' },
] as const;
export type GoalId = (typeof goals)[number]['id'];

export const workMeta: Record<
  string,
  { goals: GoalId[]; built: string[]; tech: string[] }
> = {
  nova: {
    goals: ['brand'],
    built: ['検査レンズで拡大（WebGL）', '2点間の寸法計測', '事業別の切り替え'],
    tech: ['WebGL', 'GLSLシェーダー'],
  },
  lumina: {
    goals: ['brand', 'booking'],
    built: ['なでると髪が流れる（流体シェーダー）', 'スタイルギャラリー', '予約フォーム'],
    tech: ['three.js', '流体シミュレーション'],
  },
  noir: {
    goals: ['booking', 'photo'],
    built: ['カーソルがろうそくの灯りに（WebGL）', '立ちのぼる湯気', 'コース別の予約'],
    tech: ['three.js', 'GLSLシェーダー'],
  },
  eclat: {
    goals: ['brand', 'photo'],
    built: ['スクロールで縫われる革の縫い目', '立体的に傾くバッグ', 'カラー選択'],
    tech: ['GSAP', 'スクロール演出'],
  },
  luce: {
    goals: ['estate', '3d', 'booking'],
    built: ['階数別の360°眺望', '歩いて見られる3Dモデルルーム', '間取りから内覧'],
    tech: ['three.js', 'Blender', '360°パノラマ'],
  },
  aether: {
    goals: ['3d'],
    built: ['その場で鳴る生成サウンド', '音に反応する波紋', 'スクロールで分解する3D'],
    tech: ['three.js', 'Web Audio'],
  },
  casa: {
    goals: ['estate', '3d', 'photo'],
    built: ['図面から建ち上がる外観', 'Blender製の住宅を歩いて内覧', 'スクロールで夕暮れから夜へ'],
    tech: ['WebGL', 'Blender', '3D内覧'],
  },
  room: {
    goals: ['3d'],
    built: ['道具を選ぶと仕事を実演', 'コードからサイトが組み上がる', '3Dの部屋'],
    tech: ['three.js', '3D空間'],
  },
  yui: {
    goals: ['photo', 'brand'],
    built: ['ネガから現像される写真', 'ファインダーで撮影', 'フィルムに残る撮影カット'],
    tech: ['WebGL', 'Web Audio'],
  },
  adapt: {
    goals: ['3d', 'brand'],
    built: ['クリック地点から塗り替わる', 'スタイルごとの見出しの表情', 'WebGLオブジェクト'],
    tech: ['three.js', 'インタラクション'],
  },
  offgrid: {
    goals: ['booking', 'photo'],
    built: ['通知の山を風が吹き飛ばす', 'タイムテーブル', 'チケット申込み'],
    tech: ['GSAP', 'スクロール演出'],
  },
  drive: {
    goals: ['local', 'booking', '3d'],
    built: ['スクロールで夜の高速を走る（WebGL）', '標識が出口になるナビ', 'ローン試算と在庫検索'],
    tech: ['three.js', 'GLSLシェーダー'],
  },
  yaoya: {
    goals: ['local', 'booking'],
    built: ['めくれる布ののれん', '野菜をかごへ放りこむ取り置き', 'チョークで書かれる黒板'],
    tech: ['three.js', '布シミュレーション'],
  },
  library: {
    goals: ['local', 'brand'],
    built: ['本棚そのものが検索窓', '迫り出して開く本', '開館カレンダー'],
    tech: ['CSS 3D', '蔵書検索'],
  },
  city: {
    goals: ['local', 'booking'],
    built: ['番号札で手続きを案内', '窓口までの道順', 'やさしい日本語・文字サイズ切替'],
    tech: ['CSS 3D', 'アクセシビリティ'],
  },
  arc: {
    goals: ['3d', 'brand', 'booking'],
    built: ['Blender製の車を3Dで操作（WebGL）', '運転席に乗りこめる', '色・グレードと価格の試算'],
    tech: ['three.js', 'Blender', 'PBR'],
  },
  goods: {
    goals: ['shop', 'brand'],
    built: ['品物が段ボール箱に詰まるカート（WebGL）', '箱の大きさで決まる送料', '購入手続き'],
    tech: ['three.js', '物理演算'],
  },
  games: {
    goals: ['brand', '3d'],
    built: ['トップがそのまま遊べるゲーム（WebGL）', 'パッケージで並ぶタイトル', 'キャラ選択式の採用'],
    tech: ['three.js', 'ゲーム制作'],
  },
};

// Top of the page: the works that show the craft at a glance.
export const featured: { slug: string; pitch: string }[] = [
  { slug: 'arc', pitch: 'Blenderで作った車を、ブラウザで回して、ドアを開けて、運転席に座る。' },
  { slug: 'games', pitch: 'トップページが、そのまま遊べるゲーム。ソフトのパッケージは手に取って開ける。' },
  { slug: 'goods', pitch: 'カートは段ボール箱。入れた品が落ちて詰まり、箱の大きさと送料がその場で決まる。' },
];

// Order of the works grid; the first nine show before 「すべて見る」.
// The featured three sit in the showcase above, so they come after the first nine.
export const workOrder = [
  'drive', 'luce', 'yaoya', 'casa', 'lumina', 'noir', 'library', 'city', 'aether',
  'arc', 'games', 'goods', 'nova', 'eclat', 'yui', 'room', 'adapt', 'offgrid',
];

// Shown as a ribbon under the featured works.
export const techStack = [
  'three.js / WebGL',
  'GLSLシェーダー',
  'Blender',
  '物理シミュレーション',
  'Web Audio',
  'GSAP',
  'React / Next.js',
  'アクセシビリティ',
];

export const needs = [
  { id: 'all', label: 'すべて見る' },
  { id: 'update', label: '自分でこまめに更新したい' },
  { id: 'speed', label: '表示の速さと安全性' },
  { id: 'budget', label: '早く・費用をおさえて' },
  { id: 'app', label: '予約・会員などの機能' },
  { id: 'shop', label: 'ネットで商品を売りたい' },
  { id: 'show', label: '3Dや演出で驚かせたい' },
] as const;
export type NeedId = (typeof needs)[number]['id'];

export const scoreLabels = ['自分で更新', '表示の速さ', '演出の自由度', '初期費用の安さ'];

export const stacks: {
  id: string;
  name: string;
  kind: string;
  fit: string;
  scores: [number, number, number, number];
  monthly: string;
  pros: string[];
  cons: string[];
  needs: NeedId[];
  current?: boolean;
}[] = [
  {
    id: 'wordpress',
    name: 'WordPress',
    kind: '定番のCMS',
    fit: 'お知らせやブログをよく更新する会社・店舗に',
    scores: [3, 2, 2, 2],
    monthly: 'サーバー代と保守費',
    pros: [
      '世界で最も使われていて、管理画面に慣れた人が多い',
      'プラグインで予約や会員などの機能を足しやすい',
      '将来ほかの制作会社に引き継ぎやすい',
    ],
    cons: [
      '本体やプラグインの更新を続けないと、乗っ取りの危険がある',
      '演出を増やすと表示が重くなりやすい',
      'サーバー代と保守費が毎月かかる',
    ],
    needs: ['update', 'app'],
  },
  {
    id: 'astro',
    name: 'Astro + microCMS',
    kind: 'いま伸びている組み合わせ',
    fit: '速さと更新のしやすさを両立したい公式サイトに',
    scores: [3, 3, 3, 2],
    monthly: '小規模ならほぼ無料〜少額',
    pros: [
      'ページを事前に組み立てておくので、表示がとても速い',
      '動く仕組みが少なく、乗っ取られる心配がほとんどない',
      '見た目は自由に作れて、更新は日本語の管理画面から',
    ],
    cons: [
      '更新してからサイトに反映されるまで1〜2分かかる',
      '機能を足すにはプラグインではなく開発が必要',
      '記事数や更新する人が増えると、CMSが有料プランになる',
    ],
    needs: ['update', 'speed', 'show'],
  },
  {
    id: 'nocode',
    name: 'STUDIO / Framer',
    kind: 'ノーコード',
    fit: 'まず早く公開して、文言は自分で直したい方に',
    scores: [3, 2, 2, 3],
    monthly: 'サービスの月額利用料',
    pros: [
      '制作期間が短く、費用をおさえやすい',
      '画面を見ながら、文字や写真をその場で直せる',
      'サーバーの管理がいらない',
    ],
    cons: [
      '利用料がずっとかかり続ける',
      'サービスが用意した範囲を超える演出や機能は入れにくい',
      'ほかの仕組みへの引っ越しが難しい',
    ],
    needs: ['update', 'budget'],
  },
  {
    id: 'next',
    name: 'Next.js',
    kind: 'Webアプリ型',
    fit: '予約・会員・決済など、機能が中心のサイトに',
    scores: [2, 3, 3, 1],
    monthly: '公開先の利用料(小規模なら無料枠あり)',
    pros: [
      '予約や会員ページなど、アプリのような機能まで作り込める',
      '3Dや細かな操作の演出と相性がよい',
      'サイトが大きくなっても機能を足していける',
    ],
    cons: [
      '開発費は高めになる',
      '更新画面はCMSを組み合わせて別に用意する',
      '修正や機能追加には開発者が必要',
    ],
    needs: ['app', 'show'],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    kind: 'ネットショップ',
    fit: '商品を売る、定期便を届けるなら',
    scores: [3, 2, 1, 2],
    monthly: '月額利用料と決済手数料',
    pros: [
      '決済・在庫・配送の管理が最初からそろっている',
      'セキュリティや障害への対応はShopifyがしてくれる',
      'アプリでクーポンや定期購入を足せる',
    ],
    cons: [
      '月額に加えて、売上ごとに手数料がかかる',
      'デザインはテーマの枠組みに沿うため、独自の演出は追加開発になる',
      'ショップ以外のページは作り込みにくい',
    ],
    needs: ['shop'],
  },
  {
    id: 'html',
    name: 'HTML',
    kind: 'このサンプルの形',
    fit: '更新が少なく、見た目と体験で勝負したいサイトに',
    scores: [1, 3, 3, 3],
    monthly: 'ほぼ無料(公開先の無料枠で足りることが多い)',
    pros: [
      'いちばん軽く、いちばん速い',
      'サーバー代がほとんどかからない',
      '表現の自由度が最も高い',
    ],
    cons: [
      '更新のたびに制作側への依頼が必要',
      'ページが増えると管理が大変になる',
    ],
    needs: ['speed', 'budget', 'show'],
    current: true,
  },
];

export const setups = [
  {
    id: 'full',
    name: 'すべておまかせ',
    who: 'ドメインもサーバーもまだない方',
    body: 'ドメインの取得、公開先やサーバーの契約手続き、CMSとメールの初期設定まで代行します。',
    cost: 'up',
    costLabel: 'ドメイン・サーバー管理（年1万円）が加わります',
  },
  {
    id: 'have',
    name: 'サーバー・ドメインがある',
    who: 'いまの契約をそのまま使いたい方',
    body: 'お持ちの環境に合わせて設置します。環境によっては、選べるつくり方が限られます。',
    cost: 'down',
    costLabel: 'ドメイン・サーバー管理費はかかりません',
  },
  {
    id: 'renew',
    name: 'いまのサイトを作り替える',
    who: 'リニューアルをお考えの方',
    body: '記事や画像の移し替えと、古いページのURLから新しいページへの転送設定を行います。',
    cost: 'up',
    costLabel: '移し替える量に応じて加わります',
  },
] as const;

export const cautions = [
  'サーバーやCMS、ノーコードツールなどの月々の利用料は制作費に含まれません。各サービスへお客さまから直接お支払いいただきます。料金は各サービスの改定で変わることがあります。',
  'ドメインやサーバーは、お客さまの名義で契約します。将来ほかの制作会社へ移るときも、そのまま引き継げます。',
  'お使いのレンタルサーバーによっては、動かせないつくり方があります(一般的なレンタルサーバーではNext.jsが動かないことが多いなど)。ご提案の前に確認します。',
  '同じドメインでメールをお使いの場合は、公開の切り替えでメールが止まらないよう、設定を確認してから作業します。',
  '有料のテーマ・プラグイン・写真素材・フォントを使う場合、その購入費は別途かかります。',
  '公開後の更新や保守は「保守・管理」（月1万円〜）で承ります。WordPressは本体やプラグインの更新を続ける必要があるため、保守のご契約をおすすめします。',
  '公開後につくり方を変える場合は、作り直しに近い費用がかかることがあります。',
];

export const services = [
  {
    title: '世界観を|つくる',
    example: 'eclat',
    body: '業種やお客さまに合わせて、色・書体・写真の扱いまで一から設計します。テンプレートは使いません。',
  },
  {
    title: '予約・相談に|つなげる',
    example: 'noir',
    body: '見て終わりにせず、予約や問い合わせまで迷わず進める流れをつくります。入力のしやすさまで調整します。',
  },
  {
    title: '触って|伝わる3D',
    example: 'arc',
    body: '製品の分解、建物の内覧、空間の探索。言葉だけでは伝わりにくい魅力を、操作できる形で見せます。',
  },
  {
    title: 'スマホで|軽く動く',
    example: 'adapt',
    body: '3Dも写真も、スマートフォンで快適に動くよう描画量と読み込みを調整。アクセシビリティにも配慮します。',
  },
];

// 料金は FTL「デジタル広報支援サービス」2026年度版（https://www.ftl.co.jp/products.html）に合わせています
export const plans = [
  {
    name: 'BASIC',
    price: '6万円〜',
    period: '2ページ構成・納期 約1か月〜',
    fit: '店舗・個人商店向け。3ページ以下のサイトの目安です',
    items: ['2ページ構成（例：トップ、メニュー）', '基本デザイン'],
    example: 'yaoya',
  },
  {
    name: 'PRO',
    price: '20万円〜',
    period: '5ページまで標準・納期 約1か月〜',
    fit: '企業向け。4ページ以上のサイトの目安です',
    items: ['5ページまで標準', '企画・構成・デザイン'],
    example: 'nova',
  },
  {
    name: '3D・インタラクティブ',
    price: '個別お見積り',
    period: 'PROの制作費 ＋ 3D・演出の制作費',
    fit: '製品、建築、空間を触って見せたいときに',
    items: ['PROの内容すべて', '3Dモデルの制作・調整', 'WebGL演出', '端末ごとの描画最適化'],
    example: 'aether',
  },
];

export const options = [
  { name: 'ページ追加', price: '20,000円〜', unit: '1ページ' },
  { name: 'ドメイン・サーバー管理', price: '10,000円', unit: '年', note: 'お持ちの場合は不要' },
  { name: '保守・管理', price: '10,000円〜', unit: '月' },
  { name: 'ロゴ・バナー制作', price: '10,000円〜', unit: '1点' },
  { name: '写真・動画撮影', price: '60,000円〜', unit: '1日' },
];

export const estimates = [
  {
    title: '個人商店のWebを作りたい',
    lines: ['BASIC 60,000円', 'ドメイン・サーバー管理 10,000円'],
    total: '70,000円',
    after: '翌年からはサーバー 10,000円/年',
  },
  {
    title: '企業サイトを撮影込みで',
    lines: ['PRO 200,000円', '撮影1日 60,000円', 'ドメイン・サーバー管理 10,000円'],
    total: '270,000円',
    after: '翌年からはサーバー 10,000円/年',
  },
];

export const extraCosts = [
  '交通費・出張費（撮影時など）',
  '打合せ費（回数が増える場合）',
  '有料素材費（写真・イラスト）',
  '短納期対応（特急料金）',
  '大幅な仕様変更',
];

export const steps = [
  { title: '無料相談・ヒアリング', period: '無料', body: '目的・予算・時期をうかがいます。気になった作品があれば、それを見ながら話すと早く進みます。' },
  { title: 'お見積り・ご提案', period: '無料', body: '構成案とつくり方、お見積りをお送りします。この時点ではまだ費用はかかりません。' },
  { title: 'ご契約・制作開始', period: 'デザインと実装', body: 'トップページから方向性を固めて各ページに広げ、PCとスマートフォンの実機で動作を確認します。' },
  { title: '納品', period: '約1か月〜', body: '公開作業を行います。納期はページ数や内容によって変わります。お急ぎの場合は特急料金でご相談ください。' },
  { title: '運用サポート開始', period: '保守・管理 月1万円〜', body: '公開後の更新や不具合への対応、サーバーの管理を承ります。' },
];

export const faqs = [
  {
    q: '写真や文章がまだ揃っていません。',
    a: '本文と写真はご用意いただくのが基本です。撮影はオプション（1日60,000円〜）で承りますので、構成を決める段階でご相談ください。',
  },
  {
    q: 'サンプルと同じ3D表現にできますか。',
    a: 'できます。製品や建物の3Dデータがあればそのまま活用し、なければ写真や図面から制作します。',
  },
  {
    q: '公開後の更新は自分でできますか。',
    a: 'お知らせやメニューなど、よく変わる部分はご自身で更新できる仕組みにできます。更新の代行も承ります。',
  },
];

// Formspree などのフォーム受信URLを入れると、相談フォームが実際に送信されます。
export const contactEndpoint = '';
