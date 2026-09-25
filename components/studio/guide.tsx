'use client';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { estimates, extraCosts, options } from '@/lib/studio';
import type { Answers } from '@/lib/feasibility';
import StudioHeader, { StudioFooter } from '@/components/studio/header';
import Stacks from '@/components/studio/stacks';
import FeasibilityCheck from '@/components/studio/check';
import Contact from '@/components/studio/contact';
import ToTop from '@/components/studio/to-top';
import { HOME } from '@/lib/base-path';

const toc = [
  ['つくり方をくらべる', '#stacks'],
  ['準備状況と費用', '#setup'],
  ['制作できるか確かめる', '#check'],
  ['オプションとお見積りの例', '#costs'],
];

// Everything a client weighs before asking: kept off the top page so the works lead there.
export default function Guide() {
  const [refSlug, setRefSlug] = useState('');
  const [stack, setStack] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  return (
    <main className="studio st-guide">
      <a className="st-skip" href="#stacks">
        本文へ移動
      </a>
      <StudioHeader page="guide" />
      <section className="st-guide-intro" aria-labelledby="guide-title">
        <a className="st-guide-back" href={HOME}>
          <ArrowLeft size={16} aria-hidden />
          作品一覧へ戻る
        </a>
        <h1 id="guide-title">依頼ガイド</h1>
        <p>
          つくり方の違い、いまの準備状況で変わる費用、制作できるかの目安をまとめました。分かるところだけ見ていただければ十分です。迷ったら、そのままご相談ください。
        </p>
        <ol className="st-guide-toc">
          {toc.map(([label, href], i) => (
            <li key={href}>
              <a href={href}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <Stacks onPick={setStack} />
      <FeasibilityCheck answers={answers} setAnswers={setAnswers} stack={stack} setStack={setStack} />

      <section id="costs" className="st-plans st-costs" aria-labelledby="costs-title">
        <div className="st-section-head">
          <h2 id="costs-title">オプションと、お見積りの例</h2>
          <p>基本のプラン（BASIC 6万円〜、PRO 20万円〜、3D・インタラクティブは個別お見積り）に加えてかかるものです。いずれも税別です。</p>
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

      <Contact refSlug={refSlug} setRefSlug={setRefSlug} stack={stack} setStack={setStack} answers={answers} />
      <StudioFooter page="guide" />
      <ToTop />
    </main>
  );
}
