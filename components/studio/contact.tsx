'use client';
import { useState } from 'react';
import { projects } from '@/lib/portfolio';
import { contactEndpoint, plans } from '@/lib/studio';

const kinds = [...plans.map((p) => p.name), 'まだ決めていない'];
const budgets = ['30万円未満', '30〜60万円', '60〜100万円', '100万円以上', '未定'];
const timings = ['1か月以内', '2〜3か月後', '半年以内', '未定'];
type Form = {
  ref: string;
  kind: string;
  budget: string;
  timing: string;
  name: string;
  email: string;
  message: string;
};

export default function Contact({
  refSlug,
  setRefSlug,
}: {
  refSlug: string;
  setRefSlug: (slug: string) => void;
}) {
  const [form, setForm] = useState<Omit<Form, 'ref'>>({
    kind: kinds[3],
    budget: budgets[4],
    timing: timings[3],
    name: '',
    email: '',
    message: '',
  });
  const [step, setStep] = useState<'form' | 'confirm' | 'sending' | 'done'>('form');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendError, setSendError] = useState('');
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const refName = projects.find((p) => p.slug === refSlug)?.name ?? '特になし';
  const check = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'お名前を入力してください。';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'メールアドレスを「name@example.com」の形で入力してください。';
    setErrors(e);
    if (Object.keys(e).length === 0) setStep('confirm');
    else document.getElementById(`c-${Object.keys(e)[0]}`)?.focus();
  };
  const send = async () => {
    setSendError('');
    if (!contactEndpoint) return setStep('done');
    setStep('sending');
    try {
      const res = await fetch(contactEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ 気になった作品: refName, ...form }),
      });
      if (!res.ok) throw new Error();
      setStep('done');
    } catch {
      setStep('confirm');
      setSendError('送信できませんでした。通信状況を確認して、もう一度「この内容で送る」を押してください。');
    }
  };
  const rows: [string, string][] = [
    ['気になった作品', refName],
    ['ご依頼の種類', form.kind],
    ['ご予算', form.budget],
    ['ご希望の時期', form.timing],
    ['お名前', form.name],
    ['メールアドレス', form.email],
    ['ご相談内容', form.message || '（未記入）'],
  ];
  return (
    <section id="contact" className="st-contact" aria-labelledby="contact-title">
      <div className="st-contact-intro">
        <h2 id="contact-title">
          まずは、<wbr />
          気になった作品を
          <wbr />
          教えてください。
        </h2>
        <p>
          「この雰囲気で」「この3Dをうちの製品で」といった、ざっくりしたご相談で大丈夫です。内容をうかがって、進め方とお見積りをメールでお送りします。
        </p>
        {refSlug && (
          <figure className="st-contact-ref">
            <img src={`/images/works/${refSlug}-desktop.jpg`} alt="" />
            <figcaption>
              <span>このテイストで相談</span>
              <b>{refName}</b>
            </figcaption>
          </figure>
        )}
      </div>
      <div className="st-contact-panel" aria-live="polite">
        {step === 'form' && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            <label className="st-field">
              <span>気になった作品</span>
              <select value={refSlug} onChange={(e) => setRefSlug(e.target.value)}>
                <option value="">特になし</option>
                {projects.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}（{p.category}）
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="st-field">
              <legend>ご依頼の種類</legend>
              <div className="st-choice">
                {kinds.map((k) => (
                  <label key={k}>
                    <input
                      type="radio"
                      name="kind"
                      checked={form.kind === k}
                      onChange={() => set('kind', k)}
                    />
                    <span>{k}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="st-field-row">
              <label className="st-field">
                <span>ご予算</span>
                <select value={form.budget} onChange={(e) => set('budget', e.target.value)}>
                  {budgets.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </label>
              <label className="st-field">
                <span>ご希望の時期</span>
                <select value={form.timing} onChange={(e) => set('timing', e.target.value)}>
                  {timings.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="st-field-row">
              <label className="st-field">
                <span>お名前</span>
                <input
                  id="c-name"
                  autoComplete="name"
                  value={form.name}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'e-name' : undefined}
                  onChange={(e) => set('name', e.target.value)}
                />
                {errors.name && <em id="e-name">{errors.name}</em>}
              </label>
              <label className="st-field">
                <span>メールアドレス</span>
                <input
                  id="c-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'e-email' : undefined}
                  onChange={(e) => set('email', e.target.value)}
                />
                {errors.email && <em id="e-email">{errors.email}</em>}
              </label>
            </div>
            <label className="st-field">
              <span>ご相談内容（任意）</span>
              <textarea
                rows={4}
                value={form.message}
                placeholder="例：美容室を開業予定です。LUMINA MIRAIのような予約しやすいサイトにしたいです。"
                onChange={(e) => set('message', e.target.value)}
              />
            </label>
            <button className="st-btn st-btn-signal" type="submit">
              入力内容を確認する
            </button>
          </form>
        )}
        {(step === 'confirm' || step === 'sending') && (
          <div className="st-confirm">
            <h3>この内容で送ります</h3>
            <dl>
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {sendError && <p className="st-send-error">{sendError}</p>}
            <div className="st-confirm-actions">
              <button className="st-btn st-btn-quiet" onClick={() => setStep('form')}>
                修正する
              </button>
              <button
                className="st-btn st-btn-signal"
                disabled={step === 'sending'}
                onClick={send}
              >
                {step === 'sending' ? '送信しています' : 'この内容で送る'}
              </button>
            </div>
          </div>
        )}
        {step === 'done' && (
          <div className="st-done">
            <h3>{contactEndpoint ? 'ご相談を送りました' : 'ご相談内容を確認しました'}</h3>
            <p>
              {contactEndpoint
                ? `${form.name}様、ありがとうございます。${form.email} 宛にお返事をお送りします。`
                : 'このサンプルでは送信先が設定されていないため、内容はどこにも送られていません。'}
            </p>
            <button
              className="st-btn st-btn-quiet"
              onClick={() => {
                setStep('form');
                setForm((f) => ({ ...f, message: '' }));
              }}
            >
              別の相談を書く
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
