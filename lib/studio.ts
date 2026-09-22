export const goals = [
  { id: 'all', label: 'すべて' },
  { id: 'brand', label: '会社・ブランドを伝えたい' },
  { id: 'booking', label: '予約・申込みを増やしたい' },
  { id: '3d', label: '3Dで製品・空間を見せたい' },
  { id: 'photo', label: '写真で魅せたい' },
] as const;
export type GoalId = (typeof goals)[number]['id'];

export const workMeta: Record<
  string,
  { goals: GoalId[]; built: string[]; scale: string }
> = {
  nova: {
    goals: ['brand'],
    built: ['事業別の切り替え', '技術工程の図解', '採用導線'],
    scale: '8ページ前後・約6週間',
  },
  lumina: {
    goals: ['brand', 'booking'],
    built: ['スタイルギャラリー', 'メニュー表', '予約フォーム'],
    scale: '5ページ前後・約5週間',
  },
  noir: {
    goals: ['booking', 'photo'],
    built: ['コース切り替え', '時間帯つき予約', 'シェフ紹介'],
    scale: '5ページ前後・約5週間',
  },
  eclat: {
    goals: ['brand', 'photo'],
    built: ['カラー選択', '素材の拡大表示', '来店相談'],
    scale: '6ページ前後・約6週間',
  },
  aether: {
    goals: ['3d'],
    built: ['リアルタイム3D', '分解スライダー', 'パーツ解説'],
    scale: '1〜3ページ・約8週間',
  },
  casa: {
    goals: ['3d', 'photo'],
    built: ['3D内覧', '昼夜の切り替え', '間取り図'],
    scale: '3〜5ページ・約9週間',
  },
  room: {
    goals: ['3d'],
    built: ['空間の探索', 'クリックで作品紹介', '3Dモデル'],
    scale: '1〜3ページ・約8週間',
  },
  yui: {
    goals: ['photo', 'brand'],
    built: ['作品の絞り込み', '写真の拡大表示', 'ジャーナル'],
    scale: '4ページ前後・約4週間',
  },
  adapt: {
    goals: ['3d', 'brand'],
    built: ['5つのスタイル切り替え', 'WebGLオブジェクト', '文字組み'],
    scale: '1〜2ページ・約6週間',
  },
  offgrid: {
    goals: ['booking', 'photo'],
    built: ['日程の切り替え', 'タイムテーブル', 'チケット申込み'],
    scale: '1ページ・約4週間',
  },
};

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
    example: 'casa',
    body: '製品の分解、建物の内覧、空間の探索。言葉だけでは伝わりにくい魅力を、操作できる形で見せます。',
  },
  {
    title: 'スマホで|軽く動く',
    example: 'adapt',
    body: '3Dも写真も、スマートフォンで快適に動くよう描画量と読み込みを調整。アクセシビリティにも配慮します。',
  },
];

export const plans = [
  {
    name: 'ランディングページ',
    price: '18万円〜',
    period: '1ページ・約3週間',
    fit: 'キャンペーン、イベント、新サービスの告知に',
    items: ['構成とコピーのご提案', 'オリジナルデザイン', 'スマホ対応', '問い合わせフォーム'],
    example: 'offgrid',
  },
  {
    name: 'ブランドサイト',
    price: '45万円〜',
    period: '5〜8ページ・約6週間',
    fit: '会社、店舗、サロン、ブランドの公式サイトに',
    items: ['ランディングページの内容すべて', '予約・申込みの導線設計', '撮影ディレクション', '更新しやすい仕組み'],
    example: 'lumina',
  },
  {
    name: '3D・インタラクティブ',
    price: '80万円〜',
    period: '約8〜10週間',
    fit: '製品、建築、空間を触って見せたいときに',
    items: ['ブランドサイトの内容すべて', '3Dモデルの制作・調整', 'WebGL演出', '端末ごとの描画最適化'],
    example: 'aether',
  },
];

export const steps = [
  { title: 'ご相談', period: '無料', body: '目的・予算・時期をうかがいます。気になった作品があれば、それを見ながら話すと早く進みます。' },
  { title: 'ご提案とお見積り', period: '約1週間', body: '構成案と進め方、お見積りをお送りします。この時点ではまだ費用はかかりません。' },
  { title: 'デザイン', period: '2〜4週間', body: 'トップページから方向性を固め、各ページに広げます。修正は各段階で2回まで含みます。' },
  { title: '実装と確認', period: '2〜4週間', body: 'PCとスマートフォンの実機で動作を確認します。3Dは端末ごとに描画を調整します。' },
  { title: '公開と運用', period: '公開後1か月サポート', body: '公開作業を行い、公開後1か月は不具合の修正と簡単な更新に無料で対応します。' },
];

export const faqs = [
  {
    q: '写真や文章がまだ揃っていません。',
    a: '大丈夫です。構成案の段階でコピーをご提案し、撮影が必要な場合はディレクションや手配もご相談いただけます。',
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
