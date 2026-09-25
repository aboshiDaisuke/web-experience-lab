'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { projects } from '@/lib/portfolio';
import { services, plans, steps, faqs } from '@/lib/studio';
import Hero from '@/components/studio/hero';
import Works from '@/components/studio/works';
import WebMCP from '@/components/webmcp';
import Contact from '@/components/studio/contact';
import ToTop from '@/components/studio/to-top';
import StudioHeader, { StudioFooter } from '@/components/studio/header';
import Showcase from '@/components/studio/showcase';
import { BASE } from '@/lib/base-path';
const byslug = (slug: string) => projects.find((p) => p.slug === slug)!;

export default function Home() {
  const [refSlug, setRefSlug] = useState('');
  const [stack, setStack] = useState('');
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && projects.some((p) => p.slug === ref)) setRefSlug(ref);
  }, []);
  return (
    <main className="studio">
      <a className="st-skip" href="#works">
        作品一覧へ移動
      </a>
      <StudioHeader page="home" />

      <WebMCP />
      <Hero />
      <Showcase />
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

      <section id="plans" className="st-plans" aria-labelledby="plans-title">
        <div className="st-section-head">
          <h2 id="plans-title">料金の目安</h2>
          <p>
            ページ数やデザインの複雑さによって変わるため、正式な金額はご相談のあとにお見積りします。いずれも税別の制作費です。
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
        <a className="st-guide-link" href={`${BASE}/guide`}>
          <span>
            <b>依頼ガイド</b>
            オプション料金・お見積りの例・つくり方（WordPress、Shopifyなど）の比較・制作できるかの事前チェック
          </span>
          <ArrowUpRight size={22} aria-hidden />
        </a>
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
        answers={{}}
      />

      <StudioFooter page="home" />
      <ToTop />
    </main>
  );
}
