import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

/** 컨테이너 너비를 px로 받아 글자 크기가 화면 폭에 따라 줄지 않게 그린다. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface BarDatum {
  key: string | number;
  label: string; // x축 눈금
  value: number;
  marker?: number; // 같은 막대 위에 겹쳐 그리는 기준값(예: 이론값)
  tip?: string; // 마우스를 올렸을 때 설명
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  yMax?: number;
  format?: (v: number) => string;
  refLine?: { value: number; label: string };
  color?: string;
  markerColor?: string;
  tickEvery?: number;
  valueLabels?: boolean; // 막대 위에 값 표시(막대가 적을 때만)
  ariaLabel: string;
  errors?: number[]; // 95% 신뢰구간 반폭
}

const PAD = { top: 18, right: 8, bottom: 26, left: 40 };

export function BarChart({
  data,
  height = 200,
  yMax,
  format = (v) => String(v),
  refLine,
  color = 'var(--series-1)',
  markerColor = 'var(--series-2)',
  tickEvery = 1,
  valueLabels = false,
  ariaLabel,
  errors,
}: BarChartProps) {
  const [wrap, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(...data.map((d, i) => Math.max(d.value + (errors?.[i] ?? 0), d.marker ?? 0)), refLine?.value ?? 0);
  const max = yMax ?? (peak * 1.12 || 1);
  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const step = iw / data.length;
  const gap = Math.min(2 + step * 0.18, 12);
  const bw = Math.max(1, step - gap);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = niceTicks(max);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? data.length) - 1));
  };
  const cur = active !== null ? data[active] : null;

  return (
    <div ref={wrap}>
      <svg
        className="chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        <g className={active !== null ? 'dim' : ''}>
          {data.map((d, i) => {
            const x = PAD.left + i * step + gap / 2;
            const top = y(d.value);
            const h = PAD.top + ih - top;
            const r = Math.min(4, bw / 2, h);
            return (
              <path
                key={d.key}
                className="bar"
                style={active === i ? { opacity: 1 } : undefined}
                fill={color}
                d={`M${x},${PAD.top + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${PAD.top + ih} Z`}
              />
            );
          })}
        </g>
        {errors &&
          data.map((d, i) => {
            const cx = PAD.left + i * step + step / 2;
            return (
              <g key={`e${d.key}`} stroke="var(--ink-2)" strokeWidth="1.5">
                <line x1={cx} x2={cx} y1={y(d.value + errors[i])} y2={y(Math.max(0, d.value - errors[i]))} />
                <line x1={cx - 4} x2={cx + 4} y1={y(d.value + errors[i])} y2={y(d.value + errors[i])} />
                <line x1={cx - 4} x2={cx + 4} y1={y(Math.max(0, d.value - errors[i]))} y2={y(Math.max(0, d.value - errors[i]))} />
              </g>
            );
          })}
        {data.map((d, i) =>
          d.marker === undefined ? null : (
            <line
              key={`m${d.key}`}
              x1={PAD.left + i * step + gap / 2 - 2}
              x2={PAD.left + i * step + gap / 2 + bw + 2}
              y1={y(d.marker)}
              y2={y(d.marker)}
              stroke={markerColor}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ),
        )}
        {refLine && (
          <g>
            <line className="ref" x1={PAD.left} x2={width - PAD.right} y1={y(refLine.value)} y2={y(refLine.value)} />
          </g>
        )}
        {valueLabels &&
          data.map((d, i) => (
            <text key={`v${d.key}`} className="label" x={PAD.left + i * step + step / 2} y={y(d.value) - 5} textAnchor="middle">
              {format(d.value)}
            </text>
          ))}
        {data.map((d, i) =>
          i % tickEvery === 0 || i === data.length - 1 ? (
            <text key={`x${d.key}`} className="axis" x={PAD.left + i * step + step / 2} y={height - 8} textAnchor="middle">
              {d.label}
            </text>
          ) : null,
        )}
        {data.map((d, i) => (
          <rect
            key={`h${d.key}`}
            className="hit-area"
            x={PAD.left + i * step}
            y={PAD.top}
            width={step}
            height={ih}
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          />
        ))}
      </svg>
      {refLine && <Legend items={[{ label: refLine.label, color: 'var(--ink-2)', line: true }]} />}
      <p className="tip" aria-live="polite">
        {cur ? cur.tip ?? `${cur.label}: ${format(cur.value)}` : ' '}
      </p>
    </div>
  );
}

function niceTicks(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let t = 0; t <= max + 1e-9; t += step) out.push(Number(t.toFixed(6)));
  return out;
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i className={it.line ? 'line' : ''} style={{ ['--c' as string]: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
