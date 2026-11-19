import { useMemo, useState } from 'react';
import type { AppData } from '../App.tsx';
import { bandShare, firstPrizeSummary, frequency, gaps, inPeriod, popularityByBirthdayCount, ranked, yearlyFirstPrize, type Period } from '../lib/stats.ts';
import { dateKo, pct, won, wonShort } from '../lib/format.ts';
import { Ball } from './Ball.tsx';
import { Slip, SlipLegend } from './Slip.tsx';
import { BarChart, Legend } from './Charts.tsx';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 100, label: '최근 100회' },
  { id: 50, label: '최근 50회' },
  { id: 15, label: '최근 15회' },
];

export function Stats({ data }: { data: AppData }) {
  const [period, setPeriod] = useState<Period>('all');
  const [withBonus, setWithBonus] = useState(false);
  const [sel, setSel] = useState<number>(data.latest.nums[0]);
  const scoped = useMemo(() => inPeriod(data.draws, period), [data.draws, period]);
  const freq = useMemo(() => frequency(scoped, withBonus), [scoped, withBonus]);
  const gap = useMemo(() => gaps(data.draws, withBonus), [data.draws, withBonus]);
  const top = ranked(freq, 'desc');
  const rankOf = (n: number) => top.findIndex((r) => r.n === n) + 1;
  const bands = useMemo(() => bandShare(scoped, withBonus), [scoped, withBonus]);
  const first = useMemo(() => firstPrizeSummary(data.draws), [data.draws]);
  const yearly = useMemo(() => yearlyFirstPrize(data.draws), [data.draws]);
  const pop = useMemo(() => mergeSmall(popularityByBirthdayCount(data.draws)), [data.draws]);
  const scopeLabel = period === 'all' ? `제1회~제${data.latest.no}회` : `최근 ${period}회`;
  const ts = first.typeShare;

  return (
    <div className="view">
      <header className="view-head">
        <h2>번호 통계</h2>
        <p>
          {scopeLabel} 당첨번호 {scoped.length}회를 모았어요. 칸이 진할수록 많이 나온 번호예요.
        </p>
      </header>

      <div className="filters">
        <div className="seg" role="group" aria-label="분석 구간">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="switch">
          <input type="checkbox" checked={withBonus} onChange={(e) => setWithBonus(e.target.checked)} />
          보너스 번호 포함
        </label>
      </div>

      <div className="grid-2">
        <section className="sheet" aria-labelledby="slip-title">
          <div className="sheet-head">
            <h3 id="slip-title">번호별 출현 횟수</h3>
            <p>번호를 누르면 자세히 보여요</p>
          </div>
          <Slip
            mode="heat"
            values={freq}
            selected={[sel]}
            onPick={setSel}
            label={`${scopeLabel} 번호별 출현 횟수`}
            valueLabel={(n, v) => `${n}번 ${v}회`}
          />
          <SlipLegend low={`${Math.min(...freq.slice(1))}회`} high={`${Math.max(...freq.slice(1))}회`} />
          <div className="detail" aria-live="polite">
            <Ball n={sel} />
            <dl>
              <dt>출현</dt>
              <dd>{freq[sel]}회</dd>
              <dt>순위</dt>
              <dd>{rankOf(sel)}위</dd>
              <dt>쉰 회차</dt>
              <dd>{gap[sel] === 0 ? '최신 회차' : `${gap[sel]}회`}</dd>
            </dl>
          </div>
        </section>

        <section className="sheet" aria-labelledby="rank-title">
          <div className="sheet-head">
            <h3 id="rank-title">번호 순위</h3>
          </div>
          <div className="rank-cols">
            <RankList title="많이 나온 번호" rows={top.slice(0, 6)} unit="회" />
            <RankList title="적게 나온 번호" rows={ranked(freq, 'asc').slice(0, 6)} unit="회" />
            <RankList title="오래 쉰 번호" rows={ranked(gap, 'desc').slice(0, 6)} unit="회째" />
          </div>
          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 'var(--step-0)' }}>번호대별 비중 (5개 단위)</h3>
            <BarChart
              ariaLabel="번호대별 출현 비중과 기대 비중"
              height={170}
              data={bands.map((b) => ({ key: b.label, label: b.label, value: b.share, marker: b.expected, tip: `${b.label}: ${pct(b.share)} (번호 수로 기대되는 비중 ${pct(b.expected)})` }))}
              format={(v) => pct(v, 0)}
              valueLabels
            />
            <Legend
              items={[
                { label: '실제 비중', color: 'var(--series-1)' },
                { label: '번호 수로 기대되는 비중', color: 'var(--series-2)', line: true },
              ]}
            />
          </div>
        </section>
      </div>

      <header className="view-head" style={{ marginTop: 10 }}>
        <h2>1등 데이터</h2>
        <p>1등 당첨자 수와 당첨금은 회차마다 판매량과 사람들이 고른 번호에 따라 달라져요.</p>
      </header>

      <section className="sheet">
        <div className="stats">
          <div className="stat">
            <span>1등이 가장 많이 나온 회차</span>
            <b>{first.most.first.winners}명</b>
            <small>
              제{first.most.no}회, 1인당 {won(first.most.first.prize)}
            </small>
          </div>
          <div className="stat">
            <span>1인당 당첨금 최고</span>
            <b>{wonShort(first.highestPrize.first.prize)}</b>
            <small>
              제{first.highestPrize.no}회 ({dateKo(first.highestPrize.date)})
            </small>
          </div>
          <div className="stat">
            <span>1등 없이 이월된 회차</span>
            <b>{first.rollovers.length}회</b>
            <small>마지막은 제{first.rollovers.at(-1)}회</small>
          </div>
          <div className="stat">
            <span>회차당 평균 1등</span>
            <b>{first.avgWinners.toFixed(1)}명</b>
            <small>1회~{data.latest.no}회</small>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="sheet" aria-labelledby="yearly-title">
          <div className="sheet-head">
            <h3 id="yearly-title">연도별 회차당 1등 인원</h3>
          </div>
          <BarChart
            ariaLabel="연도별 회차당 평균 1등 당첨자 수"
            data={yearly.map((y) => ({
              key: y.year,
              label: `'${String(y.year).slice(2)}`,
              value: Number(y.avgWinners.toFixed(1)),
              tip: `${y.year}년: 회차당 1등 ${y.avgWinners.toFixed(1)}명, 1인당 평균 ${won(Math.round(y.avgPrize))} (${y.draws}회)`,
            }))}
            format={(v) => `${v}명`}
            tickEvery={4}
          />
        </section>

        <section className="sheet" aria-labelledby="pop-title">
          <div className="sheet-head">
            <h3 id="pop-title">생일 숫자가 많으면 1등도 많을까</h3>
          </div>
          <p className="notice" style={{ marginBottom: 6 }}>
            인기도 지수는 판매량으로 기대되는 1등 인원 대비 실제 인원이에요. 1보다 크면 그 번호를 고른 사람이 많았다는 뜻이에요.
          </p>
          <BarChart
            ariaLabel="당첨번호 중 1~31 개수별 평균 인기도 지수와 95% 신뢰구간"
            height={190}
            data={pop.map((p) => ({
              key: p.label,
              label: p.label,
              value: Number(p.mean.toFixed(2)),
              tip: `당첨번호에 1~31이 ${p.label}: 인기도 지수 ${p.mean.toFixed(2)} (±${p.ci95.toFixed(2)}, ${p.n}회)`,
            }))}
            errors={pop.map((p) => p.ci95)}
            refLine={{ value: 1, label: '기대 인원' }}
            format={(v) => v.toFixed(1)}
          />
          <p className="notice">세로 선은 95% 신뢰구간이에요. 생일 숫자로만 고르면 1등이 되어도 나눠 가질 사람이 많을 수 있어요.</p>
        </section>
      </div>

      {ts && (
        <section className="sheet" aria-labelledby="type-title">
          <div className="sheet-head">
            <h3 id="type-title">1등은 어떻게 샀을까</h3>
            <p>제{ts.from}회부터 1등 {ts.total.toLocaleString('ko-KR')}명</p>
          </div>
          <div className="split" role="img" aria-label={`자동 ${pct(ts.auto / ts.total)}, 수동 ${pct(ts.manual / ts.total)}, 반자동 ${pct(ts.semi / ts.total)}`}>
            <i style={{ flex: ts.auto, ['--c' as string]: 'var(--series-1)' }} />
            <i style={{ flex: ts.manual, ['--c' as string]: 'var(--series-2)' }} />
            <i style={{ flex: ts.semi, ['--c' as string]: 'var(--series-3)' }} />
          </div>
          <Legend
            items={[
              { label: `자동 ${pct(ts.auto / ts.total)} (${ts.auto.toLocaleString('ko-KR')}명)`, color: 'var(--series-1)' },
              { label: `수동 ${pct(ts.manual / ts.total)} (${ts.manual.toLocaleString('ko-KR')}명)`, color: 'var(--series-2)' },
              { label: `반자동 ${pct(ts.semi / ts.total)} (${ts.semi.toLocaleString('ko-KR')}명)`, color: 'var(--series-3)' },
            ]}
          />
        </section>
      )}

      <section className="sheet">
        <details className="table-toggle">
          <summary>회차별 1등 기록 표로 보기 (최근 30회)</summary>
          <p className="notice">
            회차 번호를 누르면 그 회차 페이지로 가요. <a href="./r/">전체 회차 목록</a>
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>회차</th>
                  <th>추첨일</th>
                  <th>당첨번호</th>
                  <th className="r">1등</th>
                  <th className="r">1인당</th>
                </tr>
              </thead>
              <tbody>
                {data.draws
                  .slice(-30)
                  .reverse()
                  .map((d) => (
                    <tr key={d.no}>
                      <td className="num">
                        <a href={`./r/${d.no}/`}>{d.no}</a>
                      </td>
                      <td>{d.date}</td>
                      <td>{d.nums.join(', ')} + {d.bonus}</td>
                      <td className="r num">{d.first.winners}명</td>
                      <td className="r">{won(d.first.prize)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}

function RankList({ title, rows, unit }: { title: string; rows: { n: number; value: number }[]; unit: string }) {
  return (
    <div>
      <h3>{title}</h3>
      <ol className="rank-list">
        {rows.map((r) => (
          <li key={r.n}>
            <Ball n={r.n} />
            <span className="num">
              {r.value}
              {unit}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 표본이 10회 미만인 묶음은 이웃과 합친다 (0~1개 → "1개 이하") */
function mergeSmall(rows: { birthdayCount: number; mean: number; n: number; ci95: number }[]) {
  const out: { label: string; mean: number; n: number; ci95: number }[] = [];
  let carry: { sum: number; n: number; sq: number; lo: number } | null = null;
  for (const r of rows) {
    if (r.n < 10 || carry) {
      const sd = (r.ci95 * Math.sqrt(r.n)) / 1.96;
      const c: { sum: number; n: number; sq: number; lo: number } = carry ?? { sum: 0, n: 0, sq: 0, lo: r.birthdayCount };
      c.sum += r.mean * r.n;
      c.sq += (sd * sd * Math.max(1, r.n - 1)) + r.n * r.mean * r.mean;
      c.n += r.n;
      carry = c;
      if (c.n >= 10) {
        const mean = c.sum / c.n;
        const variance = Math.max(0, (c.sq - c.n * mean * mean) / Math.max(1, c.n - 1));
        out.push({ label: `${r.birthdayCount}개 이하`, mean, n: c.n, ci95: (1.96 * Math.sqrt(variance)) / Math.sqrt(c.n) });
        carry = null;
      }
      continue;
    }
    out.push({ label: `${r.birthdayCount}개`, mean: r.mean, n: r.n, ci95: r.ci95 });
  }
  return out;
}
