import type { Draw } from '../types.ts';
import { EXPECTED_MATCH, MATCH_VARIANCE, grade } from './lotto.ts';
import { runLab } from './labpick.ts';

export type StrategyId = 'lab' | 'hot' | 'cold' | 'top' | 'random';

export const STRATEGIES: { id: StrategyId; name: string; rule: string }[] = [
  { id: 'lab', name: '실험실 픽', rule: '규칙 10개의 점수를 합쳐, 역대 당첨 조합에 가장 흔한 모양 6가지를 모두 갖춘 조합 중 점수가 가장 높은 6개를 골라요. 7번째는 보너스 후보. 1회부터 매 회차 그 전 데이터만으로 규칙 가중치를 다시 정해요' },
  { id: 'hot', name: '요즘 자주 나온 번호', rule: '직전 20회에서 가장 많이 나온 6개 (같으면 더 최근에 나온 번호)' },
  { id: 'cold', name: '오래 쉰 번호', rule: '마지막으로 나온 지 가장 오래된 6개' },
  { id: 'top', name: '역대 많이 나온 번호', rule: '1회부터 직전 회차까지 가장 많이 나온 6개' },
  { id: 'random', name: '무작위 (비교 기준)', rule: '회차 번호를 씨앗으로 한 무작위 6개. 다른 전략이 이보다 나은지 보는 기준선' },
];

const HOT_WINDOW = 20;
export const BACKTEST_START = HOT_WINDOW + 1; // 21회부터 채점

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomPick(round: number): number[] {
  const rnd = mulberry32(Math.imul(round, 2654435761));
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 6).sort((a, b) => a - b);
}

function topSix(score: (n: number) => number, tie: (n: number) => number): number[] {
  const ns = Array.from({ length: 45 }, (_, i) => i + 1);
  ns.sort((a, b) => score(b) - score(a) || tie(b) - tie(a) || a - b);
  return ns.slice(0, 6).sort((a, b) => a - b);
}

/** history = 대상 회차 직전까지의 회차들(오름차순). 대상 회차 번호는 round. */
export function pickFor(id: StrategyId, history: readonly Draw[], round: number): number[] {
  if (id === 'random') return randomPick(round);
  if (id === 'lab') return runLab(history).next.picks;
  const lastSeen = new Array(46).fill(0);
  const total = new Array(46).fill(0);
  for (const d of history) for (const n of d.nums) {
    lastSeen[n] = d.no;
    total[n]++;
  }
  if (id === 'cold') return topSix((n) => -lastSeen[n], () => 0);
  if (id === 'top') return topSix((n) => total[n], () => 0);
  const recent = new Array(46).fill(0);
  for (const d of history.slice(-HOT_WINDOW)) for (const n of d.nums) recent[n]++;
  return topSix((n) => recent[n], (n) => lastSeen[n]);
}

export interface WeekRecord {
  round: number;
  date: string;
  picks: number[];
  matched: number;
  rank: 1 | 2 | 3 | 4 | 5 | null;
}

/** 21회부터 최신 회차까지, 매주 직전 데이터만으로 고른 번호를 실제 당첨번호와 대조 */
export function backtest(id: StrategyId, draws: readonly Draw[]): WeekRecord[] {
  if (id === 'lab') return labRecords(runLab(draws).weeks);
  const out: WeekRecord[] = [];
  const lastSeen = new Array(46).fill(0);
  const total = new Array(46).fill(0);
  const recent = new Array(46).fill(0);
  for (let i = 0; i < draws.length; i++) {
    const d = draws[i];
    if (i >= BACKTEST_START - 1) {
      let picks: number[];
      if (id === 'random') picks = randomPick(d.no);
      else if (id === 'cold') picks = topSix((n) => -lastSeen[n], () => 0);
      else if (id === 'top') picks = topSix((n) => total[n], () => 0);
      else picks = topSix((n) => recent[n], (n) => lastSeen[n]);
      const r = grade(picks, d);
      out.push({ round: d.no, date: d.date, picks, matched: r.matched, rank: r.rank });
    }
    for (const n of d.nums) {
      lastSeen[n] = d.no;
      total[n]++;
      recent[n]++;
    }
    if (i >= HOT_WINDOW) for (const n of draws[i - HOT_WINDOW].nums) recent[n]--;
  }
  return out;
}

export interface StrategySummary {
  weeks: number;
  avg: number;
  hitRate: number;
  wins: number;
  dist: number[];
  z: number; // (평균 − 0.8) ÷ 표준오차
  verdict: 'better' | 'same' | 'worse';
}

export function summarize(records: readonly WeekRecord[]): StrategySummary {
  const dist = new Array(7).fill(0);
  let sum = 0;
  let wins = 0;
  for (const r of records) {
    dist[r.matched]++;
    sum += r.matched;
    if (r.rank) wins++;
  }
  const weeks = records.length;
  const avg = weeks ? sum / weeks : 0;
  const z = weeks ? (avg - EXPECTED_MATCH) / Math.sqrt(MATCH_VARIANCE / weeks) : 0;
  return { weeks, avg, hitRate: avg / 6, wins, dist, z, verdict: z >= 1.96 ? 'better' : z <= -1.96 ? 'worse' : 'same' };
}

/** 실험실 픽 주간 기록을 다른 방법과 같은 형식·구간(21회부터)으로 */
export function labRecords(weeks: ReturnType<typeof runLab>['weeks']): WeekRecord[] {
  return weeks.filter((w) => w.round >= BACKTEST_START).map(({ round, date, picks, matched, rank }) => ({ round, date, picks, matched, rank }));
}
