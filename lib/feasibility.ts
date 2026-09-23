import { stacks } from '@/lib/studio';

export type Answers = Partial<Record<QuestionId, string>>;
export type QuestionId = (typeof questions)[number]['id'];
export type Status = 'ok' | 'cond' | 'ask';
export type Finding = { status: Status; title: string; body: string };

export const questions = [
  {
    id: 'server',
    label: 'サーバー(公開先)',
    hint: 'サイトのデータを置いている場所',
    options: [
      { v: 'none', l: 'まだない' },
      { v: 'rental', l: 'レンタルサーバー', d: 'エックスサーバー、さくら、ロリポップ、ConoHa WING など' },
      { v: 'cloud', l: 'クラウド', d: 'AWS、Google Cloud、Azure など' },
      { v: 'modern', l: 'Vercel・Cloudflare・Netlify' },
      { v: 'builder', l: 'STUDIO・Framer・Wix など', d: 'サイト作成サービスの上にある' },
      { v: 'other', l: '社内サーバー・その他' },
      { v: 'unknown', l: '分からない' },
    ],
  },
  {
    id: 'domain',
    label: 'ドメイン',
    hint: '「example.co.jp」のような、サイトの住所',
    options: [
      { v: 'none', l: 'まだない' },
      { v: 'have', l: '持っていて、管理画面に入れる' },
      { v: 'lost', l: '持っているが、管理先や名義が分からない' },
      { v: 'unknown', l: '分からない' },
    ],
  },
  {
    id: 'mail',
    label: '同じドメインのメール',
    hint: '「info@example.co.jp」のようなアドレス',
    options: [
      { v: 'yes', l: '使っている' },
      { v: 'no', l: '使っていない' },
      { v: 'unknown', l: '分からない' },
    ],
  },
  {
    id: 'photo',
    label: '撮影',
    hint: '商品、お店、スタッフなどの写真',
    options: [
      { v: 'need', l: '撮影してほしい' },
      { v: 'no', l: '撮影はいらない' },
    ],
  },
  {
    id: 'images',
    label: '写真・画像のご提供',
    options: [
      { v: 'all', l: 'すべて用意できる' },
      { v: 'some', l: '一部ならある' },
      { v: 'none', l: 'ほとんどない' },
    ],
  },
  {
    id: 'ai',
    label: '足りない画像の生成(AI)',
    hint: '背景やイメージ写真をAIで作ること',
    options: [
      { v: 'ok', l: '生成してよい' },
      { v: 'mood', l: 'イメージ画像だけならよい' },
      { v: 'ng', l: '使わないでほしい' },
    ],
  },
  {
    id: 'text',
    label: '文章(原稿)',
    options: [
      { v: 'ready', l: '用意できる' },
      { v: 'some', l: '一部だけ' },
      { v: 'none', l: 'おまかせしたい' },
    ],
  },
] as const;

const hosted = ['nocode', 'shopify'];

function serverFinding(server: string, stack: string): Finding {
  const title = 'サーバー';
  const s = stacks.find((x) => x.id === stack);
  if (server === 'none') return { status: 'ok', title, body: '公開先の契約から、お客さまの名義で代行します。' };
  if (server === 'unknown') return { status: 'ok', title, body: 'ご相談のときに、いまの契約内容を一緒に確認します。' };
  if (server === 'other')
    return { status: 'ask', title, body: '社内サーバーなどは、動かせる仕組みを確認してから判断します。' };
  if (s && hosted.includes(s.id) && server !== 'builder')
    return {
      status: 'ok',
      title,
      body: `サイトは${s.name}の上で公開し、ドメインをつなぎます。いまのサーバーは使わなくなる場合があります。`,
    };
  if (server === 'builder') {
    if (!s) return { status: 'ok', title, body: 'いまのサービスのまま作り直すか、ほかへ引っ越すかをご提案します。' };
    if (s.id === 'nocode')
      return {
        status: 'ok',
        title,
        body: 'STUDIO・Framer ならそのまま作れます。Wix など他のサービスの場合は、引っ越しを含めてご提案します。',
      };
    return {
      status: 'cond',
      title,
      body: 'いまのサイト作成サービスからの引っ越しになります。記事や画像は手作業で移すことがあります。',
    };
  }
  if (server === 'rental') {
    if (s?.id === 'next')
      return {
        status: 'cond',
        title,
        body: 'レンタルサーバーでは Next.js が動きません。公開先だけ Vercel や Cloudflare に分ければ、ドメインはそのまま使えます。',
      };
    if (s?.id === 'astro')
      return { status: 'ok', title, body: '書き出したファイルを置くだけなので、いまのレンタルサーバーで動かせます。' };
    if (s) return { status: 'ok', title, body: 'いまのレンタルサーバーで動かせます。' };
    return { status: 'ok', title, body: 'WordPress・Astro・HTML なら、いまのレンタルサーバーで動かせます。' };
  }
  if (server === 'modern') {
    if (s?.id === 'wordpress')
      return {
        status: 'cond',
        title,
        body: 'Vercel などでは WordPress が動きません。WordPress 用のサーバーを別に用意するか、Astro + microCMS をおすすめします。',
      };
    return { status: 'ok', title, body: 'いまの公開先で動かせます。' };
  }
  // cloud
  return {
    status: 'ok',
    title,
    body:
      s?.id === 'wordpress'
        ? '動かせます。構成によっては設定作業が増えることがあります。'
        : 'いまのクラウド環境で動かせます。',
  };
}

