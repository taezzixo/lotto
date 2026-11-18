import type { CSSProperties } from 'react';
import { ballGroup } from '../lib/lotto.ts';

interface BallProps {
  n: number;
  /** miss: 맞지 않은 번호(흐리게), bonusHit: 보너스 일치 표시 */
  state?: 'miss' | 'bonusHit';
  className?: string;
  style?: CSSProperties;
  label?: string;
}

export function Ball({ n, state, className = '', style, label }: BallProps) {
  const cls = ['ball', state === 'miss' ? 'miss' : `g${ballGroup(n)}`, state === 'bonusHit' ? `g${ballGroup(n)} bonus-hit` : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} style={style} aria-label={label ?? `${n}번`} role="img">
      {n}
    </span>
  );
}

/** 내 번호 6개를 당첨번호와 대조해 표시 */
export function MatchBalls({ nums, draw }: { nums: number[]; draw?: { nums: number[]; bonus: number } }) {
  return (
    <span className="balls">
      {nums.map((n) => {
        if (!draw) return <Ball key={n} n={n} />;
        if (draw.nums.includes(n)) return <Ball key={n} n={n} label={`${n}번 일치`} />;
        if (n === draw.bonus) return <Ball key={n} n={n} state="bonusHit" label={`${n}번 보너스 일치`} />;
        return <Ball key={n} n={n} state="miss" label={`${n}번 불일치`} />;
      })}
    </span>
  );
}

export function DrawBalls({ nums, bonus, size }: { nums: number[]; bonus: number; size?: number }) {
  const style = size ? ({ '--size': `${size}px` } as CSSProperties) : undefined;
  return (
    <span className="balls">
      {nums.map((n) => (
        <Ball key={n} n={n} style={style} />
      ))}
      <span className="plus" aria-hidden="true">
        +
      </span>
      <Ball n={bonus} style={style} label={`보너스 ${bonus}번`} />
    </span>
  );
}
