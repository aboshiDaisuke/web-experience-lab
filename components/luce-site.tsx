'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Box, Sun, Moon, Move } from 'lucide-react';
import type { PanoController } from '@/lib/luce/pano';

const floors = [
  { floor: 20, label: '20階', note: '遠くの超高層まで見渡す' },
  { floor: 12, label: '12階', note: '街並みの上に空がひらける' },
  { floor: 5, label: '5階', note: '街路樹と暮らしの近さ' },
];

// Interior dimensions in metres (plan of the model unit, north up)
const rooms = [
  { id: 'living', name: 'LD・K', size: '19.5帖', x: 4.0, y: 0, w: 7.2, h: 4.4 },
  { id: 'master', name: '洋室1', size: '8.4帖', x: 0, y: 0, w: 4.0, h: 3.4 },
  { id: 'room2', name: '洋室2', size: '5.8帖', x: 0, y: 3.4, w: 2.6, h: 3.6 },
  { id: 'room3', name: '洋室3', size: '5.8帖', x: 7.6, y: 4.4, w: 3.6, h: 2.6 },
  { id: 'hall', name: '玄関・廊下', size: '', x: 2.6, y: 3.4, w: 1.4, h: 3.6 },
  { id: 'wash', name: '洗面', size: '', x: 4.0, y: 5.8, w: 1.8, h: 1.2 },
  { id: 'bath', name: '浴室', size: '', x: 5.8, y: 5.0, w: 1.8, h: 2.0 },
  { id: 'wc', name: 'トイレ', size: '', x: 4.0, y: 4.4, w: 1.2, h: 1.4 },
];

const specs = [
  ['全窓 Low-E 複層ガラス', '夏の日射をおさえ、冬の暖かさを逃がしにくい窓。'],
  ['リビング床暖房', '足元からやわらかく暖める温水式。'],
  ['食器洗い乾燥機・ディスポーザー', 'キッチンの後片付けを軽くする標準設備。'],
  ['天井高 2,500mm', 'サッシは床から2,300mm。空を大きく切り取ります。'],
  ['二重床・二重天井', '将来の間取り変更や配管の点検がしやすい構造。'],
  ['24時間有人管理', 'コンシェルジュが宅配や来客の取り次ぎを行います。'],
];

const outline = [
  ['名称', 'MIRAI HILLS 目黒（架空の物件です）'],
  ['所在地', '東京都目黒区（想定）'],
  ['交通', 'JR山手線「目黒」駅 徒歩7分（想定）'],
  ['構造・規模', '鉄筋コンクリート造 地上22階建'],
  ['総戸数', '86戸'],
  ['モデルルーム', 'Cタイプ 3LDK 専有面積 78.40㎡ / バルコニー面積 33.90㎡'],
  ['販売価格', '未定（予告広告のサンプル）'],
];

