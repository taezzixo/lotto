import { useMemo, useState } from 'react';
import type { Actions, AppData } from '../App.tsx';
import { STRATEGIES, backtest, pickFor, summarize, type StrategyId } from '../lib/strategy.ts';
import { EXPECTED_MATCH } from '../lib/lotto.ts';
import { currentSalesRound } from '../lib/schedule.ts';
import { newId } from '../lib/store.ts';
import { pct } from '../lib/format.ts';
import { Ball, MatchBalls } from './Ball.tsx';
import { BarChart } from './Charts.tsx';
import { IconPlus } from './Icons.tsx';

const VERDICT = {
  better: '이론값보다 의미 있게 높았어요. 그래도 다음 주 확률은 같아요.',
  same: '무작위로 고른 것과 통계적으로 구별되지 않아요.',
  worse: '이론값보다 의미 있게 낮았어요. 우연일 가능성도 있어요.',
} as const;

export function Analysis({ data, actions }: { data: AppData; actions: Actions }) {
  const [id, setId] = useState<StrategyId>('hot');
  const all = useMemo(() => STRATEGIES.map((s) => ({ ...s, records: backtest(s.id, data.draws) })), [data.draws]);
  const summaries = useMemo(() => all.map((s) => ({ id: s.id, name: s.name, sum: summarize(s.records) })), [all]);
  const cur = all.find((s) => s.id === id)!;
  const sum = summaries.find((s) => s.id === id)!.sum;
  const next = Math.max(data.latest.no + 1, currentSalesRound());
  const picks = pickFor(id, data.draws, next);
  const last52 = cur.records.slice(-52);
  const recent = cur.records.slice(-12).reverse();
  const recentSum = summarize(cur.records.slice(-52));

  const savePick = () =>
    actions.save({
      id: newId(),
      source: 'analysis',
      round: next,
      createdAt: new Date().toISOString(),
      games: [{ slot: 'A', type: 'pick', nums: picks, strategy: id }],
    });

  return (
    <div className="view">
      <header className="view-head">
        <h2>분석 번호 적중 기록</h2>
        <p>
          매주 그 전 회차까지의 데이터만으로 번호 6개를 고르고, 실제 당첨번호와 맞춰 본 기록이에요. 제21회부터 제{data.latest.no}회까지 {sum.weeks.toLocaleString('ko-KR')}주를
          채점했어요.
        </p>
      </header>

      <div className="seg" role="group" aria-label="분석 방법">
        {STRATEGIES.map((s) => (
          <button key={s.id} type="button" aria-pressed={id === s.id} onClick={() => setId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <section className="sheet" aria-labelledby="pick-title">
          <div className="sheet-head">
            <h3 id="pick-title">제{next}회 분석 번호</h3>
            <span className="badge">{cur.name}</span>
          </div>
          <p className="notice" style={{ marginBottom: 12 }}>
            {cur.rule}
          </p>
          <span className="balls" style={{ gap: 8 }}>
            {picks.map((n) => (
              <Ball key={n} n={n} style={{ ['--size' as string]: '46px' }} />
            ))}
          </span>
          <div className="actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn ghost" onClick={savePick}>
              <IconPlus />
              내 기록에 담기
            </button>
          </div>
          <p className="notice" style={{ marginTop: 8 }}>
            담은 번호는 추첨 뒤 자동으로 채점되고, 실제 구매한 복권과 따로 집계돼요.
          </p>
        </section>

        <section className="sheet" aria-labelledby="sum-title">
          <div className="sheet-head">
            <h3 id="sum-title">지금까지 성적</h3>
            <p>{sum.weeks.toLocaleString('ko-KR')}주</p>
          </div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="stat">
              <span>주당 평균 일치</span>
              <b>{sum.avg.toFixed(2)}개</b>
              <small>무작위 이론값 {EXPECTED_MATCH.toFixed(2)}개</small>
            </div>
            <div className="stat">
              <span>번호 적중률</span>
              <b>{pct(sum.hitRate)}</b>
              <small>이론값 13.3%</small>
            </div>
            <div className="stat">
              <span>5등 이상 나온 주</span>
              <b>{sum.wins}주</b>
              <small>{pct(sum.wins / sum.weeks)} (이론값 2.4%)</small>
            </div>
            <div className="stat">
              <span>최근 52주 평균</span>
              <b>{recentSum.avg.toFixed(2)}개</b>
              <small>최고 {Math.max(...last52.map((r) => r.matched))}개 일치</small>
            </div>
          </div>
          <p className="verdict" style={{ marginTop: 14 }}>
            {VERDICT[sum.verdict]}
          </p>
        </section>

        <section className="sheet span-2" aria-labelledby="weekly-title">
          <div className="sheet-head">
            <h3 id="weekly-title">최근 52주 주간 적중</h3>
            <p>막대 = 그 주에 맞힌 개수</p>
          </div>
          <BarChart
            ariaLabel={`${cur.name} 최근 52주 주간 일치 개수`}
            height={190}
            yMax={4}
            data={last52.map((r) => ({
              key: r.round,
              label: `${r.round}`,
              value: r.matched,
              tip: `제${r.round}회 (${r.date}): ${r.picks.join(', ')} → ${r.matched}개 일치${r.rank ? `, ${r.rank}등` : ''}`,
            }))}
            refLine={{ value: EXPECTED_MATCH, label: '이론값 0.8개' }}
            format={(v) => `${v}개`}
            tickEvery={13}
          />
        </section>

        <section className="sheet" aria-labelledby="compare-title">
          <div className="sheet-head">
            <h3 id="compare-title">방법별 비교</h3>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>방법</th>
                  <th className="r">평균 일치</th>
                  <th className="r">적중률</th>
                  <th className="r">5등 이상</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} aria-current={s.id === id ? 'true' : undefined}>
                    <td>{s.name}</td>
                    <td className="r num">{s.sum.avg.toFixed(3)}</td>
                    <td className="r num">{pct(s.sum.hitRate)}</td>
                    <td className="r num">{s.sum.wins}주</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="notice" style={{ marginTop: 10 }}>
            네 방법 모두 무작위 이론값(0.8개, 13.3%) 근처예요. 과거 출현 패턴은 다음 추첨에 영향을 주지 않아요.
          </p>
        </section>

        <section className="sheet" aria-labelledby="log-title">
          <div className="sheet-head">
            <h3 id="log-title">주간 기록</h3>
            <p>최근 12주</p>
          </div>
          <ul className="mini-list">
            {recent.map((r) => (
              <li key={r.round}>
                <span className="row-meta">
                  <b>제{r.round}회</b>
                  <span>{r.rank ? `${r.rank}등` : `${r.matched}개 일치`}</span>
                </span>
                <MatchBalls nums={r.picks} draw={data.byNo.get(r.round)} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
