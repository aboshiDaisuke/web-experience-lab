'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Plus,
  Minus,
  MapPin,
  Clock,
  Leaf,
  MoveUpRight,
  Volume2,
} from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import Scene from './scene';
import { openTour } from '@/lib/tour/bus';
const Photo = ({ name, alt }: { name: string; alt: string }) => (
  <img src={`/images/${name}.jpg`} alt={alt} loading="lazy" />
);
function Questions({ items }: { items: string[][] }) {
  return (
    <Accordion className="brand-faq">
      {items.map(([q, a], i) => (
        <AccordionItem key={q} value={String(i)}>
          <AccordionTrigger>
            <span>Q{String(i + 1).padStart(2, '0')}</span>
            {q}
          </AccordionTrigger>
          <AccordionContent>
            <p>{a}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
export default function BrandDepth({
  slug,
  onInquiry,
}: {
  slug: string;
  onInquiry: () => void;
}) {
  const [choice, setChoice] = useState(0);
  const [detail, setDetail] = useState(0);
  const [size, setSize] = useState(32);
  const [checks, setChecks] = useState<string[]>([]);
  const [part, setPart] = useState('shell');
  const [separation, setSeparation] = useState(70);
  if (slug === 'nova')
    return (
      <div id="features" className="brand-depth">
        <section className="nova-technology">
          <div className="depth-photo">
            <Photo name="machine" alt="精密な産業用機械のディテール" />
            <span className="image-index">
              INSIDE MIRAI NOVA / PRECISION ENGINEERING
            </span>
          </div>
          <div className="technology-copy">
            <span className="section-kicker">TECHNOLOGY & QUALITY</span>
            <h2>
              見えない精度が、
              <br />
              見える価値をつくる。
            </h2>
            <p>
              図面上の数字を、現場で使える品質へ。素材を見極め、加工条件を検証し、測定を繰り返す。完成品を支えるのは、地道な工程の積み重ねです。
            </p>
            <div className="technical-steps">
              {[
                ['01', '設計検証', '要求仕様を整理し、試作前に課題を可視化。'],
                ['02', '加工・組立', '材料と用途に合わせて、工程を最適化。'],
                ['03', '測定・評価', '寸法だけでなく、実際の使用条件で検証。'],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <span>{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="site-section case-studies">
          <div className="section-title">
            <div>
              <span className="section-kicker">APPLICATION STORIES</span>
              <h2>技術が活きる、その現場へ。</h2>
            </div>
            <span>コンセプト事例</span>
          </div>
          <div className="case-layout">
            <div className="case-select">
              {[
                '精密機器の小型化',
                '生産ラインの省力化',
                '新素材の試作開発',
              ].map((t, i) => (
                <button
                  key={t}
                  onClick={() => setChoice(i)}
                  aria-pressed={choice === i}
                >
                  <span>CASE 0{i + 1}</span>
                  <b>{t}</b>
                  <ArrowUpRight size={22} />
                </button>
              ))}
            </div>
            <article className="case-article">
              <Photo
                name={
                  choice === 1
                    ? 'engineer'
                    : choice === 2
                      ? 'machine'
                      : 'architecture'
                }
                alt="事業の課題に取り組むイメージ"
              />
              <div>
                <span>{['PRECISION', 'AUTOMATION', 'MATERIALS'][choice]}</span>
                <h3>
                  {
                    [
                      '限られたスペースに、必要な機能を。',
                      '人の判断が活きる、製造現場へ。',
                      '素材の可能性を、製品の可能性に。',
                    ][choice]
                  }
                </h3>
                <dl>
                  <div>
                    <dt>課題</dt>
                    <dd>
                      {
                        [
                          '軽量化と強度の両立。複雑な構造を、組み立てやすく。',
                          '繰り返し作業の負担を減らし、品質の安定につなげる。',
                          '新しい材料の特性と、加工上の制約を把握する。',
                        ][choice]
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>アプローチ</dt>
                    <dd>
                      {
                        [
                          '部品点数と材料を見直し、試作と評価を短いサイクルで実施。',
                          '工程を観察し、人と設備の役割を再設計。',
                          '小さな試作から検証を重ね、量産を見据えた工程を設計。',
                        ][choice]
                      }
                    </dd>
                  </div>
                </dl>
                <button className="line-button" onClick={onInquiry}>
                  似た課題を相談する <ArrowRight size={17} />
                </button>
              </div>
            </article>
          </div>
        </section>
        <section className="nova-people">
          <Photo name="engineer" alt="ものづくりの現場で働く人" />
          <div>
            <span className="section-kicker">PEOPLE & CULTURE</span>
            <h2>
              技術を進めるのは、
              <br />
              いつも、人だ。
            </h2>
            <p>
              専門の違う仲間が、同じ課題に向き合う。
              <br />
              互いの「なぜ」を大切にする文化が、
              <br />
              まだない答えを生み出します。
            </p>
            <button className="outline-button" onClick={onInquiry}>
              私たちと働く <ArrowUpRight size={17} />
            </button>
          </div>
        </section>
      </div>
    );
  if (slug === 'lumina')
    return (
      <div id="features" className="brand-depth">
        <section className="salon-space">
          <div>
            <span className="section-kicker">A LITTLE TIME, JUST FOR YOU.</span>
            <h2>
              髪を整える。
              <br />
              心まで、ほどける。
            </h2>
            <p>
              光の入る席、やさしい香り、静かな時間。
              <br />
              慌ただしい毎日から少しだけ離れて、
              <br />
              自分のために過ごす場所。
            </p>
            <span className="salon-location">
              OMOTESANDO / PRIVATE HAIR SALON
            </span>
          </div>
          <Photo name="salon" alt="ゆったりと過ごせるヘアサロンの空間" />
        </section>
        <section className="site-section hair-consultation">
          <div className="section-title">
            <div>
              <span className="section-kicker">FIND YOUR STYLE</span>
              <h2>今の気分を、聞かせてください。</h2>
            </div>
            <span>STYLE COUNSELING</span>
          </div>
          <div className="consult-options">
            {['自然体でいたい', 'やわらかく見せたい', '印象を変えたい'].map(
              (t, i) => (
                <button
                  key={t}
                  onClick={() => setChoice(i)}
                  aria-pressed={choice === i}
                >
                  <span>0{i + 1}</span>
                  {t}
                  {choice === i ? <Check size={19} /> : <Plus size={19} />}
                </button>
              ),
            )}
          </div>
          <div className="consult-result" aria-live="polite">
            <span>OUR SUGGESTION</span>
            <h3>
              {
                [
                  '扱いやすさを大切にした、ナチュラルカット。',
                  '顔まわりの動きと、透明感のあるカラー。',
                  '新しいシルエットから、次の自分へ。',
                ][choice]
              }
            </h3>
            <p>
              {
                [
                  '髪質と生えぐせを活かし、毎朝の手間を少なく。カットとホームケアの提案を組み合わせます。',
                  '肌の色やいつもの服に合わせて、色味と質感を調整。軽やかでやさしい印象に仕上げます。',
                  '長さだけでなく、前髪、顔まわり、重心を見直して。小さな変化から大胆なチェンジまで、一緒に考えます。',
                ][choice]
              }
            </p>
            <button className="line-button" onClick={onInquiry}>
              この気分で相談する <ArrowRight size={18} />
            </button>
          </div>
        </section>
        <section className="stylist-editorial">
          <div className="stylist-photo">
            <Photo name="stylist" alt="髪を丁寧に仕上げるスタイリスト" />
          </div>
          <div>
            <span className="section-kicker">THE HANDS BEHIND YOUR STYLE</span>
            <h2>
              似合わせは、
              <br />
              対話からはじまる。
            </h2>
            <p>
              どんな日々を過ごしているか。どんな自分になりたいか。言葉にならない気分も、少しずつ形にしていきます。
            </p>
            <blockquote>
              「鏡を見るのが、少し楽しみになる。
              <br />
              そんなスタイルを届けたい。」
            </blockquote>
            <span className="stylist-signature">LUMINA MIRAI / STYLING TEAM</span>
          </div>
        </section>
        <section className="site-section">
          <span className="section-kicker">BEFORE YOUR VISIT</span>
          <h2>はじめての方へ</h2>
          <Questions
            items={[
              [
                'スタイルが決まっていなくても予約できますか？',
                'もちろんです。カウンセリングで髪質や普段のケア、なりたい雰囲気を一緒に整理していきます。',
              ],
              [
                '施術にはどのくらい時間がかかりますか？',
                'カットは約60分、カットとカラーは約120分を想定しています。髪の状態や施術内容によって前後します。',
              ],
              [
                '子どもと一緒に来店できますか？',
                'ご希望の時間帯や同伴人数を予約時にお知らせください。これは架空サロンの操作サンプルです。',
              ],
            ]}
          />
        </section>
      </div>
    );
  if (slug === 'noir')
    return (
      <div id="features" className="brand-depth">
        <section className="chef-editorial">
          <Photo name="chef" alt="一皿を丁寧に仕上げるシェフの手元" />
          <div>
            <span className="section-kicker">FROM THE KITCHEN</span>
            <h2>
              足すよりも、
              <br />
              見つめること。
            </h2>
            <p>
              素材が持つ香り、甘み、食感。
              <br />
              余分なものを削ぎ落とし、
              <br />
              その日のいちばん美しい姿を、一皿へ。
            </p>
            <span className="chef-signature">
              TABLE 未来 — CHEF'S PHILOSOPHY
            </span>
          </div>
        </section>
        <section className="site-section pairing-section">
          <div>
            <span className="section-kicker">THE ART OF PAIRING</span>
            <h2>
              もうひとつの、
              <br />
              味わいの物語。
            </h2>
            <p>
              料理に寄り添い、ときに新しい表情を引き出す。
              <br />
              お好みに合わせて、二つのペアリングをご用意しています。
            </p>
            <div className="small-tabs">
              {['ワインペアリング', 'ノンアルコール'].map((t, i) => (
                <button
                  key={t}
                  onClick={() => setChoice(i)}
                  aria-pressed={choice === i}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="pairing-cards">
            {(choice === 0
              ? [
                  [
                    '01',
                    'はじまりの一杯',
                    '軽やかなスパークリングと、季節のアミューズ。',
                  ],
                  [
                    '02',
                    '香りを重ねる',
                    'ミネラル感のある白ワインを、魚料理と。',
                  ],
                  [
                    '03',
                    '余韻を深める',
                    '穏やかなタンニンの赤ワインを、メインの一皿に。',
                  ],
                ]
              : [
                  [
                    '01',
                    '香りで目覚める',
                    '柑橘とハーブのスパークリングティー。',
                  ],
                  ['02', '旨みをつなぐ', '低温で抽出したお茶と、季節の果実。'],
                  [
                    '03',
                    '静かな余韻',
                    '焙煎香のある茶葉に、ほのかなスパイス。',
                  ],
                ]
            ).map(([n, t, d]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="restaurant-space">
          <Photo name="restaurant" alt="落ち着いたレストランのダイニング" />
          <div>
            <span className="section-kicker">YOUR EVENING, AT TABLE 未来.</span>
            <h2>
              食事を、
              <br />
              ひとつの時間として。
            </h2>
            <button className="outline-button" onClick={onInquiry}>
              大切な日のご予約 <ArrowUpRight size={18} />
            </button>
          </div>
        </section>
        <section className="site-section restaurant-faq">
          <span className="section-kicker">RESERVATION NOTES</span>
          <h2>ご来店の前に</h2>
          <Questions
            items={[
              [
                'アレルギーや苦手な食材について',
                'ご予約時に詳しくお知らせください。コースの内容を確認し、対応可能か事前にご案内する想定です。',
              ],
              [
                '記念日の利用について',
                'ご希望のメッセージやお祝いの内容を予約フォームにご記入ください。',
              ],
              [
                '予約・キャンセルについて',
                '本サイトは制作サンプルのため、予約は確定せず料金も発生しません。実店舗での運用時は予約規定を設定します。',
              ],
            ]}
          />
        </section>
      </div>
    );
  if (slug === 'eclat')
    return (
      <div id="features" className="brand-depth">
        <section className="site-section craft-inspector">
          <div>
            <span className="section-kicker">A CLOSER LOOK</span>
            <h2>
              細部にこそ、
              <br />
              ものづくりは宿る。
            </h2>
            <div className="detail-index">
              {['しなやかなレザー', '輪郭を整える縫製', '日常に馴染む金具'].map(
                (t, i) => (
                  <button
                    key={t}
                    onClick={() => setDetail(i)}
                    aria-pressed={detail === i}
                  >
                    <span>0{i + 1}</span>
                    {t}
                    <ArrowUpRight size={18} />
                  </button>
                ),
              )}
            </div>
            <p>
              {
                [
                  '天然素材が持つ、ひとつずつ異なる表情。使い込むほどに柔らかく、色に深みが生まれます。',
                  '強さと美しさを兼ね備えたステッチ。目に触れにくい部分まで、丁寧に仕立てます。',
                  '控えめな光沢と、使いやすい形。引き手ひとつにも、日々の使い心地を考えています。',
                ][detail]
              }
            </p>
          </div>
          <div className={`leather-macro macro-${detail}`}>
            <Photo name="bag" alt="レザーバッグの素材と仕立てを拡大" />
            <span>DETAIL STUDY / 0{detail + 1}</span>
          </div>
        </section>
        <section className="site-section leather-care">
          <span className="section-kicker">CARE & LONGEVITY</span>
          <h2>長く愛せるものと、暮らす。</h2>
          <Questions
            items={[
              [
                '日々のお手入れ',
                '乾いた柔らかい布で、表面のほこりをやさしく落としてください。製品ごとに適切なケア用品は異なるため、使用前に素材を確認してください。',
              ],
              [
                '雨の日に濡れてしまったら',
                '水分を押さえるように拭き取り、風通しのよい日陰で自然乾燥させます。直射日光や熱風は避けてください。',
              ],
              [
                'しまっておくときは',
                '中に柔らかな紙を入れて形を整え、通気性のよい袋で保管します。湿気の多い場所を避けてください。',
              ],
            ]}
          />
          <button className="line-button" onClick={onInquiry}>
            製品について相談する <ArrowRight size={18} />
          </button>
        </section>
      </div>
    );
  if (slug === 'aether')
    return (
      <div id="features" className="brand-depth">
        <section className="speaker-inspector">
          <div className="inspector-title">
            <span className="section-kicker">INSIDE THE SOUND</span>
            <h2>
              パーツから知る、
              <br />
              音の設計。
            </h2>
            <p>部品を選ぶと、役割がわかります。</p>
          </div>
          <div className="inspector-scene">
            <Scene
              kind="product"
              progress={separation / 100}
              onPick={setPart}
              highlight={part}
            />
          </div>
          <div className="inspector-info">
            <div className="part-list">
              {[
                ['shell', 'アルミニウム外装'],
                ['core', 'アコースティックコア'],
                ['coil', 'ボイスコイル'],
                ['top', 'タッチコントロール'],
                ['base', '防振ベース'],
              ].map(([id, t]) => (
                <button
                  key={id}
                  aria-pressed={part === id}
                  onClick={() => setPart(id)}
                >
                  <i />
                  {t}
                  <Plus size={13} />
                </button>
              ))}
            </div>
            <div className="part-description" aria-live="polite">
              <span>PART DETAIL</span>
              <p>
                {{
                  shell:
                    '本体を保護する外装。縦に走る精密なリブが、質感と剛性を生み出します。',
                  core: 'スピーカーユニットを収める内部の構造。振動の伝わり方まで考えた中心部です。',
                  coil: '電気信号を振動に変えるためのコイルを表現した、銅色の内部パーツです。',
                  top: '音量や再生を手元で操作する上面パネル。リング状の光で状態を知らせます。',
                  base: '設置面へ伝わる振動を抑える、重心の低いベース構造。',
                }[part] || '部品の一覧から、気になるパーツを選んでください。'}
              </p>
            </div>
            <label className="inspection-slider">
              分解する{' '}
              <Slider
                aria-label="構造を分解する"
                min={0}
                max={100}
                value={[separation]}
                onValueChange={(v) =>
                  setSeparation(Array.isArray(v) ? v[0] : v)
                }
              />
              <output>{separation}%</output>
            </label>
          </div>
        </section>
        <section className="site-section product-specification">
          <span className="section-kicker">SPECIFICATION / CONCEPT</span>
          <h2>空間に置く、という視点。</h2>
          <div className="speaker-measures">
            <div>
              <b>Ø 82</b>
              <span>直径 / mm</span>
            </div>
            <div>
              <b>220</b>
              <span>高さ / mm</span>
            </div>
            <div>
              <b>360°</b>
              <span>音の広がり</span>
            </div>
          </div>
          <p className="fine-print">
            数値はデザインコンセプトのための想定値です。製品性能を保証するものではありません。
          </p>
        </section>
      </div>
    );
  if (slug === 'casa')
    return (
      <div id="features" className="brand-depth">
        <section className="site-section house-plan">
          <div>
            <span className="section-kicker">LIFE, IN PLAN</span>
            <h2>
              つながる場所。
              <br />
              ひとりになる場所。
            </h2>
            <p>間取りの部屋を選んで、暮らしのシーンをご覧ください。</p>
            <div
              className="floorplan"
              role="group"
              aria-label="間取りから部屋を選ぶ"
            >
              <span className="plan-north">N ↑</span>
              <button
                className="plan-living"
                aria-pressed={choice === 0}
                onClick={() => setChoice(0)}
              >
                LIVING / DINING<span>くつろぐ・食べる</span>
              </button>
              <button
                className="plan-bed"
                aria-pressed={choice === 1}
                onClick={() => setChoice(1)}
              >
                BEDROOM<span>ひとりに還る</span>
              </button>
              <button
                className="plan-terrace"
                aria-pressed={choice === 2}
                onClick={() => setChoice(2)}
              >
                TERRACE<span>外へひらく</span>
              </button>
            </div>
            <span className="fine-print">
              空間のつながりを示すコンセプト図。実施設計図ではありません。
            </span>
          </div>
          <div className="plan-editorial">
            <Photo
              name={['house', 'hotel', 'outdoors'][choice]}
              alt={
                [
                  '外へひらくリビングのイメージ',
                  '休息のための静かな空間',
                  '自然とつながる眺め',
                ][choice]
              }
            />
            <span>SPACE 0{choice + 1}</span>
            <h3>
              {
                [
                  '内と外の境界を、やわらかく。',
                  '静けさが、眠りを迎える。',
                  '風を感じる、もうひとつの居場所。',
                ][choice]
              }
            </h3>
            <p>
              {
                [
                  '食卓からテラスへ。大きな開口が、家族の時間と自然をつなぎます。',
                  '光をやわらげ、音を遠ざける。私的な時間を守る、コンパクトな寝室。',
                  '朝の一杯も、夕暮れのひと息も。季節の移ろいを身近に感じる場所です。',
                ][choice]
              }
            </p>
            <button
              type="button"
              className="plan-tour-button"
              aria-haspopup="dialog"
              onClick={() =>
                openTour({
                  property: 'casa',
                  mode: 'walk',
                  room: ['living', 'master', 'terrace'][choice],
                })
              }
            >
              この部屋を3Dで見る
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
        <section className="site-section material-palette">
          <span className="section-kicker">MATERIAL & LIGHT</span>
          <h2>素材の個性を、そのままに。</h2>
          <div>
            {[
              ['01', 'CONCRETE', '陰影を映す、静かな量感。'],
              ['02', 'WOOD', '触れたくなる、自然な温かさ。'],
              ['03', 'GLASS', '景色を取り込む、透明な境界。'],
            ].map(([n, t, d]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  if (slug === 'room')
    return (
      <div id="features" className="brand-depth">
        <section className="site-section studio-notebook">
          <span className="section-kicker">FROM THE NOTEBOOK</span>
          <h2>
            考えて、試して、
            <br />
            また、つくる。
          </h2>
          <div className="notebook-spread">
            <Photo name="studio" alt="制作のアイデアが生まれるスタジオ" />
            <div>
              {[
                ['01', '観察する', '当たり前を、少し違う角度から見る。'],
                ['02', '手を動かす', 'まだ曖昧な考えを、小さく形にしてみる。'],
                ['03', '磨いていく', '使う人の視点に立ち、余分なものを削る。'],
              ].map(([n, t, d]) => (
                <article key={n}>
                  <span>{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="site-section studio-selected">
          <span className="section-kicker">SELECTED EXPERIMENTS</span>
          <h2>部屋から生まれた、3つの実験。</h2>
          <div>
            {[
              ['aether', 'MIRAI ONE', '音を、見えるものに。', 'architecture'],
              ['yui', 'VISUAL DIARY', '日々を、記憶に残す。', 'hotel'],
              ['adapt', 'MIRAI / YOU', '好みを、かたちにする。', 'fashion'],
            ].map(([slug, t, d, img]) => (
              <a href={`/works/${slug}`} key={slug}>
                <Photo name={img} alt={d} />
                <span>
                  {t}
                  <ArrowUpRight size={17} />
                </span>
                <p>{d}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    );
  if (slug === 'yui')
    return (
      <div id="features" className="brand-depth">
        <section className="site-section photographer-journal">
          <span className="section-kicker">FIELD NOTES / 01</span>
          <h2>
            撮る前に、
            <br />
            そこにいること。
          </h2>
          <div className="journal-spread">
            <Photo name="outdoors" alt="旅先で見つけた山々の風景" />
            <div>
              <span className="journal-date">SEPTEMBER, 2026</span>
              <h3>風景に、速度を合わせる。</h3>
              <p>
                急いでいると、見えなくなるものがある。光の差す方向、遠くの雲、誰かが立ち止まった場所。
              </p>
              <p>
                シャッターを切る前に、その場所の時間を少しだけ過ごす。写真に残したいのは、景色だけではないから。
              </p>
              <span className="journal-signature">Mirai Takahashi</span>
            </div>
          </div>
        </section>
        <section className="site-section photography-services">
          <span className="section-kicker">COMMISSION</span>
          <h2>撮影のご依頼について</h2>
          {[
            ['建築・空間', 'ホテル、店舗、住宅。空間の空気と、使われる姿を。'],
            ['ポートレート', 'その人らしい表情と、自然な距離感を大切に。'],
            [
              'ブランド・エディトリアル',
              '企画段階から、世界観を共有して制作します。',
            ],
          ].map(([t, d]) => (
            <div key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
              <button aria-label={`${t}を相談する`} onClick={onInquiry}>
                <ArrowUpRight size={21} />
              </button>
            </div>
          ))}
        </section>
      </div>
    );
  if (slug === 'adapt')
    return (
      <div id="features" className="brand-depth">
        <section className="site-section typography-lab">
          <span className="section-kicker">
            SMALL CHANGES, DIFFERENT IMPRESSIONS
          </span>
          <h2>
            文字の表情まで、
            <br />
            自分で選んでみる。
          </h2>
          <div className="type-lab-controls">
            <div className="small-tabs">
              {['端正なゴシック', '繊細な明朝', '力強い太字'].map((t, i) => (
                <button
                  key={t}
                  onClick={() => setChoice(i)}
                  aria-pressed={choice === i}
                >
                  {t}
                </button>
              ))}
            </div>
            <label>
              文字サイズ{' '}
              <Slider
                aria-label="文字のサイズ"
                min={24}
                max={54}
                value={[size]}
                onValueChange={(v) => setSize(Array.isArray(v) ? v[0] : v)}
              />
              <output>{size}px</output>
            </label>
          </div>
          <div className={`type-specimen type-${choice}`}>
            <span>YOUR BRAND, YOUR VOICE.</span>
            <h3 style={{ fontSize: size }}>
              伝えたいことが、
              <br />
              伝わるデザイン。
            </h3>
            <p>印象は、一文字から変わります。</p>
            <button className="solid-button" onClick={onInquiry}>
              この方向で相談する <ArrowUpRight size={17} />
            </button>
          </div>
        </section>
      </div>
    );
  if (slug !== 'offgrid') return null;
  return (
    <div id="features" className="brand-depth">
      <section className="site-section festival-guide">
        <div>
          <span className="section-kicker">GET READY FOR THE WEEKEND</span>
          <h2>
            身軽に、
            <br />
            でも、準備は忘れずに。
          </h2>
          <p>
            持ち物をチェックして、週末の準備を。
            <br />
            チェック内容はこの画面内だけに保持されます。
          </p>
          <div className="packing-progress">
            <span style={{ width: `${(checks.length / 6) * 100}%` }} />
          </div>
          <span className="packing-count">{checks.length} / 6 READY</span>
        </div>
        <div className="packing-list">
          {[
            '歩きやすい靴',
            '雨具・レインウェア',
            'マイボトル',
            '羽織れる上着',
            '帽子・日焼け対策',
            'モバイルバッテリー',
          ].map((t) => (
            <button
              key={t}
              aria-pressed={checks.includes(t)}
              onClick={() =>
                setChecks(
                  checks.includes(t)
                    ? checks.filter((x) => x !== t)
                    : [...checks, t],
                )
              }
            >
              <span>{checks.includes(t) && <Check size={15} />}</span>
              {t}
            </button>
          ))}
        </div>
      </section>
      <section className="festival-landscape">
        <Photo name="outdoors" alt="ゆっくりと楽しみたい山の景色" />
        <h2>
          急がなくていい。
          <br />
          ここでは、それがルール。
        </h2>
      </section>
      <section className="site-section">
        <span className="section-kicker">GOOD TO KNOW</span>
        <h2>週末のガイド</h2>
        <Questions
          items={[
            [
              'アウトドアが初めてでも参加できますか？',
              '森を歩くプログラムは、ゆっくりとしたペースを想定しています。歩きやすい靴と、体温調整のできる服装でお越しください。',
            ],
            [
              '雨の日はどうなりますか？',
              '小雨決行を想定したコンセプトです。実開催時には、荒天時の対応や中止判断を事前にご案内します。',
            ],
            [
              '会場までのアクセスについて',
              '自然公園内での開催を想定した架空イベントです。実際の会場・交通手段は設定されていません。',
            ],
            [
              'チケットを購入できますか？',
              'このサイトでは日程・人数・料金の確認を体験できます。実際の決済やチケット発行は行いません。',
            ],
          ]}
        />
      </section>
    </div>
  );
}