export default function LuceSite({
  onInquiry,
  onTour,
}: {
  onInquiry: () => void;
  onTour: (room?: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<PanoController | null>(null);
  const [floor, setFloor] = useState(12);
  const [night, setNight] = useState(false);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(12);
  useEffect(() => {
    let dead = false;
    void import('@/lib/luce/pano').then(({ mountPano }) => {
      if (dead || !host.current) return;
      ctl.current = mountPano(host.current, { floor: 12, night: false }, () => setReady(true));
    });
    return () => {
      dead = true;
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, []);
  useEffect(() => {
    ctl.current?.set({ floor, night });
  }, [floor, night]);
  // elevator-style floor counter
  useEffect(() => {
    if (shown === floor) return;
    const t = setTimeout(() => setShown((s) => s + Math.sign(floor - s)), 1100 / Math.max(1, Math.abs(floor - shown) + 4));
    return () => clearTimeout(t);
  }, [floor, shown]);

  return (
    <>
      <section id="top" className={`luce-cover ${night ? 'is-night' : ''}`}>
        <div className="luce-pano" ref={host} aria-label="モデルルームのバルコニーから見た360度の眺望。ドラッグで見回せます。" role="img" />
        <div className={`luce-veil ${ready ? 'is-ready' : ''}`} />
        <div className="luce-copy">
          <p className="luce-lead">目黒駅 徒歩7分　地上22階建　全86邸</p>
          <h1>
            光の高さで、
            <br />
            暮らしを選ぶ。
          </h1>
          <p>
            どの階から、どんな空を見て暮らすか。モデルルームのバルコニーから、階数ごとの眺めを確かめられます。
          </p>
          <div className="luce-actions">
            <button className="luce-primary" onClick={() => onTour()}>
              モデルルームを3Dで内覧する <Box size={17} />
            </button>
            <button className="luce-secondary" onClick={onInquiry}>
              資料を請求する
            </button>
          </div>
        </div>
        <div className="luce-elevator" role="group" aria-label="眺望を見る階数">
          <div className="luce-floor-now" aria-live="polite">
            <b>{shown}</b>
            <span>階からの眺め</span>
          </div>
          {floors.map((f) => (
            <button key={f.floor} aria-pressed={floor === f.floor} onClick={() => setFloor(f.floor)}>
              <b>{f.label}</b>
              <span>{f.note}</span>
            </button>
          ))}
          <button className="luce-time" aria-pressed={night} onClick={() => setNight(!night)}>
            {night ? <Moon size={15} /> : <Sun size={15} />}
            {night ? '夜景' : '昼'}
          </button>
        </div>
        <p className="luce-drag">
          <Move size={14} /> ドラッグで見回せます
        </p>
      </section>

      <section id="story" className="site-section luce-story">
        <div>
          <h2>
            窓の外まで、
            <br />
            住まいの一部に。
          </h2>
          <p>
            南と東に開いた角住戸。床から2.3mのサッシが、目黒の街並みと空を一枚の景色として切り取ります。バルコニーは奥行き2m、L字に回り込む33.9㎡。
          </p>
        </div>
        <figure>
          <img src="/images/luce/ldk.jpg" alt="南と東の大開口に面したモデルルームのリビング" />
          <figcaption>Cタイプ モデルルーム LD・K（CG）</figcaption>
        </figure>
      </section>

      <section id="details" className="site-section luce-plan">
        <div className="luce-plan-head">
          <h2>Cタイプ 3LDK</h2>
          <p>専有面積 78.40㎡　バルコニー面積 33.90㎡</p>
          <p className="luce-plan-hint">部屋を選ぶと、その場所から3Dで内覧できます。</p>
        </div>
        <div className="luce-plan-body">
          <svg viewBox="-0.6 -0.8 14.4 10.6" className="luce-planmap" role="group" aria-label="Cタイプの間取り図">
            <rect x="-0.1" y="7" width="13.3" height="2.0" className="plan-balcony" />
            <rect x="11.2" y="2.6" width="2.0" height="4.4" className="plan-balcony" />
            <text x="6.5" y="8.15" className="plan-note">バルコニー</text>
            {rooms.map((r) => (
              <g
                key={r.id}
                className="plan-room"
                role="button"
                tabIndex={0}
                aria-label={`${r.name}${r.size ? ` ${r.size}` : ''}を3Dで見る`}
                onClick={() => onTour(r.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTour(r.id)}
              >
                <rect x={r.x} y={7 - r.y - r.h} width={r.w} height={r.h} />
                <text x={r.x + r.w / 2} y={7 - r.y - r.h / 2 - (r.size ? 0.12 : -0.12)}>{r.name}</text>
                {r.size && (
                  <text x={r.x + r.w / 2} y={7 - r.y - r.h / 2 + 0.42} className="plan-size">{r.size}</text>
                )}
              </g>
            ))}
            <text x="12.9" y="0.2" className="plan-north">N ↑</text>
          </svg>
          <figure className="luce-plan-photo">
            <img src="/images/luce/master.jpg" alt="洋室1（主寝室）" />
            <figcaption>洋室1 8.4帖（CG）</figcaption>
          </figure>
        </div>
      </section>

      <section className="luce-tourband">
        <img src="/images/luce/night.jpg" alt="夜景を望むリビング" />
        <div>
          <h2>
            いつでも、
            <wbr />
            モデルルームへ。
          </h2>
          <p>家具の配置も、窓からの光も、夜の灯りも。歩いて見て回れる3Dモデルルームを公開しています。</p>
          <button className="luce-primary" onClick={() => onTour()}>
            3Dで内覧する <ArrowUpRight size={17} />
          </button>
        </div>
      </section>

      <section className="site-section luce-specs">
        <h2>設備・仕様</h2>
        <ul>
          {specs.map(([t, d]) => (
            <li key={t}>
              <b>{t}</b>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="access" className="site-section luce-access">
        <div>
          <h2>目黒川まで、歩いて3分。</h2>
          <p>駅前のにぎわいと、川沿いの並木道。毎日の買い物も、休日の散歩も、歩いて届く距離にあります。</p>
          <dl>
            <div><dt>目黒駅</dt><dd>徒歩7分</dd></div>
            <div><dt>目黒川の桜並木</dt><dd>徒歩3分</dd></div>
            <div><dt>スーパーマーケット</dt><dd>徒歩2分</dd></div>
            <div><dt>区立小学校</dt><dd>徒歩6分</dd></div>
          </dl>
        </div>
        <svg viewBox="0 0 400 300" className="luce-map" aria-hidden="true">
          <path d="M-10 250 C 90 210, 150 230, 220 170 S 330 90, 420 60" className="map-river" />
          <path d="M0 120 H400 M130 0 V300 M0 40 L400 210 M290 0 L250 300" className="map-road" />
          <circle cx="130" cy="120" r="7" className="map-station" />
          <text x="142" y="112">目黒駅</text>
          <circle cx="232" cy="176" r="9" className="map-site" />
          <text x="246" y="170" className="map-site-label">MIRAI HILLS</text>
          <text x="40" y="232" className="map-river-label">目黒川</text>
        </svg>
      </section>

      <section className="site-section luce-outline">
        <h2>物件概要</h2>
        <dl>
          {outline.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="fine-print">掲載の物件・画像・価格はすべて架空の制作サンプルです。CGは Blender で制作しています。</p>
      </section>
    </>
  );
}
