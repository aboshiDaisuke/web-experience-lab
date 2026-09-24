'use client';
import { useEffect, useRef, useState } from 'react';
import { BASE } from '@/lib/base-path';

export default function Hero() {
  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let disposed = false;
    import('@/lib/scenes/aquarium')
      .then(({ mountAquarium }) => mountAquarium(host.current!, `${BASE}/models/aquarium`))
      .then((tank) => {
        dispose = tank.dispose;
        if (disposed) tank.dispose();
        else setLive(true);
      })
      .catch(() => !disposed && setFailed(true));
    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);
  return (
    <section className={`st-hero ${live ? 'is-live' : ''} ${failed ? 'is-failed' : ''}`} aria-labelledby="hero-title">
      <div
        ref={host}
        className="st-hero-canvas"
        role="img"
        aria-label="水草の茂る水槽を、ネオンテトラの群れやエンゼルフィッシュ、ディスカスが泳いでいます。ガラスに触れると魚が寄ってきて、たたくと散ります。"
      />
      <div className="st-hero-copy">
        <h1 id="hero-title">
          触れた瞬間に、
          <br />
          伝わるサイトを。
        </h1>
        <p>
          企業サイトから3Dの製品ページまで。業種ごとに世界観を設計し、思わず操作したくなるWebサイトをつくります。この水槽も、ブラウザの中で動いています。
        </p>
        <div className="st-hero-actions">
          <a className="st-btn st-btn-light" href="#contact">
            制作を相談する
          </a>
          <a className="st-btn st-btn-ghost" href="#works">
            作品を見る
          </a>
        </div>
      </div>
      {live && (
        <p className="st-hero-hint" aria-hidden>
          ガラスに指を近づけると、魚が寄ってきます。
          <br />
          軽くたたくと、驚いて散ります。
        </p>
      )}
    </section>
  );
}
