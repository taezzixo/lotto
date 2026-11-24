import type { Draw } from '../types.ts';
import { EXPECTED_MATCH, MATCH_VARIANCE, grade } from './lotto.ts';

/**
 * 실험실 픽 — 규칙 여러 개를 매주 성적으로 다시 저울질하는 적응형 앙상블.
 *
 * 매 회차 t마다 1회~(t−1)회 데이터만 써서
 *   1) 규칙마다 45개 번호에 점수를 매기고(0~1 백분위로 맞춤),
 *   2) 지금까지 각 규칙이 받은 가중치로 점수를 합쳐 상위 6개 + 7번째(보너스 후보)를 고른 뒤,
 *   3) t회 당첨번호 7개(보너스 포함)가 각 규칙에서 몇 백분위였는지로 규칙 성적을 매겨
 *      가중치를 곱셈 갱신(Hedge)한다.
 * 미래 정보는 쓰지 않는다(t회 채점은 t회 직전 상태로만). 무작위라면 규칙 성적은 0.5 근처.
 */

export interface LabRule {
  id: string;
  name: string;
}

export const LAB_RULES: LabRule[] = [
  { id: 'hot10', name: '최근 10회 자주 나온 번호' },
  { id: 'hot30', name: '최근 30회 자주 나온 번호' },
  { id: 'hot100', name: '최근 100회 자주 나온 번호' },
  { id: 'top', name: '역대 많이 나온 번호' },
  { id: 'cold', name: '오래 쉰 번호' },
  { id: 'due', name: '평소 간격보다 오래 쉰 번호' },
  { id: 'repeat', name: '직전 회차 번호 다시 나옴' },
  { id: 'neighbor', name: '직전 번호의 이웃(±1)' },
  { id: 'pair', name: '직전 번호와 자주 함께 나온 번호' },
  { id: 'bonus', name: '최근 보너스로 나온 번호' },
];

const K = LAB_RULES.length;
/** 가중치 학습 속도. 규칙 성적(0.5 기준 편차)에 곱해 지수로 반영 */
export const LAB_ETA = 0.5;
/** 성적 기록·비교는 다른 방법과 같은 21회부터 */
export const LAB_SCORE_FROM = 21;

export interface LabWeek {
  round: number;
  date: string;
  picks: number[]; // 6개
  bonusPick: number; // 7번째 후보
  matched: number; // 6개 중 당첨번호 일치
  rank: 1 | 2 | 3 | 4 | 5 | null;
  near: number; // 7개 중 당첨번호 7개(보너스 포함)와 겹친 수
  /** 이 회차까지 누적: 무작위 대비 증거(z) */
  z: number;
}

export interface LabResult {
  weeks: LabWeek[]; // 2회부터 최신까지
  next: { round: number; picks: number[]; bonusPick: number; scores: number[] };
  /** 최신 가중치(합 1) — 지금 실험실 픽이 믿는 규칙 구성 */
  weights: { id: string; name: string; weight: number; perf: number }[];
}

/** 값 배열(1~45 인덱스)을 0~1 백분위로. 같은 값은 평균 순위 */
function percentile(v: Float64Array): Float64Array {
  const idx = Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => v[a] - v[b]);
  const out = new Float64Array(46);
  let i = 0;
  while (i < 45) {
    let j = i;
    while (j + 1 < 45 && v[idx[j + 1]] === v[idx[i]]) j++;
    const r = (i + j) / 2 / 44;
    for (let k = i; k <= j; k++) out[idx[k]] = r;
    i = j + 1;
  }
  return out;
}

class State {
  seen = 0; // 반영한 회차 수
  total = new Float64Array(46);
  lastSeen = new Float64Array(46); // 마지막 등장 회차(0 = 없음)
  appear = new Float64Array(46); // 등장 횟수(간격 평균용)
  bonusRecent: number[] = []; // 최근 보너스(최대 20)
  pair = Array.from({ length: 46 }, () => new Float64Array(46));
  hist: Draw[] = [];

  add(d: Draw) {
    for (const a of d.nums) {
      this.total[a]++;
      this.lastSeen[a] = d.no;
      this.appear[a]++;
      for (const b of d.nums) if (a !== b) this.pair[a][b]++;
    }
    this.bonusRecent.push(d.bonus);
    if (this.bonusRecent.length > 20) this.bonusRecent.shift();
    this.hist.push(d);
    this.seen++;
  }

  windowCount(w: number): Float64Array {
    const c = new Float64Array(46);
    for (const d of this.hist.slice(-w)) for (const n of d.nums) c[n]++;
    return c;
  }

