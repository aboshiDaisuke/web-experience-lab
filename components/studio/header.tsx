'use client';
import { useEffect, useState } from 'react';
import { BASE, HOME } from '@/lib/base-path';

// On the top page the links are anchors; on the guide they lead back to the top.
export const homeNav = [
  ['作品', '#works'],
  ['できること', '#services'],
  ['料金', '#plans'],
  ['制作の流れ', '#process'],
];

export default function StudioHeader({ page }: { page: 'home' | 'guide' }) {
  const [solid, setSolid] = useState(page === 'guide');
  useEffect(() => {
    if (page === 'guide') return;
    const onScroll = () => setSolid(scrollY > innerHeight * 0.8);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [page]);
  const top = page === 'home' ? '' : HOME;
  return (
    <header className={`st-header ${solid ? 'is-solid' : ''}`}>
      <a href={HOME} className="st-logo" aria-label="Web Experience Lab トップへ">
        <b>W/E</b>
        <span>Web Experience Lab</span>
      </a>
      <nav aria-label="サイト内">
        {homeNav.map(([label, hash]) => (
          <a key={hash} href={`${top}${hash}`}>
            {label}
          </a>
        ))}
        <a href={`${BASE}/guide`} aria-current={page === 'guide' ? 'page' : undefined}>
          依頼ガイド
        </a>
      </nav>
      <a className="st-header-cta" href="#contact">
        制作を相談する
      </a>
    </header>
  );
}

export function StudioFooter({ page }: { page: 'home' | 'guide' }) {
  const top = page === 'home' ? '' : HOME;
  return (
    <footer className="st-footer">
      <a href={HOME} className="st-logo">
        <b>W/E</b>
        <span>Web Experience Lab</span>
      </a>
      <nav aria-label="フッター">
        {homeNav.map(([label, hash]) => (
          <a key={hash} href={`${top}${hash}`}>
            {label}
          </a>
        ))}
        <a href={`${BASE}/guide`}>依頼ガイド</a>
        <a href="#contact">相談する</a>
      </nav>
      <p>掲載作品のブランド・人物・価格はすべて架空の制作サンプルです。© 2026 Web Experience Lab</p>
    </footer>
  );
}
