'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
export default function DemoInquiry({
  open,
  onClose,
  title,
  summary,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  summary?: string;
  slug: string;
}) {
  const [step, setStep] = useState(0);
  const [service, setService] = useState('');
  const [time, setTime] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) {
      setStep(0);
      setValues({});
      setService(
        slug === 'noir'
          ? summary?.includes('ランチ')
            ? 'ランチ / ¥7,700'
            : 'ディナー / ¥16,500'
          : '',
      );
      setTime('');
    }
  }, [open, slug, summary]);
  const salon = slug === 'lumina',
    dining = slug === 'noir',
    booking = salon || dining;
  const labels: Record<string, string> = {
    service: 'メニュー',
    date: '希望日',
    time: '希望時間',
    guests: '人数',
    name: 'お名前',
    email: 'メールアドレス',
    message: dining ? 'アレルギー・ご要望' : 'ご相談内容',
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`demo-dialog inquiry-${slug}`}>
        <div className="inquiry-progress">
          {['入力', '内容確認', '完了'].map((t, i) => (
            <span key={t} className={step === i ? 'active' : ''}>
              <b>0{i + 1}</b>
              {t}
            </span>
          ))}
        </div>
        <DialogTitle>
          {step === 2 ? '体験いただき、ありがとうございます。' : title}
        </DialogTitle>
        <DialogDescription>
          {step === 2
            ? 'デモの操作が完了しました。実際の予約・注文・送信は行われていません。'
            : step === 1
              ? '内容をご確認ください。修正する場合は入力画面へ戻れます。'
              : `${summary || ''} こちらは制作サンプルです。入力内容は保存・外部送信されません。`}
        </DialogDescription>
        {step === 0 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = Object.fromEntries(
                new FormData(e.currentTarget).entries(),
              );
              setValues(
                Object.fromEntries(
                  Object.entries(data).map(([k, v]) => [k, String(v)]),
                ),
              );
              setStep(1);
            }}
          >
            {booking && (
              <label>
                {salon ? 'ご希望のメニュー' : 'コース'}
                <NativeSelect
                  name="service"
                  value={service}
                  onChange={(e) => {
                    setService(e.target.value);
                    setTime('');
                  }}
                  required
                >
                  <NativeSelectOption value="" disabled>
                    選択してください
                  </NativeSelectOption>
                  {(salon
                    ? [
                        'カット / ¥6,600',
                        'カット＋カラー / ¥14,300',
                        'ヘッドスパ / ¥4,400',
                      ]
                    : ['ディナー / ¥16,500', 'ランチ / ¥7,700']
                  ).map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {t}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
            {booking && (
              <div className="form-columns">
                <label>
                  ご希望日
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={values.date}
                    min={new Date().toLocaleDateString('sv-SE')}
                  />
                </label>
                <label>
                  時間
                  <NativeSelect
                    name="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  >
                    <NativeSelectOption value="" disabled>
                      選択
                    </NativeSelectOption>
                    {(salon
                      ? ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30']
                      : service.startsWith('ランチ')
                        ? ['12:00', '12:30', '13:00']
                        : ['18:00', '18:30', '19:00', '19:30']
                    ).map((t) => (
                      <NativeSelectOption key={t}>{t}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                </label>
              </div>
            )}
            {dining && (
              <label>
                人数
                <NativeSelect
                  name="guests"
                  defaultValue={values.guests || '2名'}
                >
                  {['1名', '2名', '3名', '4名', '5名以上（要相談）'].map(
                    (t) => (
                      <NativeSelectOption key={t}>{t}</NativeSelectOption>
                    ),
                  )}
                </NativeSelect>
              </label>
            )}
            <label>
              お名前
              <input
                required
                name="name"
                autoComplete="name"
                defaultValue={values.name}
                placeholder="山田 太郎"
              />
            </label>
            <label>
              メールアドレス
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                defaultValue={values.email}
                placeholder="name@example.com"
              />
            </label>
            <label>
              {dining ? 'アレルギー・ご要望' : 'ご相談内容'}
              <textarea
                name="message"
                defaultValue={values.message}
                rows={2}
                placeholder={
                  salon
                    ? 'なりたいスタイルや、髪のお悩みなど'
                    : dining
                      ? '食材のアレルギー、記念日のご希望など'
                      : 'ご希望の内容をお聞かせください'
                }
              />
            </label>
            <button className="solid-button" type="submit">
              内容を確認する <ArrowRight size={17} />
            </button>
            <small>デモ用の架空情報でお試しください。</small>
          </form>
        ) : step === 1 ? (
          <div className="inquiry-review">
            <dl>
              {Object.entries(values)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{labels[k] || k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            <button className="solid-button" onClick={() => setStep(2)}>
              この内容でデモを完了 <Check size={18} />
            </button>
            <button className="review-back" onClick={() => setStep(0)}>
              <ArrowLeft size={15} />
              入力内容を修正する
            </button>
          </div>
        ) : (
          <div className="inquiry-finished">
            <div>
              <Check size={30} />
            </div>
            <p>
              ブランドの体験を、入り口から最後まで。
              <br />
              ご覧いただきありがとうございました。
            </p>
            <button className="solid-button" onClick={onClose}>
              サイトに戻る <ArrowRight size={17} />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
