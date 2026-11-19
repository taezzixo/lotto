import type { CSSProperties } from 'react';

/**
 * 마킹 용지 격자 (한 줄 7칸, 1~45).
 * heat 모드: 값의 크기를 펜 마킹 진하기로 표시. pick 모드: 눌러서 번호 고르기.
 */
interface SlipProps {
  mode: 'heat' | 'pick';
  values?: number[]; // heat: index 1~45
  selected?: number[]; // pick: 고른 번호, heat: 현재 선택(상세 보기)
  hits?: number[];
  onPick?: (n: number) => void;
  label: string;
  valueLabel?: (n: number, v: number) => string;
}

export function Slip({ mode, values, selected = [], hits = [], onPick, label, valueLabel }: SlipProps) {
  const vs = values?.slice(1) ?? [];
  const min = vs.length ? Math.min(...vs) : 0;
  const max = vs.length ? Math.max(...vs) : 1;
  const alpha = (v: number) => (max === min ? 0.5 : 0.08 + 0.84 * ((v - min) / (max - min)));

  return (
    <div className="slip" role="group" aria-label={label}>
      {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
        const v = values?.[n] ?? 0;
        const isSel = selected.includes(n);
        const style = (mode === 'heat' ? { '--a': alpha(v).toFixed(3) } : {}) as CSSProperties;
        const aria = mode === 'heat' ? valueLabel?.(n, v) ?? `${n}번 ${v}` : `${n}번${isSel ? ' 선택됨' : ''}`;
        return (
          <button
            key={n}
            type="button"
            className={`cell${hits.includes(n) ? ' hit' : ''}`}
            style={style}
            onClick={() => onPick?.(n)}
            aria-pressed={mode === 'pick' ? isSel : undefined}
            aria-current={mode === 'heat' && isSel ? 'true' : undefined}
            aria-label={aria}
            title={aria}
          >
            <span>{n}</span>
            <span className="mark" />
            {mode === 'heat' && <span className="cnt">{v}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function SlipLegend({ low, high }: { low: string; high: string }) {
  return (
    <div className="slip-legend" aria-hidden="true">
      <span>{low}</span>
      <span className="ramp">
        {[0.08, 0.3, 0.5, 0.7, 0.92].map((a) => (
          <i key={a} style={{ '--a': a } as CSSProperties} />
        ))}
      </span>
      <span>{high}</span>
    </div>
  );
}
