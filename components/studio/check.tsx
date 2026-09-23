'use client';
import { Check, CircleHelp, TriangleAlert } from 'lucide-react';
import { stacks } from '@/lib/studio';
import { evaluate, questions, verdict, type Answers, type QuestionId, type Status } from '@/lib/feasibility';

const icons: Record<Status, typeof Check> = { ok: Check, cond: TriangleAlert, ask: CircleHelp };

export default function FeasibilityCheck({
  answers,
  setAnswers,
  stack,
  setStack,
}: {
  answers: Answers;
  setAnswers: (a: Answers) => void;
  stack: string;
  setStack: (id: string) => void;
}) {
  const findings = evaluate(answers, stack);
  const result = verdict(findings);
  const set = (id: QuestionId, v: string) => setAnswers({ ...answers, [id]: v });
  const Icon = result ? icons[result.status] : null;
  return (
    <section id="check" className="st-check" aria-labelledby="check-title">
      <div className="st-section-head">
        <h2 id="check-title">
          制作できるか、
          <wbr />
          先に確かめる。
        </h2>
        <p>
          分かっていることだけ選んでください。サーバーやドメインの状況、写真や文章のご用意によって、制作できるかどうかの目安をその場でお出しします。回答は相談フォームにそのまま引き継がれます。
        </p>
      </div>

      <div className="st-check-body">
        <form className="st-check-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="st-check-q">
            <legend>
              希望のつくり方<small>上の「つくり方」と連動します</small>
            </legend>
            <div className="st-check-opts">
              {[{ id: '', name: 'おまかせ' }, ...stacks].map((s) => (
                <label key={s.id}>
                  <input
                    type="radio"
                    name="check-stack"
                    checked={stack === s.id}
                    onChange={() => setStack(s.id)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {questions.map((q) => (
            <fieldset key={q.id} className="st-check-q">
              <legend>
                {q.label}
                {'hint' in q && <small>{q.hint}</small>}
              </legend>
              <div className="st-check-opts">
                {q.options.map((o) => (
                  <label key={o.v} title={'d' in o ? o.d : undefined}>
                    <input
                      type="radio"
                      name={`check-${q.id}`}
                      checked={answers[q.id] === o.v}
                      onChange={() => set(q.id, o.v)}
                    />
                    <span>
                      {o.l}
                      {'d' in o && <small>{o.d}</small>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button type="button" className="st-check-reset" onClick={() => setAnswers({})}>
            回答をすべて消す
          </button>
          {result && Icon && (
            <a className={`st-check-peek is-${result.status}`} href="#check-result" aria-hidden tabIndex={-1}>
              <Icon size={18} />
              {result.label}
              <span>詳細 ↓</span>
            </a>
          )}
        </form>

        <aside id="check-result" className={`st-check-result ${result ? `is-${result.status}` : ''}`}>
          <span className="st-check-eyebrow">いまの回答での目安</span>
          <span className="st-skip-sr" aria-live="polite">
            {result ? `目安：${result.label}` : ''}
          </span>
          {result && Icon ? (
            <>
              <p className="st-check-verdict">
                <Icon size={28} aria-hidden />
                {result.label}
              </p>
              <ul>
                {findings.map((f) => {
                  const I = icons[f.status];
                  return (
                    <li key={f.title} className={`is-${f.status}`}>
                      <I size={16} aria-label={{ ok: '対応できます', cond: '条件あり', ask: '要相談' }[f.status]} />
                      <div>
                        <b>{f.title}</b>
                        {f.body}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="st-check-empty">質問から、分かるものを選んでください。何も分からなくても、ご相談いただけます。</p>
          )}
          <a className="st-btn st-btn-light" href="#contact">
            この内容で相談する
          </a>
          <small>あくまで目安です。正式なお返事は、ご相談の内容を確認してからお送りします。</small>
        </aside>
      </div>
    </section>
  );
}