export function evaluate(a: Answers, stack: string): Finding[] {
  const out: Finding[] = [];
  const s = stacks.find((x) => x.id === stack);
  if (s) out.push({ status: 'ok', title: 'つくり方', body: `${s.name}で制作できます。` });
  if (a.server) out.push(serverFinding(a.server, stack));

  const domain = {
    none: { status: 'ok', body: 'お客さまの名義で取得を代行します。' },
    have: { status: 'ok', body: '公開の切り替えで設定を変えるため、管理画面に入れる状態にしておいてください。' },
    lost: {
      status: 'cond',
      body: 'まず管理先と名義を一緒に調べます。前の制作会社の名義になっている場合は、名義を移す手続きが必要です。',
    },
    unknown: { status: 'ok', body: 'ご相談のときに一緒に確認します。' },
  } as const;
  if (a.domain) out.push({ title: 'ドメイン', ...domain[a.domain as keyof typeof domain] });

  if (a.mail === 'yes')
    out.push({ status: 'ok', title: 'メール', body: '切り替えでメールが止まらないよう、設定を引き継いでから作業します。' });
  if (a.mail === 'unknown')
    out.push({ status: 'ok', title: 'メール', body: '作業の前に、同じドメインのメールがあるか確認します。' });

  if (a.photo === 'need')
    out.push({ status: 'ok', title: '撮影', body: '撮影の企画と手配を行います。カメラマンの費用は別途お見積りします。' });

  const short = a.images === 'some' || a.images === 'none';
  if (a.images === 'all') out.push({ status: 'ok', title: '画像', body: 'いただいた写真を使って制作します。' });
  if (short) {
    const title = '足りない画像';
    if (a.photo === 'need') out.push({ status: 'ok', title, body: '足りない分は撮影で用意します。' });
    else if (a.ai === 'ok')
      out.push({
        status: 'ok',
        title,
        body: '生成して補います。ただし商品・人物・お店の中など、実物と違うと誤解につながるものは、実物の写真をお願いしています。',
      });
    else if (a.ai === 'mood')
      out.push({ status: 'ok', title, body: '背景やイメージ画像は生成し、商品や人物は写真素材か撮影で補います。' });
    else if (a.ai === 'ng')
      out.push({
        status: 'cond',
        title,
        body:
          a.images === 'none'
            ? '撮影も生成もしない場合は、有料の写真素材か、文字や図を中心にしたデザインで組み立てます。素材費は別途かかります。'
            : '撮影するか、有料の写真素材で補います。素材費は別途かかります。',
      });
    else out.push({ status: 'ok', title, body: '撮影・写真素材・生成のどれで補うかを、ご相談で決めます。' });
  } else if (a.ai === 'ng') {
    out.push({ status: 'ok', title: '画像の生成', body: 'AIによる画像の生成は使いません。' });
  }

  const text = {
    ready: 'いただいた原稿で制作します。',
    some: '足りない部分はこちらで書き、確認していただきます。',
    none: '構成と文章からご提案します。',
  } as const;
  if (a.text) out.push({ status: 'ok', title: '文章', body: text[a.text as keyof typeof text] });
  return out;
}

export function verdict(findings: Finding[]) {
  if (!findings.length) return null;
  if (findings.some((f) => f.status === 'ask')) return { status: 'ask' as Status, label: 'ご相談のうえで判断します' };
  if (findings.some((f) => f.status === 'cond')) return { status: 'cond' as Status, label: '条件つきで制作できます' };
  return { status: 'ok' as Status, label: '制作できます' };
}

export function answerRows(a: Answers): [string, string][] {
  return questions.flatMap((q) => {
    const opt = q.options.find((o) => o.v === a[q.id]);
    return opt ? [[q.label, opt.l] as [string, string]] : [];
  });
}