  /** 규칙별 백분위 점수 (round = 예측 대상 회차) */
  features(round: number): Float64Array[] {
    const last = this.hist[this.hist.length - 1];
    const f: Float64Array[] = [];
    f.push(this.windowCount(10), this.windowCount(30), this.windowCount(100), this.total.slice());
    const cold = new Float64Array(46);
    const due = new Float64Array(46);
    for (let n = 1; n <= 45; n++) {
      const gap = round - (this.lastSeen[n] || 0);
      cold[n] = gap;
      const meanGap = this.appear[n] ? this.seen / this.appear[n] : this.seen + 1;
      due[n] = gap / meanGap;
    }
    f.push(cold, due);
    const repeat = new Float64Array(46);
    const neighbor = new Float64Array(46);
    const pair = new Float64Array(46);
    if (last) {
      for (const a of last.nums) {
        repeat[a] = 1;
        if (a > 1) neighbor[a - 1] += 1;
        if (a < 45) neighbor[a + 1] += 1;
        for (let n = 1; n <= 45; n++) pair[n] += this.pair[a][n];
      }
    }
    f.push(repeat, neighbor, pair);
    const bonus = new Float64Array(46);
    this.bonusRecent.forEach((b, i) => (bonus[b] += 1 + i / 20)); // 최근일수록 조금 더
    f.push(bonus);
    return f.map(percentile);
  }
}

function pick(scores: Float64Array): { six: number[]; seventh: number } {
  const ns = Array.from({ length: 45 }, (_, i) => i + 1).sort((a, b) => scores[b] - scores[a] || a - b);
  return { six: ns.slice(0, 6).sort((a, b) => a - b), seventh: ns[6] };
}

function combine(feats: Float64Array[], logW: Float64Array): Float64Array {
  const m = Math.max(...logW);
  const w = Array.from(logW, (x) => Math.exp(x - m));
  const s = w.reduce((a, b) => a + b, 0);
  const out = new Float64Array(46);
  for (let k = 0; k < K; k++) {
    const wk = w[k] / s;
    const fk = feats[k];
    for (let n = 1; n <= 45; n++) out[n] += wk * fk[n];
  }
  return out;
}

/** 1회부터 최신 회차까지 실험실 픽을 매주 다시 계산하고 채점한다 */
export function runLab(draws: readonly Draw[]): LabResult {
  const st = new State();
  const logW = new Float64Array(K);
  const perfSum = new Float64Array(K);
  let perfN = 0;
  const weeks: LabWeek[] = [];
  let zSum = 0;
  let zN = 0;

  for (const d of draws) {
    if (st.seen > 0) {
      const feats = st.features(d.no);
      const { six, seventh } = pick(combine(feats, logW));
      const g = grade(six, d);
      const truth = [...d.nums, d.bonus];
      const near = [...six, seventh].filter((n) => truth.includes(n)).length;
      if (d.no >= LAB_SCORE_FROM) {
        zSum += g.matched;
        zN++;
      }
      const z = zN ? (zSum / zN - EXPECTED_MATCH) / Math.sqrt(MATCH_VARIANCE / zN) : 0;
      weeks.push({ round: d.no, date: d.date, picks: six, bonusPick: seventh, matched: g.matched, rank: g.rank, near, z });
      // 규칙 성적: 당첨번호 7개가 그 규칙에서 평균 몇 백분위였나 (무작위 0.5)
      for (let k = 0; k < K; k++) {
        const perf = truth.reduce((a, n) => a + feats[k][n], 0) / truth.length;
        logW[k] += LAB_ETA * (perf - 0.5);
        perfSum[k] += perf;
      }
      perfN++;
    }
    st.add(d);
  }

  const nextRound = (draws[draws.length - 1]?.no ?? 0) + 1;
  const scores = combine(st.features(nextRound), logW);
  const { six, seventh } = pick(scores);
  const m = Math.max(...logW);
  const w = Array.from(logW, (x) => Math.exp(x - m));
  const s = w.reduce((a, b) => a + b, 0);
  return {
    weeks,
    next: { round: nextRound, picks: six, bonusPick: seventh, scores: Array.from(scores) },
    weights: LAB_RULES.map((r, k) => ({ ...r, weight: w[k] / s, perf: perfN ? perfSum[k] / perfN : 0.5 })).sort((a, b) => b.weight - a.weight),
  };
}

/** 7개(보너스 후보 포함)와 당첨번호 7개가 무작위로 겹치는 기대 개수 = 7×7/45 */
export const NEAR_EXPECTED = 49 / 45;
