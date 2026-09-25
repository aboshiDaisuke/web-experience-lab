'use client';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { projects } from '@/lib/portfolio';
import { goals, workMeta, workOrder, type GoalId } from '@/lib/studio';
import { BASE } from '@/lib/base-path';

const FIRST = 9;
const rank = (slug: string) => {
  const i = workOrder.indexOf(slug);
  return i < 0 ? workOrder.length : i;
};

export default function Works() {
  const [goal, setGoal] = useState<GoalId>('all');
  const [all, setAll] = useState(false);
  const matched = projects.filter(
    (p) => goal === 'all' || workMeta[p.slug].goals.includes(goal),
  );
  const ordered = [...matched].sort((a, b) => rank(a.slug) - rank(b.slug));
  const list = all || goal !== 'all' ? ordered : ordered.slice(0, FIRST);
  return (
    <section id="works" className="st-works" aria-labelledby="works-title">
      <div className="st-section-head">
        <h2 id="works-title">作品</h2>
        <p>
          業種も目的も違う{projects.length}のサイト。画像ではなく実際のサイトなので、予約も3Dの操作も、その場で試せます。
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
      <ul className="st-work-grid">
        {list.map((p) => (
          <li key={p.slug}>
            <a
              className="st-work"
              href={`${BASE}/works/${p.slug}`}
              style={{ '--tone': p.color } as React.CSSProperties}
            >
              <span className="st-work-visual">
                <img
                  src={`${BASE}/images/works/${p.slug}-desktop.jpg`}
                  alt=""
                  loading="lazy"
                />
              </span>
              <span className="st-work-title">
                <b>{p.name}</b>
                <ArrowUpRight size={18} aria-hidden />
              </span>
              <span className="st-work-meta">
                {p.category}
                <span>{workMeta[p.slug].built[0]}</span>
              </span>
              <span className="st-chips">
                {workMeta[p.slug].tech.map((t) => (
                  <i key={t}>{t}</i>
                ))}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {list.length < matched.length && (
        <button className="st-btn st-btn-outline st-works-more" onClick={() => setAll(true)}>
          すべての作品を見る（あと{matched.length - list.length}作品）
        </button>
      )}
    </section>
  );
}
