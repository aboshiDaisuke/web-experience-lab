'use client';
import { useState, useRef } from 'react';
import Scene from '@/components/scene';
import Animations from '@/components/animations';
import WebMCP from '@/components/webmcp';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { works, industries } from '@/lib/content';
const Arrow = () => <span aria-hidden="true">↗</span>;
const Label = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <div className="section-label">
    <span>
      {n} / {children}
    </span>
    <span>CONCEPT EXPERIENCE</span>
  </div>
);
export default function Home() {
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState('EXTERIOR');
  const [night, setNight] = useState(false);
  const [theme, setTheme] = useState('CREATIVE');
  const [roomInfo, setRoomInfo] = useState('');
  const [contact, setContact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const w = selected === null ? null : works[selected];
  const descriptions: Record<string, string> = {
    PC: 'WEB DESIGN — 企業サイトからインタラクティブLPまで。事業の個性を、使いやすい体験に。',
    CAMERA:
      'PHOTO / VIDEO — 一瞬の光、動き、表情。ブランドの温度を伝えるビジュアル制作。',
    BOOKS:
      'PROFILE — 東京を拠点に、デザインとテクノロジーのあいだを探究するクリエイティブスタジオ。',
    TV: 'MOTION DESIGN — タイポグラフィと映像にリズムを。時間の流れまでデザインします。',
  };
  return (
    <main>
      <Animations />
      <WebMCP setTheme={setTheme} />
      <a href="#experiences" className="skip-link">
        作品に移動
      </a>
      <header className="nav">
        <a href="#top" className="brand" aria-label="WEB EXPERIENCE LAB トップ">
          W/E<span>WEB EXPERIENCE LAB</span>
        </a>
        <nav aria-label="メインナビゲーション">
          <a href="#experiences">
            Experiences <sup>10</sup>
          </a>
          <a href="#about">About the lab</a>
          <a href="#contact" className="nav-contact">
            Let's talk <Arrow />
          </a>
        </nav>
      </header>
      <section className="hero" id="top">
        <div className="hero-top">
          <span>
            <i /> INDEPENDENT DIGITAL EXPERIENCE STUDIO
          </span>
          <span>DESIGN × TECHNOLOGY × POSSIBILITY</span>
        </div>
        <div className="hero-art">
          <Scene kind="hero" />
        </div>
        <div className="hero-title">
          <p>BEYOND THE ORDINARY.</p>
          <h1>
            WEB
            <br />
            <span>EXPERIENCE</span>
            <em>BEYOND THE SCREEN.</em>
          </h1>
        </div>
        <div className="object-coordinate">
          FIG. 001
          <br />
          FORM WITHOUT LIMITS
        </div>
        <div className="hero-bottom">
          <p>
            スクリーンの、その先へ。
            <br />
            <span>心を動かす、新しいWEB体験を。</span>
          </p>
          <a className="pill" href="#experiences">
            Explore experiences <span>↘</span>
          </a>
          <span className="scroll-note">
            SCROLL TO DISCOVER
            <br />↓
          </span>
        </div>
        <div className="hero-foot">
          <span>CREATIVE DEVELOPMENT / TOKYO, JP</span>
          <span>01 — 13</span>
          <span>INTERACTIVE PORTFOLIO / VOL. 01</span>
        </div>
      </section>
      <section id="about" className="intro section">
        <span className="eyebrow">02 / THE PHILOSOPHY</span>
        <h2>
          <span className="line">WE DON'T JUST</span>
          <span className="line">BUILD WEBSITES.</span>
          <span className="line">
            WE BUILD <em>EXPERIENCES.</em>
          </span>
        </h2>
        <p>
          WEBサイトを作るだけではありません。
          <br />
          記憶に残り、心が動く。そんな体験をデザインします。
        </p>
        <div className="categories">
          <a href="#corporate">STANDARD ↗</a>
          <a href="#motion">MOTION ↗</a>
          <a href="#product">3D ↗</a>
          <a href="#adaptive">AI EXPERIENCE ↗</a>
        </div>
      </section>
      <section id="experiences" className="experience-heading section">
        <span className="eyebrow">SELECTED EXPERIENCES / 2026</span>
        <div>
          <h2>
            Not just seen.
            <br />
            <i>Felt.</i>
          </h2>
          <p>
            ひとつのスクロール。その先に、違う世界。
            <br />
            10の可能性を、体験してください。
          </p>
          <span className="large-count">
            10<sup>EXPERIENCES</sup>
          </span>
        </div>
      </section>
      <section id="corporate" className="corporate section">
        <Label n="03">STANDARD WEB</Label>
        <div className="work-heading">
          <h2>
            Clean. Fast.
            <br />
            Reliable.
          </h2>
          <div>
            <p>CORPORATE WEBSITE</p>
            <span>信頼を、デザインする。</span>
          </div>
          <button
            className="round-link"
            aria-label="NOVA INDUSTRIESを見る"
            onClick={() => setSelected(0)}
            data-cursor="OPEN"
          >
            <Arrow />
          </button>
        </div>
        <div className="browser-window">
          <div className="browser-toolbar">
            <span>● ● ●</span>
            <span>nova-industries.example</span>
            <span>↗</span>
          </div>
          <div className="nova-nav">
            <b>
              NOVA<span> INDUSTRIES</span>
            </b>
            <div>
              {[
                '企業紹介',
                '事業紹介',
                'テクノロジー',
                '採用',
                'Contact ↗',
              ].map((t) => (
                <button key={t} onClick={() => setSelected(0)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="nova-body">
            <div className="nova-copy">
              <span>ENGINEERING A BETTER TOMORROW</span>
              <h3>
                Progress,
                <br />
                by design.
              </h3>
              <p>
                その技術が、
                <br />
                未来のあたりまえになる。
              </p>
              <button onClick={() => setSelected(0)}>
                私たちについて <Arrow />
              </button>
            </div>
            <div className="nova-photo">
              <img
                src="/images/architecture.jpg"
                alt="彫刻のようなコンクリート建築"
                loading="lazy"
              />
            </div>
          </div>
          <div className="nova-news">
            <span>NEWS</span>
            <span>2026.09.01</span>
            <span>未来をつくる、新たな挑戦が始まります。</span>
            <Arrow />
          </div>
        </div>
        <div className="work-caption">
          <span>01 — NOVA INDUSTRIES</span>
          <span>STRATEGY / DESIGN / DEVELOPMENT</span>
        </div>
      </section>
      <section id="motion" className="fashion">
        <div className="fashion-top">
          <span>04 / MOTION WEBSITE</span>
          <span>02 — LUMINA HAIR</span>
        </div>
        <div className="fashion-image">
          <img
            src="/images/fashion.jpg"
            alt="自然なウェーブヘアの女性のポートレート"
            loading="lazy"
          />
        </div>
        <div className="fashion-word">
          Beauty <i>in</i>
          <br />
          <span>motion.</span>
        </div>
        <div className="fashion-side">YOUR BEAUTY. YOUR RHYTHM.</div>
        <div className="fashion-bottom">
          <div>
            <h3>LUMINA HAIR</h3>
            <p>あなたらしさが、動き出す。</p>
          </div>
          <button
            className="pill"
            onClick={() => setSelected(1)}
            data-cursor="OPEN"
          >
            Beauty × Motion <Arrow />
          </button>
        </div>
      </section>
      <section className="restaurant section" id="restaurant">
        <Label n="05">RESTAURANT EXPERIENCE</Label>
        <p className="restaurant-brand">
          N / T <span>NOIR TABLE</span>
        </p>
        <h2>
          Taste the <i>Story.</i>
        </h2>
        <div className="dish-stage">
          <div className="dish-note left">
            <span>01 / THE INGREDIENT</span>
            <h3>季節を、ひと皿に。</h3>
            <p>
              旬の素材が語る、
              <br />
              その日だけの物語。
            </p>
          </div>
          <div
            className="dish-photo"
            onPointerMove={(e) => {
              if (
                matchMedia('(prefers-reduced-motion:reduce), (pointer:coarse)')
                  .matches
              )
                return;
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.transform = `perspective(800px) rotateX(${-(e.clientY - r.top - r.height / 2) / 45}deg) rotateY(${(e.clientX - r.left - r.width / 2) / 45}deg)`;
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.transform = '';
            }}
          >
            <img
              src="/images/dining.jpg"
              alt="黒いプレートに盛り付けられた繊細な料理"
              loading="lazy"
            />
          </div>
          <div className="dish-note right">
            <span>02 / THE EXPERIENCE</span>
            <h3>余韻まで、美しく。</h3>
            <p>
              味、香り、空間。
              <br />
              五感で味わうひととき。
            </p>
          </div>
        </div>
        <button
          className="text-link"
          onClick={() => setSelected(2)}
          data-cursor="OPEN"
        >
          DISCOVER NOIR TABLE <Arrow />
        </button>
      </section>
      <section className="product-scroll" id="product">
        <div className="product-sticky">
          <Label n="06">3D PRODUCT EXPERIENCE</Label>
          <div className="product-title">
            <p>AETHER ONE</p>
            <h2>
              Sound.
              <br />
              Without
              <br />
              <i>limits.</i>
            </h2>
          </div>
          <Scene kind="product" />
          <div className="product-detail">
            <span>DESIGNED TO BE DISCOVERED</span>
            <h3>
              Explore
              <br />
              Every Detail.
            </h3>
            <p>スクロールして、音の中心へ。</p>
            <button className="text-link" onClick={() => setSelected(4)}>
              製品のコンセプト <Arrow />
            </button>
          </div>
          <div className="product-stages">
            <span>01 FORM</span>
            <span>02 ROTATE</span>
            <span>03 CLOSER</span>
            <span>04 EXPLODE</span>
            <span>05 INSIDE</span>
            <span>06 REUNITE</span>
          </div>
        </div>
      </section>
      <section
        className={`architecture section ${night ? 'night' : ''}`}
        id="architecture"
        data-view={view}
        data-night={night}
      >
        <Label n="07">ARCHITECTURAL EXPERIENCE</Label>
        <div className="architecture-heading">
          <h2>
            Spaces for
            <br />
            <i>possibility.</i>
          </h2>
          <div>
            <p>CASA N01</p>
            <span>Walk Through Your Vision.</span>
            <button
              className="day-toggle"
              aria-pressed={night}
              onClick={() => setNight(!night)}
            >
              {night ? '☾ NIGHT' : '☀ DAY'} <span>切り替える</span>
            </button>
          </div>
        </div>
        <div className="house-stage">
          <Scene kind="house" view={view} night={night} />
          <span className="scene-hint">↔ DRAG TO EXPLORE</span>
        </div>
        <div className="view-controls" aria-label="建築の視点">
          {['EXTERIOR', 'LIVING', 'BEDROOM', 'NIGHT'].map((t) => (
            <button
              key={t}
              aria-pressed={view === t}
              onClick={() => {
                setView(t);
                setNight(t === 'NIGHT');
              }}
            >
              {t}
              <Arrow />
            </button>
          ))}
        </div>
      </section>
      <section className="virtual section" id="virtual">
        <Label n="08">VIRTUAL EXPERIENCE</Label>
        <div className="virtual-grid">
          <div>
            <h2>
              Open a door.
              <br />
              <i>Find a story.</i>
            </h2>
            <p>Explore the Web.</p>
            <p className="muted">
              いつものWEBを、探索する空間へ。
              <br />
              部屋のオブジェクトをクリックしてみてください。
            </p>
            <div className="room-links">
              {[
                ['PC', 'WEB DESIGN'],
                ['CAMERA', 'PHOTO / VIDEO'],
                ['BOOKS', 'PROFILE'],
                ['TV', 'MOTION DESIGN'],
              ].map(([key, name], i) => (
                <button
                  key={key}
                  aria-pressed={roomInfo === key}
                  onClick={() => setRoomInfo(key)}
                >
                  <span>0{i + 1}</span>
                  {name}
                  <Arrow />
                </button>
              ))}
            </div>
          </div>
          <div className="room-stage">
            <Scene kind="room" onPick={setRoomInfo} />
            <span className="scene-hint">
              THE CREATIVE ROOM / CLICK TO EXPLORE
            </span>
          </div>
        </div>
        <div className="room-output" aria-live="polite">
          {roomInfo
            ? descriptions[roomInfo]
            : '部屋のPC、カメラ、本棚、テレビから、ストーリーを見つけてください。'}
        </div>
      </section>
      <section
        id="adaptive"
        className={`adaptive section theme-${theme.toLowerCase()}`}
        data-theme={theme}
      >
        <Label n="09">AI ADAPTIVE EXPERIENCE</Label>
        <div className="adaptive-heading">
          <p>A WEBSITE THAT CHANGES WITH YOU.</p>
          <h2>
            WHAT DO YOU
            <br />
            WANT TO <i>CREATE?</i>
          </h2>
        </div>
        <div className="theme-options" aria-label="デザインの雰囲気">
          {['CORPORATE', 'LUXURY', 'CREATIVE', 'FUTURE', 'PLAYFUL'].map((t) => (
            <button
              key={t}
              aria-pressed={t === theme}
              onClick={() => setTheme(t)}
            >
              {t}
              <span>{t === theme ? '●' : '↗'}</span>
            </button>
          ))}
        </div>
        <div className="adaptive-preview">
          <div>
            <span>YOUR VISION / {theme}</span>
            <h3>
              {theme === 'CORPORATE'
                ? 'Built on trust.'
                : theme === 'LUXURY'
                  ? 'Quietly exceptional.'
                  : theme === 'FUTURE'
                    ? 'Hello, tomorrow.'
                    : theme === 'PLAYFUL'
                      ? 'Make room for fun.'
                      : 'Make it different.'}
            </h3>
            <p>選ぶたびに変わる、あなたのWEB。</p>
            <a href="#contact">
              MAKE IT YOURS <Arrow />
            </a>
          </div>
          <Scene kind="adaptive" theme={theme} />
        </div>
        <p className="adaptive-note">
          INTERACTIVE CONCEPT —
          選択に連動するデザインデモです。生成AIは使用していません。
        </p>
      </section>
      <section className="collection section" id="collection">
        <Label n="10">INDUSTRY COLLECTION</Label>
        <div className="collection-heading">
          <h2>
            Different worlds.
            <br />
            Same ambition.
          </h2>
          <div>
            <button
              aria-label="前の作品"
              className="round-link"
              onClick={() =>
                rail.current?.scrollBy({ left: -400, behavior: 'smooth' })
              }
            >
              ←
            </button>
            <button
              aria-label="次の作品"
              className="round-link"
              onClick={() =>
                rail.current?.scrollBy({ left: 400, behavior: 'smooth' })
              }
            >
              →
            </button>
          </div>
        </div>
        <div
          className="collection-rail"
          ref={rail}
          tabIndex={0}
          aria-label="制作可能な業種。横にスクロール"
        >
          {industries.map((name, i) => {
            const indexes = [0, 1, 2, 3, 5, 5, 0, 7, 0, 0, 7, 9];
            const index = indexes[i];
            return (
              <button
                className="industry-item"
                key={name}
                onClick={() => setSelected(index)}
                data-cursor="OPEN"
              >
                <div className="industry-image">
                  <img
                    src={`/images/${works[index].image}.jpg`}
                    alt={`${name}のサンプルイメージ`}
                    loading="lazy"
                  />
                  <span>VIEW EXPERIENCE ↗</span>
                </div>
                <div className="industry-label">
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <h3>{name}</h3>
                  <Arrow />
                </div>
              </button>
            );
          })}
        </div>
        <div className="more-experiences">
          <span>MORE WORLDS TO EXPLORE</span>
          {[3, 7, 9].map((i) => (
            <button key={i} onClick={() => setSelected(i)}>
              <span>{works[i].category}</span>
              {works[i].name}
              <Arrow />
            </button>
          ))}
        </div>
      </section>
      <section className="capability" id="capability">
        <div className="section-label">
          <span>11 / OUR TOOLKIT</span>
          <span>CRAFT MEETS CODE</span>
        </div>
        <Scene kind="capability" />
        <div className="marquee">
          <div>
            HTML / CSS · JAVASCRIPT · THREE.JS · WEBGL · GSAP ·{' '}
            <span aria-hidden="true">
              HTML / CSS · JAVASCRIPT · THREE.JS · WEBGL · GSAP ·{' '}
            </span>
          </div>
        </div>
        <div className="marquee reverse">
          <div>
            BLENDER · 3D MODEL · MOTION · AI ·{' '}
            <span aria-hidden="true">BLENDER · 3D MODEL · MOTION · AI · </span>
          </div>
        </div>
        <div className="capability-foot">
          <span>RESPONSIVE / CMS / VIDEO</span>
          <p>技術は、アイデアを解き放つために。</p>
        </div>
      </section>
      <section className="process section" id="process">
        <Label n="12">HOW WE CREATE</Label>
        <h2>
          From the first spark.
          <br />
          To the final pixel.
        </h2>
        <div className="process-line">
          {[
            ['DISCOVER', '知る', '目的と、その先の可能性を。'],
            ['DESIGN', '描く', 'らしさを、目に見える形へ。'],
            ['CREATE', 'つくる', '素材から、世界観をつくる。'],
            ['ANIMATE', '動かす', '心地よい動きに、意味を。'],
            ['DEVELOP', '実装する', '美しさを、確かな体験へ。'],
            ['LAUNCH', '届ける', '公開の先も、育てていく。'],
          ].map(([t, j, d], i) => (
            <div className="process-step" key={t}>
              <span>0{i + 1}</span>
              <div className="process-dot" />
              <h3>{t}</h3>
              <p>{j}</p>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </section>
      <footer id="contact" className="final section">
        <Label n="13">YOUR NEXT EXPERIENCE</Label>
        <Scene kind="final" />
        <div className="floating-works" aria-hidden="true">
          {[0, 1, 2, 3, 7].map((j, i) => (
            <div key={i} className={`float-card float-${i}`}>
              <img
                src={`/images/${works[j].image}.jpg`}
                alt=""
                loading="lazy"
              />
              <span>{works[j].name}</span>
            </div>
          ))}
        </div>
        <div className="final-copy">
          <span>THE NEXT ONE COULD BE YOURS.</span>
          <h2>
            LET'S CREATE
            <br />
            SOMETHING
            <br />
            <i>UNEXPECTED.</i>
          </h2>
          <p>まだ見たことのないWEB体験を。</p>
          <button className="pill" onClick={() => setContact(true)}>
            Start a conversation <Arrow />
          </button>
        </div>
        <div className="footer-line">
          <a href="#top" className="brand">
            W/E
          </a>
          <span>
            © 2026 WEB EXPERIENCE LAB
            <br />
            CONCEPT PORTFOLIO / ALL BRANDS ARE FICTIONAL
          </span>
          <a href="#top">BACK TO TOP ↑</a>
        </div>
      </footer>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="work-modal">
          {w && (
            <>
              <div className="modal-image" style={{ background: w.color }}>
                <img src={`/images/${w.image}.jpg`} alt={w.name} />
                <span>{w.tag}</span>
              </div>
              <div className="modal-body">
                <p className="eyebrow">{w.category} / CONCEPT PROJECT</p>
                <DialogTitle className="modal-title">{w.name}</DialogTitle>
                <DialogDescription className="modal-description">
                  {w.description}
                </DialogDescription>
                <div className="modal-footer">
                  <span>架空ブランドのサンプル制作</span>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setContact(true);
                    }}
                  >
                    このようなサイトを相談する <Arrow />
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={contact} onOpenChange={setContact}>
        <DialogContent className="contact-modal">
          <span className="eyebrow">LET'S TALK</span>
          <DialogTitle className="modal-title">
            Your next
            <br />
            experience.
          </DialogTitle>
          <DialogDescription className="modal-description">
            このLPは制作サンプルです。実際の問い合わせ先はまだ設定されていません。ご相談内容のひな形をコピーしてお使いください。
          </DialogDescription>
          <button
            className="pill"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  'WEB制作のご相談\n業種：\n制作したいサイト：\n参考にしたい体験：\n希望時期：\nご予算：',
                );
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopied(false);
                setCopyError(true);
              }
            }}
          >
            {copied ? 'コピーしました ✓' : '相談メモをコピー'} <Arrow />
          </button>
          <p aria-live="polite">
            {copyError
              ? 'コピーできませんでした。次の項目を選択してコピーしてください。'
              : ''}
            業種 / 制作したいサイト / 参考にしたい体験 / 希望時期 / ご予算
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
