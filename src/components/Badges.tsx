import type { CSSProperties } from 'react';
import type { Badge } from '../lib/badges.ts';

/** 배지 진열장: 얻은 배지는 분홍 동전, 아직이면 점선 동전 + 진행도 */
export function BadgeShelf({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="sheet" aria-labelledby="badge-title">
      <div className="sheet-head">
        <h3 id="badge-title">배지</h3>
        <p>
          {earned} / {badges.length}개
        </p>
      </div>
      <ul className="badges">
        {badges.map((b) => (
          <li key={b.id} className={b.earned ? 'earned' : 'locked'}>
            <span className="coin" aria-hidden="true" style={{ '--p': b.progress ?? 0 } as CSSProperties}>
              {b.earned ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              ) : (
                <span className="pct">{Math.round((b.progress ?? 0) * 100)}%</span>
              )}
            </span>
            <span className="badge-text">
              <b>{b.name}</b>
              <span>{b.earned ? (b.round ? `제${b.round}회에 획득` : '획득') : b.rule}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
