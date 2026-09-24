'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Menu,
  X,
  Check,
  Volume2,
  Box,
  Camera,
  Monitor,
  BookOpen,
  Play,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import { type Project, projects } from '@/lib/portfolio';
import Scene from './scene';
import BrandDepth from './brand-depth';
import DemoInquiry from './demo-inquiry';
import ProjectMotion from './project-motion';
import TourModal from './tour/tour-viewer';
import { openTour } from '@/lib/tour/bus';
import LuceSite from './luce-site';
import DriveSite from './works/drive-site';
import YaoyaSite from './works/yaoya-site';
import LibrarySite from './works/library-site';
import CitySite from './works/city-site';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { BASE, HOME } from '@/lib/base-path';
const Img = ({
  name,
  alt = '',
  className = '',
}: {
  name: string;
  alt?: string;
  className?: string;
}) => <img className={className} src={`${BASE}/images/${name}.jpg`} alt={alt} />;
// Self-contained works: each component renders its own sections from #top down.
const localSites: Record<
  string,
  {
    anchors: string[][];
    mark: React.ReactNode;
    contact: string;
    inquiry: string;
    closing: string;
  }
> = {
  drive: {
    anchors: [
      ['在庫車', 'stock'],
      ['車検・整備', 'service'],
      ['買取査定', 'buy'],
    ],
    mark: (
      <>
        MIRAI MOTORS<span>SALES / SERVICE / SINCE 1987</span>
      </>
    ),
    contact: '来店予約',
    inquiry: 'ご予約・お問い合わせ',
    closing: '次の出口で、お待ちしています。',
  },
  yaoya: {
    anchors: [
      ['今日の入荷', 'today'],
      ['取り置き', 'order'],
      ['お店のこと', 'story'],
    ],
    mark: (
      <>
        やおや みらい<span>商店街の八百屋</span>
      </>
    ),
    contact: '取り置きを頼む',
    inquiry: '取り置きのご依頼',
    closing: '今日も、店先でお待ちしてます。',
  },
  library: {
    anchors: [
      ['蔵書をさがす', 'search'],
      ['開館カレンダー', 'calendar'],
      ['イベント', 'events'],
    ],
    mark: (
      <>
        みらい市立図書館<span>MIRAI CITY LIBRARY</span>
      </>
    ),
    contact: 'お問い合わせ',
    inquiry: '図書館へのお問い合わせ',
    closing: 'つぎの一冊は、棚の奥に。',
  },
  city: {
    anchors: [
      ['手続き', 'procedures'],
      ['くらしの情報', 'life'],
      ['窓口・アクセス', 'access'],
    ],
    mark: (
      <>
        未来市役所<span>MIRAI CITY HALL</span>
      </>
    ),
    contact: 'お問い合わせ',
    inquiry: '市役所へのお問い合わせ',
    closing: '用事がすむまで、ご案内します。',
  },
};
const tabs = ['信頼感', '高級感', '独創的', '未来的', '遊び心'];
const themes = ['CORPORATE', 'LUXURY', 'CREATIVE', 'FUTURE', 'PLAYFUL'];
export default function ProjectExperience({
  project: p,
}: {
  project: Project;
}) {
  const [embedded, setEmbedded] = useState(true);
  const [heroSlide, setHeroSlide] = useState(0);
  const [menu, setMenu] = useState(false);
  const [inquiry, setInquiry] = useState(false);
  const [tab, setTab] = useState(0);
  const [explode, setExplode] = useState(0);
  const [picked, setPicked] = useState('PC');
  const [filter, setFilter] = useState('すべて');
  const [photo, setPhoto] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [summary, setSummary] = useState<string | undefined>();
  useEffect(
    () =>
      setEmbedded(new URLSearchParams(location.search).get('embed') === '1'),
    [],
  );
  useEffect(() => {
    const navigate = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== 'lab-jump'
      )
        return;
      const id = event.data.id;
      if (!['top', 'story', 'details', 'features'].includes(id)) return;
      if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      else
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('message', navigate);
    return () => window.removeEventListener('message', navigate);
  }, []);
  const current = projects.findIndex((x) => x.slug === p.slug);
  const next = projects[(current + 1) % projects.length];
  const openInquiry = () => {
    setSummary(undefined);
    setInquiry(true);
  };
  const openLocalInquiry = (text?: string) => {
    setSummary(text);
    setInquiry(true);
  };
  const local = localSites[p.slug];
  const anchors = local
    ? local.anchors
    : p.slug === 'nova'
      ? [
          ['私たちについて', 'story'],
          ['事業紹介', 'details'],
          ['採用情報', 'people'],
        ]
      : p.slug === 'lumina'
        ? [
            ['コンセプト', 'story'],
            ['スタイル', 'details'],
            ['メニュー', 'menu'],
          ]
        : p.slug === 'noir'
          ? [
              ['想い', 'story'],
              ['お料理', 'details'],
              ['店舗案内', 'access'],
            ]
          : p.slug === 'eclat'
            ? [
                ['コレクション', 'details'],
                ['ものづくり', 'story'],
              ]
            : p.slug === 'yui'
              ? [
                  ['作品', 'details'],
                  ['プロフィール', 'story'],
                ]
              : p.slug === 'luce'
                ? [
                    ['コンセプト', 'story'],
                    ['間取り', 'details'],
                    ['ロケーション', 'access'],
                  ]
              : [
                  ['コンセプト', 'story'],
                  ['詳しく見る', 'details'],
                ];
  return (
    <div
      className={`project-site site-${p.slug} ${embedded ? 'is-embedded' : ''} ${p.slug === 'adapt' ? `style-${tab}` : ''}`}
    >
      <ProjectMotion slug={p.slug} onExplode={setExplode} />
      {!embedded && (
        <div className="project-return">
          <a href={HOME}>
            <ArrowLeft size={15} />
            作品一覧へ戻る
          </a>
          <span>{p.category} / CONCEPT WEBSITE</span>
          <a href={`${BASE}/works/${next.slug}`}>
            次の作品 <ArrowRight size={15} />
          </a>
        </div>
      )}
      <header className="site-nav">
        <a className="site-wordmark" href="#top">
          {local ? (
            local.mark
          ) : p.slug === 'nova' ? (
            <>
              MIRAI NOVA<span>PRECISION ENGINEERING</span>
            </>
          ) : p.slug === 'lumina' ? (
            <>
              lumina mirai<span>HAIR DESIGN / TOKYO</span>
            </>
          ) : p.slug === 'noir' ? (
            <>
              TABLE 未来<span>CUISINE DE SAISON</span>
            </>
          ) : p.slug === 'eclat' ? (
            <>
              MAISON MIRAI<span>ARTISANS DU CUIR</span>
            </>
          ) : p.slug === 'casa' ? (
            <>
              CASA <i>MIRAI</i>
            </>
          ) : p.slug === 'yui' ? (
            <>
              MIRAI TAKAHASHI<span>PHOTOGRAPHER / TOKYO</span>
            </>
          ) : p.slug === 'offgrid' ? (
            <>
              OFF GRID
              <br />
              みらい<span>OUTDOOR WEEKENDER</span>
            </>
          ) : p.slug === 'room' ? (
            <>
              MIRAI ROOM<span>A CREATIVE STUDIO</span>
            </>
          ) : p.slug === 'luce' ? (
            <>
              MIRAI HILLS<span>MEGURO RESIDENCE</span>
            </>
          ) : p.slug === 'adapt' ? (
            <>
              mirai<span>A WEBSITE, LIKE YOU.</span>
            </>
          ) : (
            <>
              MIRAI<span>DESIGNED AROUND SOUND</span>
            </>
          )}
        </a>
        <nav className={menu ? 'open' : ''} aria-label="作品内ナビゲーション">
          {anchors.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
          <button className="site-contact" onClick={openInquiry}>
            {local
              ? local.contact
              : p.slug === 'lumina'
              ? 'ご予約'
              : p.slug === 'noir'
                ? 'お席のご予約'
                : p.slug === 'offgrid'
                  ? 'チケット'
                  : p.slug === 'eclat'
                    ? '来店のご相談'
                    : p.slug === 'luce'
                      ? '資料請求'
                      : 'お問い合わせ'}
            <ArrowUpRight size={15} />
          </button>
        </nav>
        <button
          className="menu-toggle"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label="メニュー"
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      {p.slug === 'nova' && (
        <>
          <section id="top" className="nova-cover">
            <div className="nova-cover-copy">
              <span className="overline">ENGINEERING THE NEXT STANDARD</span>
              <h1>
                技術のその先に、
                <br />
                新しい
                <br />
                <em>あたりまえを。</em>
              </h1>
              <p>
                精密なものづくりで、産業の未来を支える。
                <br />
                MIRAI NOVA（ミライ・ノヴァ）。
              </p>
              <a className="line-button" href="#details">
                私たちの事業 <ArrowRight size={18} />
              </a>
              <div className="nova-cover-number">
                <b>01</b>
                <span>
                  PRECISION
                  <br />
                  FOR THE FUTURE
                </span>
              </div>
            </div>
            <div className="nova-cover-photo">
              <Img
                name={['machine', 'engineer', 'architecture'][heroSlide]}
                alt="ものづくりの現場と精密技術"
              />
              <span>MIRAI NOVA / TECHNOLOGY IN EVERY DETAIL</span>
              <div className="hero-photo-select">
                {['精密技術', 'つくる人', 'デザイン'].map((t, i) => (
                  <button
                    key={t}
                    aria-pressed={heroSlide === i}
                    onClick={() => setHeroSlide(i)}
                  >
                    <b>0{i + 1}</b>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="nova-newsbar">
              <b>NEWS</b>
              <time>2026.09.01</time>
              <a href="#people">
                未来をつくる仲間を募集しています。
                <ArrowUpRight size={15} />
              </a>
            </div>
          </section>
          <section id="story" className="site-section split-section">
            <span className="section-kicker">01 / ABOUT US</span>
            <h2>
              確かな技術が、
              <br />
              社会を前に進める。
            </h2>
            <div>
              <p>
                小さな部品から、大きな仕組みまで。私たちは、一つひとつの課題に向き合うエンジニアリングカンパニーです。
              </p>
              <p>
                設計・開発から生産までをつなぎ、お客様とともに次のスタンダードをつくります。
              </p>
            </div>
          </section>
          <section id="details" className="site-section nova-business">
            <div className="section-title">
              <div>
                <span className="section-kicker">02 / BUSINESS</span>
                <h2>未来を支える、3つの事業。</h2>
              </div>
              <span>OUR FIELDS</span>
            </div>
            <div className="wide-tabs">
              {['精密機器', '産業システム', '研究・開発'].map((t, i) => (
                <button
                  key={t}
                  aria-pressed={tab === i}
                  onClick={() => setTab(i)}
                >
                  <span>0{i + 1}</span>
                  {t}
                  <ArrowUpRight size={19} />
                </button>
              ))}
            </div>
            <div className="business-detail">
              <Img
                name={
                  tab === 1 ? 'studio' : tab === 2 ? 'house' : 'architecture'
                }
                alt="事業をイメージした建築と設備"
              />
              <div>
                <span className="overline">
                  {
                    [
                      'PRECISION ENGINEERING',
                      'INDUSTRIAL SYSTEMS',
                      'RESEARCH & DEVELOPMENT',
                    ][tab]
                  }
                </span>
                <h3>
                  {
                    [
                      '細部から、品質を変える。',
                      '現場の可能性を、拡げる。',
                      'まだない答えを、つくる。',
                    ][tab]
                  }
                </h3>
                <p>
                  {
                    [
                      '要求される精度に、確かな技術で応える。設計から検査まで、品質を一貫して追求します。',
                      '人と設備が連携する現場へ。工程の見直しから運用まで、事業に合う仕組みを設計します。',
                      '素材、構造、製法。異なる分野の知見をつなぎ、試作と検証を重ねながら新しい可能性を探ります。',
                    ][tab]
                  }
                </p>
                <button className="line-button" onClick={openInquiry}>
                  この事業について相談する <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </section>
          <section id="people" className="site-section recruit-band">
            <span>CAREERS</span>
            <h2>
              次のあたりまえを、
              <br />
              一緒につくろう。
            </h2>
            <button className="solid-button" onClick={openInquiry}>
              採用について問い合わせる <ArrowUpRight size={17} />
            </button>
          </section>
        </>
      )}
      {p.slug === 'lumina' && (
        <>
          <section id="top" className="lumina-cover">
            <div className="lumina-side">
              <span>HAIR, AND YOUR OWN STORY.</span>
              <span>EST. 2026 / OMOTESANDO</span>
            </div>
            <div className="lumina-copy">
              <span className="overline">BE YOURSELF, BEAUTIFULLY.</span>
              <h1>
                似合う、の先へ。
                <br />
                <i>私らしさ</i>に出会う。
              </h1>
              <p>
                髪が変わると、気持ちも変わる。
                <br />
                あなただけの美しさを、一緒に見つけます。
              </p>
              <button className="line-button" onClick={openInquiry}>
                ご予約はこちら <ArrowRight size={18} />
              </button>
            </div>
            <div className="lumina-photo">
              <Img name="fashion" alt="柔らかなウェーブスタイル" />
            </div>
            <span className="lumina-big">mirai</span>
            <span className="lumina-edition">
              NEW SEASON
              <br />
              HAIR COLLECTION 01
            </span>
          </section>
          <section id="story" className="site-section salon-story">
            <span className="section-kicker">OUR PHILOSOPHY</span>
            <h2>
              飾るより、
              <br />
              引き出すということ。
            </h2>
            <p>
              骨格、髪質、いつもの服。好きなこと、過ごす時間。
              <br />
              丁寧な対話から、暮らしになじむスタイルを見つけていきます。
            </p>
          </section>
          <section id="details" className="site-section">
            <div className="section-title">
              <h2>日々になじむ、スタイル。</h2>
              <span>STYLE COLLECTION</span>
            </div>
            <div className="salon-style">
              <div className={`style-image crop-${tab}`}>
                <Img name="fashion" alt="ヘアスタイルの参考写真" />
              </div>
              <div>
                <div className="small-tabs">
                  {['Natural', 'Soft', 'Mode'].map((t, i) => (
                    <button
                      key={t}
                      aria-pressed={tab === i}
                      onClick={() => setTab(i)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <h3>
                  {
                    [
                      '抜け感のある、自然体。',
                      '柔らかさを、まとって。',
                      '凛とした、私らしさ。',
                    ][tab]
                  }
                </h3>
                <p>
                  {
                    [
                      '無理なくきまる、軽やかなウェーブ。毎朝のスタイリングまで考えたデザインです。',
                      '光を含むような柔らかなカラー。表情を明るく見せる、繊細なニュアンスを。',
                      'シンプルだからこそ、フォルムにこだわる。輪郭を美しく見せるスタイルです。',
                    ][tab]
                  }
                </p>
                <button className="line-button" onClick={openInquiry}>
                  このスタイルを相談する <ArrowUpRight size={18} />
                </button>
              </div>
            </div>
          </section>
          <section id="menu" className="site-section salon-menu">
            <span className="section-kicker">MENU & PRICE</span>
            <h2>メニュー</h2>
            {[
              ['カット', 'カウンセリング・シャンプー・ブロー込み', '¥6,600'],
              ['カット ＋ カラー', '髪質に合わせたカラーをご提案', '¥14,300'],
              ['ヘッドスパ', '頭皮と心をほぐす30分', '¥4,400'],
            ].map(([t, d, price]) => (
              <div className="price-row" key={t}>
                <h3>{t}</h3>
                <span>{d}</span>
                <b>{price}</b>
              </div>
            ))}
            <p className="fine-print">表示は税込・サンプル料金です。</p>
          </section>
        </>
      )}
      {p.slug === 'noir' && (
        <>
          <section id="top" className="noir-cover">
            <div className="noir-copy">
              <span className="overline">TOKYO / SEASONAL DINING</span>
              <h1>
                季節を味わう。
                <br />
                余韻を愉しむ。
              </h1>
              <p>
                ひと皿に込めた、小さな驚き。
                <br />
                今夜だけの物語を、テーブルから。
              </p>
              <a className="line-button" href="#details">
                季節のコースを見る <ArrowRight size={17} />
              </a>
              <span className="noir-season">AUTUMN, 2026 — CHAPTER 01</span>
            </div>
            <div className="noir-photo">
              <Img name="dining" alt="黒い皿に丁寧に盛り付けられた料理" />
            </div>
            <span className="vertical-note">素材を尊び、季節を映す。</span>
          </section>
          <section id="story" className="site-section restaurant-story">
            <span className="section-kicker">OUR TABLE</span>
            <h2>
              記憶に残るのは、
              <br />
              味わいと、その時間。
            </h2>
            <p>
              産地で出会った旬の素材。その輪郭を際立たせる調理。
              <br />
              会話の間に、ワインの余韻に。
              <br />
              食事という時間を、ゆっくりとお愉しみください。
            </p>
          </section>
          <section id="details" className="site-section course-section">
            <div>
              <span className="section-kicker">SEASONAL COURSE</span>
              <h2>季節のおまかせ</h2>
              <div className="small-tabs">
                {['ディナー', 'ランチ'].map((t, i) => (
                  <button
                    key={t}
                    aria-pressed={tab === i}
                    onClick={() => setTab(i)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p>
                {tab === 0
                  ? '秋の味覚を巡る、全7品のコース。'
                  : '季節のエッセンスを楽しむ、全4品のコース。'}
              </p>
              <b className="course-price">
                {tab === 0 ? '¥16,500' : '¥7,700'}
                <small>税込 / お一人様</small>
              </b>
              <button className="outline-button" onClick={openInquiry}>
                お席を予約する <ArrowUpRight size={17} />
              </button>
            </div>
            <ol className="course-list">
              {(tab === 0
                ? [
                    '季節の小さなアミューズ',
                    '秋野菜とハーブの前菜',
                    'きのこのコンソメ',
                    '本日の鮮魚',
                    '国産牛と季節野菜',
                    '果実のプレデセール',
                    '栗とカカオのデセール',
                  ]
                : [
                    '季節野菜の前菜',
                    '本日の鮮魚 または お肉料理',
                    '季節のデセール',
                    'コーヒーと小菓子',
                  ]
              ).map((t, i) => (
                <li key={t}>
                  <span>0{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </section>
          <section id="access" className="site-section access-section">
            <span className="section-kicker">VISIT US</span>
            <h2>TABLE 未来</h2>
            <div>
              <p>
                東京・青山エリアを想定した架空のレストラン
                <br />
                Lunch 12:00–15:00 / Dinner 18:00–22:00
                <br />
                定休日：月曜日
              </p>
              <button className="line-button" onClick={openInquiry}>
                ご来店について相談する <ArrowRight size={17} />
              </button>
            </div>
          </section>
        </>
      )}
      {p.slug === 'eclat' && (
        <>
          <section id="top" className={`eclat-cover color-${tab}`}>
            <div className="eclat-topline">
              <span>THE EVERYDAY COLLECTION</span>
              <span>VOL. 01 / AUTOMNE</span>
            </div>
            <h1>
              Less, but
              <br />
              <i>with soul.</i>
            </h1>
            <div className="eclat-product">
              <Img name="bag" alt="キャメル色のレザーバッグ" />
            </div>
            <div className="eclat-caption">
              <span>LE QUOTIDIEN</span>
              <p>日々に寄り添う、ひとつの美しさ。</p>
              <a href="#details" className="line-button">
                コレクションを見る <ArrowRight size={18} />
              </a>
            </div>
            <span className="eclat-volume">
              É<br />
              01
            </span>
          </section>
          <section id="story" className="site-section eclat-story">
            <span className="section-kicker">MADE TO STAY</span>
            <h2>
              使うほどに、
              <br />
              あなたのものになる。
            </h2>
            <p>
              触れたときの柔らかさ。肩にかけたときの軽やかさ。
              <br />
              装飾を引き算して、日々に必要な美しさを残しました。
            </p>
          </section>
          <section id="details" className="site-section product-selection">
            <div className={`bag-detail color-${tab}`}>
              <Img name="bag" alt="レザーバッグのカラープレビュー" />
            </div>
            <div>
              <span className="section-kicker">LE QUOTIDIEN / 01</span>
              <h2>
                毎日のための、
                <br />
                レザーショルダー。
              </h2>
              <p>
                ¥38,500 <small>税込・サンプル価格</small>
              </p>
              <div className="swatch-row" aria-label="カラー">
                {['キャメル', 'ダークブラウン', 'オリーブ'].map((t, i) => (
                  <button
                    key={t}
                    aria-pressed={tab === i}
                    onClick={() => setTab(i)}
                  >
                    <i
                      style={{
                        background: ['#a16e40', '#493429', '#777456'][i],
                      }}
                    />
                    {t}
                  </button>
                ))}
              </div>
              <dl className="spec-list">
                <div>
                  <dt>素材</dt>
                  <dd>天然皮革（コンセプト）</dd>
                </div>
                <div>
                  <dt>サイズ</dt>
                  <dd>W 28 × H 20 × D 10 cm</dd>
                </div>
                <div>
                  <dt>仕様</dt>
                  <dd>長さ調整可能なショルダーストラップ</dd>
                </div>
              </dl>
              <button className="solid-button" onClick={openInquiry}>
                来店して確かめる <ArrowUpRight size={18} />
              </button>
              <small className="fine-print">
                カラーは写真に色調処理を加えたイメージです。
              </small>
            </div>
          </section>
        </>
      )}
      {p.slug === 'aether' && (
        <>
          <section id="top" className="aether-cover">
            <div className="aether-copy">
              <span className="overline">MIRAI ONE / WIRELESS SPEAKER</span>
              <h1>
                音のかたちを、
                <br />
                <em>その手で。</em>
              </h1>
              <p>
                静かな佇まいに、広がりのある音。
                <br />
                外装を開いて、設計の内側へ。
              </p>
              <div className="aether-spec">
                <span>
                  360°<small>ROOM-FILLING SOUND</small>
                </span>
                <span>
                  01<small>PURE LISTENING</small>
                </span>
              </div>
            </div>
            <div className="aether-object">
              <Scene kind="product" progress={explode / 100} />
            </div>
            <div className="aether-control">
              <div className="small-tabs">
                {['外観', '分解', '内部'].map((t, i) => (
                  <button
                    key={t}
                    aria-pressed={explode === [0, 65, 100][i]}
                    onClick={() => setExplode([0, 65, 100][i])}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="explode-slider">
                <span>組み立て</span>
                <Slider
                  aria-label="製品の分解度"
                  value={[explode]}
                  min={0}
                  max={100}
                  onValueChange={(v) => setExplode(Array.isArray(v) ? v[0] : v)}
                />
                <span>分解</span>
                <output>{explode}%</output>
              </div>
              <p>スライダーを動かして、構造を確かめてください。</p>
            </div>
          </section>
          <section id="story" className="site-section aether-story">
            <span className="section-kicker">LESS NOISE. MORE MUSIC.</span>
            <h2>
              聴くことだけに、
              <br />
              夢中になれる。
            </h2>
            <p>
              空間になじむフォルムと、シンプルな操作。
              <br />
              暮らしのどこに置いても、あなたの音楽を引き立てます。
            </p>
          </section>
          <section id="details" className="site-section">
            <div className="section-title">
              <h2>
                小さな筐体に、
                <br />
                大きなこだわり。
              </h2>
              <span>DESIGN NOTES</span>
            </div>
            <div className="feature-columns">
              {[
                [
                  '01',
                  'アルミニウムの外装',
                  '縦に走る繊細なラインが、光と影を映す。手に触れる質感まで考えたデザイン。',
                ],
                [
                  '02',
                  '独立した内部構造',
                  '振動を制御するコアと、外装を分離した構造。3Dで部品ごとの役割を可視化。',
                ],
                [
                  '03',
                  '直感的な操作',
                  '上面のリングに、必要な操作を集約。心地よい時間を邪魔しないインターフェース。',
                ],
              ].map(([n, t, d]) => (
                <article key={n}>
                  <span>{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {p.slug === 'casa' && (
        <>
          <section id="top" className="casa-cover">
            <div className="casa-visual">
              <Img
                name="house"
                alt="大きなガラス窓とコンクリートが特徴の住宅"
              />
            </div>
            <div className="casa-copy">
              <span className="overline">A HOUSE FOR SLOW LIVING</span>
              <h1>
                光と、余白と、
                <br />
                暮らしていく。
              </h1>
              <p>CASA MIRAI — 空間の静けさを、日常に。</p>
              <button
                className="solid-button"
                aria-haspopup="dialog"
                onClick={() => openTour({ property: 'casa', mode: 'dollhouse' })}
              >
                3Dで内覧する
                <Box size={17} />
              </button>
            </div>
            <TourModal propertyId="casa" />
            <div className="casa-project-meta">
              <span>RESIDENTIAL / CONCEPT 01</span>
              <span>CONCRETE · GLASS · LIGHT</span>
            </div>
          </section>
          <section id="story" className="site-section casa-story">
            <div>
              <span className="section-kicker">THE CONCEPT</span>
              <h2>
                何もしない時間が、
                <br />
                いちばん贅沢になる。
              </h2>
              <p>
                窓を開ければ、風が通り抜ける。
                <br />
                光が移ろうたび、部屋の表情が変わる。
                <br />
                建築を主張するよりも、暮らしの背景になる住まいを。
              </p>
            </div>
            <Img name="hotel" alt="自然光の入る落ち着いた室内" />
          </section>
          <section id="details" className="site-section casa-detail">
            <span className="section-kicker">PROJECT OUTLINE</span>
            <h2>暮らしを、丁寧に設計する。</h2>
            <dl className="spec-list">
              <div>
                <dt>プロジェクト</dt>
                <dd>CASA MIRAI / コンセプト住宅</dd>
              </div>
              <div>
                <dt>空間構成</dt>
                <dd>リビング・ダイニング / 寝室 / テラス</dd>
              </div>
              <div>
                <dt>マテリアル</dt>
                <dd>コンクリート / ガラス / 天然木</dd>
              </div>
            </dl>
            <button className="line-button" onClick={openInquiry}>
              住まいづくりを相談する <ArrowRight size={18} />
            </button>
          </section>
        </>
      )}
      {p.slug === 'room' && (
        <>
          <section id="top" className="room-cover">
            <div className="room-intro">
              <span className="overline">WELCOME TO MY LITTLE STUDIO</span>
              <h1>
                アイデアは、
                <br />
                この部屋から。
              </h1>
              <p>道具を選ぶと、つくっているものが見えてきます。</p>
            </div>
            <div className="room-explore">
              <Scene kind="room" onPick={setPicked} />
            </div>
            <div className="room-directory">
              {[
                ['PC', 'WEB制作', Monitor],
                ['CAMERA', '写真・映像', Camera],
                ['BOOKS', 'プロフィール', BookOpen],
                ['TV', 'モーション', Play],
              ].map(([id, label, Icon]) => {
                const I = Icon as typeof Monitor;
                return (
                  <button
                    key={String(id)}
                    aria-pressed={picked === id}
                    onClick={() => setPicked(String(id))}
                  >
                    <I size={18} />
                    <span>{String(label)}</span>
                    <ArrowUpRight size={15} />
                  </button>
                );
              })}
            </div>
            <div className="room-detail" aria-live="polite">
              <span>
                {picked === 'PC'
                  ? '01 / DIGITAL'
                  : picked === 'CAMERA'
                    ? '02 / VISUAL'
                    : picked === 'BOOKS'
                      ? '03 / ABOUT'
                      : '04 / MOTION'}
              </span>
              <h2>
                {
                  {
                    PC: '考えを、使えるかたちに。',
                    CAMERA: '光と時間を、切り取る。',
                    BOOKS: 'つくることを、日常に。',
                    TV: '動きのなかに、意味を。',
                  }[picked]
                }
              </h2>
              <p>
                {
                  {
                    PC: 'ブランドの個性と、訪れる人の使いやすさ。両方を大切にしたWEBサイトをつくります。',
                    CAMERA:
                      '人物、建築、日常の風景。その場の空気を伝える写真と映像を制作しています。',
                    BOOKS:
                      '東京を拠点に、WEB・写真・映像を横断する架空のクリエイティブスタジオです。',
                    TV: 'ロゴ、文字、映像。見る人の視線を導く、意味のある動きをデザインします。',
                  }[picked]
                }
              </p>
            </div>
          </section>
          <section id="story" className="site-section studio-story">
            <Img
              name="studio"
              alt="自然光が入るクリエイティブなワークスペース"
            />
            <div>
              <span className="section-kicker">A PLACE TO MAKE</span>
              <h2>
                ひとつの場所から、
                <br />
                いくつもの表現へ。
              </h2>
              <p>
                考えて、試して、つくり直す。その繰り返しを楽しむ、小さな制作室です。
              </p>
            </div>
          </section>
          <section id="details" className="site-section">
            <span className="section-kicker">LET'S MAKE SOMETHING</span>
            <h2>つくりたいものの話を、しませんか。</h2>
            <button className="line-button" onClick={openInquiry}>
              制作を相談する <ArrowRight size={18} />
            </button>
          </section>
        </>
      )}
      {p.slug === 'yui' && (
        <>
          <section id="top" className="yui-cover">
            <div className="yui-heading">
              <span>
                SELECTED PHOTOGRAPHS
                <br />
                2024 — 2026
              </span>
              <h1>
                日々の、
                <br />
                <i>余白を写す。</i>
              </h1>
              <p>
                Mirai Takahashi
                <br />
                Photography & Art Direction
              </p>
            </div>
            <div className="yui-main-photo">
              <Img name="hotel" alt="静かな光に包まれた日本の室内" />
              <span>01 — STILLNESS, JAPAN</span>
            </div>
            <div className="yui-small-photo">
              <Img name="fashion" alt="自然な表情のポートレート" />
              <span>02 — A PORTRAIT</span>
            </div>
          </section>
          <section id="details" className="site-section photo-works">
            <div className="section-title">
              <h2>作品</h2>
              <div className="small-tabs">
                {['すべて', '空間', '人物', '風景'].map((t) => (
                  <button
                    key={t}
                    aria-pressed={filter === t}
                    onClick={() => setFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="photo-grid">
              {[
                { image: 'hotel', type: '空間', title: '静けさの輪郭' },
                { image: 'fashion', type: '人物', title: 'いつもの表情' },
                { image: 'outdoors', type: '風景', title: '遠くの稜線' },
                { image: 'house', type: '空間', title: '光の通り道' },
                { image: 'architecture', type: '空間', title: '構造とリズム' },
                { image: 'studio', type: '空間', title: 'つくる人の場所' },
              ]
                .filter((x) => filter === 'すべて' || x.type === filter)
                .map((x, i) => (
                  <button key={x.image} onClick={() => setPhoto(x.image)}>
                    <Img name={x.image} alt={x.title} />
                    <span>
                      <b>{x.title}</b>
                      <small>
                        {x.type} / 0{i + 1}
                      </small>
                      <Plus size={16} />
                    </span>
                  </button>
                ))}
            </div>
          </section>
          <section id="story" className="site-section photographer-story">
            <span className="section-kicker">ABOUT</span>
            <h2>高橋 みらい</h2>
            <p>
              写真家・アートディレクター。
              <br />
              東京を拠点に、建築、人物、日常の風景を撮影。
              <br />
              目立たないけれど、確かにそこにある美しさを探しています。
            </p>
            <button className="line-button" onClick={openInquiry}>
              撮影について相談する <ArrowRight size={18} />
            </button>
          </section>
        </>
      )}
      {p.slug === 'adapt' && (
        <>
          <section id="top" className="adapt-cover">
            <div className="adapt-topline">
              <span>YOU CHOOSE. WE ADAPT.</span>
              <span>INTERACTIVE EXPERIMENT / 01</span>
            </div>
            <div className="adapt-copy">
              <span className="overline">
                {
                  ['TRUST', 'REFINEMENT', 'EXPRESSION', 'POSSIBILITY', 'PLAY'][
                    tab
                  ]
                }
              </span>
              <h1>
                {[
                  '信頼が伝わる、\n端正な佇まい。',
                  '静けさのなかに、\n上質を。',
                  'あなたらしさを、\nもっと自由に。',
                  'まだ見ぬ未来を、\nここから。',
                  '毎日に、\n遊び心を。',
                ][tab]
                  .split('\n')
                  .map((t, i) => (
                    <span key={i}>
                      {t}
                      <br />
                    </span>
                  ))}
              </h1>
              <p>好みを選んで、ページの変化を体験してください。</p>
            </div>
            <div className="adapt-object">
              <Scene kind="adaptive" theme={themes[tab]} />
            </div>
            <div className="adapt-selector">
              {tabs.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(i)}
                  aria-pressed={tab === i}
                >
                  <span>0{i + 1}</span>
                  {t}
                  {tab === i ? <Check size={16} /> : <ArrowUpRight size={16} />}
                </button>
              ))}
            </div>
          </section>
          <section id="story" className="site-section adapt-story">
            <span className="section-kicker">DESIGNED AROUND YOU</span>
            <h2>
              同じ内容でも、
              <br />
              伝わる印象は変わる。
            </h2>
            <p>
              色、文字、形、余白。小さな選択の組み合わせが、そのブランドらしさをつくります。
              <br />
              このデモでは、あなたが選んだスタイルに合わせてデザインが変わります。
            </p>
          </section>
          <section id="details" className="site-section">
            <div className="feature-columns">
              {[
                ['色', 'ブランドの温度を伝えるパレット。'],
                ['文字', '内容にふさわしいリズムと表情。'],
                ['かたち', '動きと立体で伝わる個性。'],
              ].map(([t, d]) => (
                <article key={t}>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
            <p className="fine-print">
              選択式のデザインデモです。生成AIへの接続はありません。
            </p>
          </section>
        </>
      )}
      {p.slug === 'luce' && (
        <LuceSite onInquiry={openInquiry} onTour={(room) => openTour('luce', room)} />
      )}
      {p.slug === 'drive' && <DriveSite onInquiry={openLocalInquiry} />}
      {p.slug === 'yaoya' && <YaoyaSite onInquiry={openLocalInquiry} />}
      {p.slug === 'library' && <LibrarySite onInquiry={openLocalInquiry} />}
      {p.slug === 'city' && <CitySite onInquiry={openLocalInquiry} />}
      {p.slug === 'offgrid' && (
        <>
          <section id="top" className="offgrid-cover">
            <Img name="outdoors" alt="山の稜線を眺めるハイカー" />
            <div className="offgrid-overlay" />
            <div className="offgrid-topline">
              <span>TAKE A BREATH. GO OUTSIDE.</span>
              <span>2026.10.17 — 18</span>
            </div>
            <h1>
              いつもの、
              <br />
              <i>外へ。</i>
            </h1>
            <div className="offgrid-bottom">
              <p>
                山と音楽、おいしいごはん。
                <br />
                自分に還る、2日間のウィークエンド。
              </p>
              <a className="solid-button" href="#details">
                プログラムを見る <ArrowUpRight size={18} />
              </a>
              <span>
                OUTDOOR
                <br />
                WEEKENDER / 2026
              </span>
            </div>
          </section>
          <section id="story" className="site-section offgrid-story">
            <span className="section-kicker">LEAVE THE EVERYDAY BEHIND</span>
            <h2>
              通知を、風の音に。
              <br />
              いつもの道を、山道に。
            </h2>
            <p>
              予定を詰めこまない週末。森を歩き、音楽を聴いて、同じテーブルを囲む。
              <br />
              自然のリズムに、少しだけ身をまかせてみませんか。
            </p>
          </section>
          <section id="details" className="site-section offgrid-program">
            <div className="section-title">
              <h2>週末の過ごし方。</h2>
              <div className="small-tabs">
                {['10.17 SAT', '10.18 SUN'].map((t, i) => (
                  <button
                    key={t}
                    aria-pressed={tab === i}
                    onClick={() => setTab(i)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="schedule">
              {(tab === 0
                ? [
                    [
                      '10:00',
                      '森を歩く',
                      'ガイドと一緒に、ゆっくりトレッキング。',
                    ],
                    [
                      '13:00',
                      'みんなのテーブル',
                      '地元の食材を楽しむアウトドアランチ。',
                    ],
                    [
                      '16:00',
                      '山の音楽会',
                      '風の音に重なる、アコースティックライブ。',
                    ],
                  ]
                : [
                    [
                      '08:00',
                      '朝の深呼吸',
                      '芝生の上で、やさしいモーニングヨガ。',
                    ],
                    [
                      '11:00',
                      'コーヒーと景色',
                      '自分で淹れる一杯を、山の眺めと。',
                    ],
                    [
                      '14:00',
                      'また会う日まで',
                      '週末の余韻と一緒に、それぞれの日常へ。',
                    ],
                  ]
              ).map(([t, n, d]) => (
                <article key={t}>
                  <time>{t}</time>
                  <h3>{n}</h3>
                  <p>{d}</p>
                  <ArrowUpRight size={18} />
                </article>
              ))}
            </div>
            <div className="ticket-panel">
              <div>
                <span>1 DAY TICKET / サンプル</span>
                <h3>
                  {tab === 0 ? '10月17日（土）' : '10月18日（日）'} 入場券
                </h3>
                <p>¥4,500 / 1名・税込</p>
              </div>
              <div className="quantity">
                <button
                  aria-label="人数を減らす"
                  disabled={quantity === 1}
                  onClick={() => setQuantity(quantity - 1)}
                >
                  <Minus size={16} />
                </button>
                <output>{quantity}名</output>
                <button
                  aria-label="人数を増やす"
                  disabled={quantity === 6}
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div>
                <b>¥{(4500 * quantity).toLocaleString()}</b>
                <button className="solid-button" onClick={openInquiry}>
                  チケットを確認 <ArrowUpRight size={17} />
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      <BrandDepth slug={p.slug} onInquiry={openInquiry} />
      <section className="brand-closing">
        <div>
          <span>LET’S MAKE IT PERSONAL.</span>
          <h2>
            {local
              ? local.closing
              : p.slug === 'lumina'
              ? '次は、あなたの「なりたい」を。'
              : p.slug === 'noir'
                ? '次のひと皿は、あなたの席で。'
                : p.slug === 'nova'
                  ? 'その課題から、未来をつくろう。'
                  : p.slug === 'luce'
                    ? 'この眺めを、確かめに。'
                    : 'つづきは、あなたと。'}
          </h2>
        </div>
        <button onClick={openInquiry}>
          相談をはじめる
          <ArrowUpRight size={24} />
        </button>
      </section>
      {!embedded && (
        <a className="work-consult" href={`${HOME}?ref=${p.slug}#contact`}>
          <img src={`${BASE}/images/works/${p.slug}-desktop.jpg`} alt="" />
          <span>
            <small>Web Experience Lab の制作サンプルです</small>
            このテイストで制作を相談する
          </span>
          <ArrowUpRight size={18} />
        </a>
      )}
      <footer className="site-footer">
        <a href="#top">{p.name}</a>
        <span>架空ブランドの制作サンプル / © 2026</span>
        <a href={HOME} target={embedded ? '_top' : undefined}>
          作品一覧へ <ArrowUpRight size={15} />
        </a>
      </footer>
      <DemoInquiry
        slug={p.slug}
        open={inquiry}
        onClose={() => setInquiry(false)}
        title={
          local
            ? local.inquiry
            : p.slug === 'lumina'
            ? 'サロンのご予約'
            : p.slug === 'noir'
              ? 'お席のご予約'
              : p.slug === 'offgrid'
                ? 'チケットのお申し込み'
                : p.slug === 'luce'
                  ? '資料請求・モデルルーム来場予約'
                  : 'お問い合わせ'
        }
        summary={
          local
            ? summary
            : p.slug === 'offgrid'
            ? `${tab === 0 ? '10/17' : '10/18'}・${quantity}名・合計¥${(quantity * 4500).toLocaleString()}。`
            : p.slug === 'noir'
              ? `${tab === 0 ? 'ディナー' : 'ランチ'}のご予約。`
              : undefined
        }
      />
      <Dialog open={!!photo} onOpenChange={(v) => !v && setPhoto(null)}>
        <DialogContent className="photo-dialog">
          <DialogTitle>作品を大きく見る</DialogTitle>
          <DialogDescription>
            MIRAI TAKAHASHI / SELECTED PHOTOGRAPHS
          </DialogDescription>
          {photo && <Img name={photo} alt="選択した写真作品" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
