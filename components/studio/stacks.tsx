'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react';
import { cautions, needs, scoreLabels, setups, stacks, type NeedId } from '@/lib/studio';

export default function Stacks({ onPick }: { onPick: (id: string) => void }) {
  const [need, setNeed] = useState<NeedId>('all');
  const matched = stacks.filter((s) => s.needs.includes(need));
  return (
    <section id="stacks" className="st-stacks" aria-labelledby="stacks-title">
      <div className="st-section-head">
        <h2 id="stacks-title">
          つくり方も、
          <wbr />
          選べます。
        </h2>
        <p>
          掲載の作品は、見た目と操作を確かめていただくためのHTML版です。本番は、更新のしかたやご予算に合わせて、お好みのつくり方で仕上げます。気に入った作品の見た目のまま、別のつくり方に移すこともできます。
        </p>
      </div>

      <p className="st-stack-ask">いちばん大事にしたいことは?</p>
      <div className="st-filter" role="group" aria-label="重視することで絞り込む">
        {needs.map((n) => (
          <button key={n.id} aria-pressed={need === n.id} onClick={() => setNeed(n.id)}>
            {n.label}
          </button>
        ))}
      </div>
      <p className="st-stack-result" aria-live="polite">
        {need === 'all'
          ? `${stacks.length}つのつくり方を比べられます。`
          : `おすすめは ${matched.map((s) => s.name).join('・')} です。`}
      </p>

      <ol className="st-stack-list">
        {stacks.map((s) => {
          const hit = s.needs.includes(need);
          return (
            <li
              key={s.id}
              className={`st-stack ${hit ? 'is-hit' : ''} ${need !== 'all' && !hit ? 'is-dim' : ''}`}
            >
              <div className="st-stack-id">
                <span className="st-stack-kind">
                  {s.kind}
                  {hit && <b>おすすめ</b>}
                </span>
                <h3>{s.name}</h3>
                <p>{s.fit}</p>
              </div>

              <dl className="st-stack-scores">
                {scoreLabels.map((label, i) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd aria-label={`3段階中${s.scores[i]}`}>
                      {[1, 2, 3].map((v) => (
                        <i key={v} className={v <= s.scores[i] ? 'on' : ''} />
                      ))}
                    </dd>
                  </div>
                ))}
                <div className="st-stack-monthly">
                  <dt>月々かかるもの</dt>
                  <dd>{s.monthly}</dd>
                </div>
              </dl>

              <div className="st-stack-pc">
                <div>
                  <h4>メリット</h4>
                  <ul>
                    {s.pros.map((t) => (
                      <li key={t}>
                        <Plus size={14} aria-hidden />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>デメリット</h4>
                  <ul>
                    {s.cons.map((t) => (
                      <li key={t}>
                        <Minus size={14} aria-hidden />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <a className="st-stack-cta" href="#contact" onClick={() => onPick(s.id)}>
                {s.current ? 'サンプルと同じ形で相談する' : `${s.name}で相談する`}
              </a>
            </li>
          );
        })}
      </ol>
      <div id="setup" className="st-setup" aria-labelledby="setup-title">
        <h3 id="setup-title">いまの準備状況でも、費用は変わります</h3>
        <p>
          同じつくり方でも、すべてこちらで用意するか、すでにサーバーやドメインをお持ちかで金額が変わります。
        </p>
        <ol className="st-setup-list">
          {setups.map((u) => (
            <li key={u.id}>
              <span>{u.who}</span>
              <h4>{u.name}</h4>
              <p>{u.body}</p>
              <b className={`st-setup-cost is-${u.cost}`}>
                {u.cost === 'up' ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />}
                {u.costLabel}
              </b>
            </li>
          ))}
        </ol>
        <p className="st-setup-hint">
          「ドメインってどれのこと?」という段階でも大丈夫です。いまの状況で制作できるかは、
          <a href="#check">このすぐ下で確かめられます</a>。
        </p>
      </div>

      <div className="st-caution" aria-labelledby="caution-title">
        <h3 id="caution-title">ご依頼の前に知っておいていただきたいこと</h3>
        <ul>
          {cautions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p>
          つくり方によって、再現できる演出の範囲が変わります。どれが合うか分からなければ、相談フォームで「おまかせ」を選んでください。目的に合わせてご提案します。
        </p>
      </div>
    </section>
  );
}
