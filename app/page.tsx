'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { projects } from '@/lib/portfolio';
import { services, plans, options, estimates, extraCosts, steps, faqs } from '@/lib/studio';
import Hero from '@/components/studio/hero';
import Works from '@/components/studio/works';
import WebMCP from '@/components/webmcp';
import Contact from '@/components/studio/contact';
import ToTop from '@/components/studio/to-top';
import Stacks from '@/components/studio/stacks';
import FeasibilityCheck from '@/components/studio/check';
import type { Answers } from '@/lib/feasibility';
import { BASE, HOME } from '@/lib/base-path';

const nav = [
  ['作品', '#works'],
  ['できること', '#services'],
  ['つくり方', '#stacks'],
  ['料金', '#plans'],
  ['制作の流れ', '#process'],
];
const byslug = (slug: string) => projects.find((p) => p.slug === slug)!;

export default function Home() {
  const [refSlug, setRefSlug] = useState('');
  const [stack, setStack] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && projects.some((p) => p.slug === ref)) setRefSlug(ref);
    const onScroll = () => setSolid(scrollY > innerHeight * 0.8);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  return (
    <main className="studio">
      <a className="st-skip" href="#works">
        作品一覧へ移動
      </a>
      <header className={`st-header ${solid ? 'is-solid' : ''}`}>
        <a href={HOME} className="st-logo" aria-label="Web Experience Lab トップへ">
          <b>W/E</b>
          <span>Web Experience Lab</span>
        </a>
        <nav aria-label="ページ内">
          {nav.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <a className="st-header-cta" href="#contact">
          制作を相談する
        </a>
      </header>

      <WebMCP />
      <Hero />
      <Works />

      <section id="services" className="st-services" aria-labelledby="services-title">
        <div className="st-section-head">
          <h2 id="services-title">できること</h2>
          <p>
            デザインだけ、実装だけ、ではなく。見た目を決めるところから、予約や問い合わせが届くところまで一貫してつくります。
          </p>
        </div>
        <ol className="st-service-list">
          {services.map((s) => {
            const ex = byslug(s.example);
            return (
              <li key={s.title}>
                <h3>
                  {s.title.split('|').map((t, i) => (
                    <span key={i}>
                      {i > 0 && <wbr />}
                      {t}
                    </span>
                  ))}
                </h3>
                <p>{s.body}</p>
                <a href={`${BASE}/works/${ex.slug}`} className="st-service-example">
                  <img src={`${BASE}/images/works/${ex.slug}-mobile.jpg`} alt="" loading="lazy" />
                  <span>
                    作品例
                    <b>{ex.name}</b>
                  </span>
                  <ArrowUpRight size={16} />
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <Stacks onPick={setStack} />
      <FeasibilityCheck answers={answers} setAnswers={setAnswers} stack={stack} setStack={setStack} />

      <section id="plans" className="st-plans" aria-labelledby="plans-title">
        <div className="st-section-head">
          <h2 id="plans-title">料金の目安</h2>
          <p>
            ページ数やデザインの複雑さ、<a href="#setup">サーバーやドメインをお持ちかどうか</a>によって変わるため、正式な金額はご相談のあとにお見積りします。いずれも税別の制作費です。本文・写真素材はご提供ください。
          </p>
        </div>
        <div className="st-plan-grid">
          {plans.map((plan) => {
            const ex = byslug(plan.example);
            return (
              <article key={plan.name} className="st-plan">
                <h3>{plan.name}</h3>
                <p className="st-plan-fit">{plan.fit}</p>
                <p className="st-plan-price">
                  <em>{plan.price}</em>
                  <span>{plan.period}</span>
                </p>
                <ul>
                  {plan.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <a href={`${BASE}/works/${ex.slug}`} className="st-plan-example">
                  <img src={`${BASE}/images/works/${ex.slug}-desktop.jpg`} alt="" loading="lazy" />
                  <span>
                    近い作品 <b>{ex.name}</b>
                  </span>
                </a>
                <a
                  className="st-btn st-btn-outline"
                  href="#contact"
                  onClick={() => setRefSlug(ex.slug)}
                >
                  このプランで相談する
                </a>
              </article>
            );
          })}
        </div>
        <div className="st-plan-more">
          <div>
            <h3>オプション（税別）</h3>
            <dl className="st-options">
              {options.map((o) => (
                <div key={o.name}>
                  <dt>
                    {o.name}
                    {o.note && <small>{o.note}</small>}
                  </dt>
                  <dd>
                    {o.price}
                    <span> / {o.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="st-plan-note">※「〜」の金額は、ページ数・デザインの複雑さ・ご要件に応じて変わります。</p>
          </div>
          <div>
            <h3>お見積りの例</h3>
            <ul className="st-estimates">
              {estimates.map((e) => (
                <li key={e.title}>
                  <b>{e.title}</b>
                  <span>{e.lines.join(' ＋ ')}</span>
                  <em>
                    合計 {e.total}
                    <small>{e.after}</small>
                  </em>
                </li>
              ))}
            </ul>
            <h3>別途費用がかかるもの</h3>
            <ul className="st-extra-costs">
              {extraCosts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="process" className="st-process" aria-labelledby="process-title">
        <div className="st-section-head">
          <h2 id="process-title">制作の流れ</h2>
          <p>ご相談から納品まで、約1か月〜が目安です。ページ数や内容によって変わります。</p>
        </div>
        <ol className="st-steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="st-step-no">{i + 1}</span>
              <h3>{s.title}</h3>
              <span className="st-step-period">{s.period}</span>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="st-faq">
          <h3>よくあるご質問</h3>
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <Plus size={18} aria-hidden />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Contact
        refSlug={refSlug}
        setRefSlug={setRefSlug}
        stack={stack}
        setStack={setStack}
        answers={answers}
      />

      <footer className="st-footer">
        <a href={HOME} className="st-logo">
          <b>W/E</b>
          <span>Web Experience Lab</span>
        </a>
        <nav aria-label="フッター">
          {nav.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
          <a href="#contact">相談する</a>
        </nav>
        <p>掲載作品のブランド・人物・価格はすべて架空の制作サンプルです。© 2026 Web Experience Lab</p>
      </footer>
      <ToTop />
    </main>
  );
}
