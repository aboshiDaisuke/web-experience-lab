'use client';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { projects } from '@/lib/portfolio';
import { goals, workMeta, type GoalId } from '@/lib/studio';

export default function Works({
  onConsult,
}: {
  onConsult: (slug: string) => void;
}) {
  const [goal, setGoal] = useState<GoalId>('all');
  const list = projects.filter(
    (p) => goal === 'all' || workMeta[p.slug].goals.includes(goal),
  );
  return (
    <section id="works" className="st-works" aria-labelledby="works-title">
      <div className="st-section-head">
        <h2 id="works-title">作品</h2>
        <p>
          業種も目的も違う10のサイト。どれも画面の中で予約や3D操作まで試せます。つくりたいものに近い作品から見てください。
        </p>
      </div>
      <div className="st-filter" role="group" aria-label="目的で絞り込む">
        {goals.map((g) => (
          <button
            key={g.id}
            aria-pressed={goal === g.id}
            onClick={() => setGoal(g.id)}
          >
            {g.label}
            <span>
              {g.id === 'all'
                ? projects.length
                : projects.filter((p) => workMeta[p.slug].goals.includes(g.id))
                    .length}
            </span>
          </button>
        ))}
      </div>
      <div className="st-work-grid">
        {list.map((p) => {
          const meta = workMeta[p.slug];
          return (
            <article
              key={p.slug}
              className="st-work"
              style={{ '--tone': p.color } as React.CSSProperties}
            >
              <a
                className="st-work-visual"
                href={`/works/${p.slug}`}
                aria-label={`${p.name}のサイトを開く`}
              >
                <img
                  className="st-work-desktop"
                  src={`/images/works/${p.slug}-desktop.jpg`}
                  alt=""
                  loading="lazy"
                />
                <img
                  className="st-work-phone"
                  src={`/images/works/${p.slug}-mobile.jpg`}
                  alt=""
                  loading="lazy"
                />
              </a>
              <div className="st-work-body">
                <div className="st-work-title">
                  <h3>{p.name}</h3>
                  <span>{p.category}</span>
                </div>
                <p>{p.description}</p>
                <ul aria-label="このサイトでつくったもの">
                  {meta.built.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <div className="st-work-foot">
                  <span>同じ規模なら {meta.scale}</span>
                  <div>
                    <a href={`/works/${p.slug}`}>
                      サイトを見る <ArrowUpRight size={15} />
                    </a>
                    <button onClick={() => onConsult(p.slug)}>
                      このテイストで相談
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
