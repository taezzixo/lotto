import type { Draw } from '../types.ts';
import { popularityIndex } from './lotto.ts';

export type Period = 'all' | 100 | 50 | 15;

export function inPeriod(draws: readonly Draw[], period: Period): Draw[] {
  return period === 'all' ? draws.slice() : draws.slice(-period);
}

/** 번호별 출현 횟수 (index 1~45 사용, 0은 비움) */
export function frequency(draws: readonly Draw[], withBonus: boolean): number[] {
  const f = new Array(46).fill(0);
  for (const d of draws) {
    for (const n of d.nums) f[n]++;
    if (withBonus) f[d.bonus]++;
  }
  return f;
}

/** 번호별 마지막 출현 이후 지난 회차 수 (최신 회차에 나왔으면 0) */
export function gaps(draws: readonly Draw[], withBonus: boolean): number[] {
  const g = new Array(46).fill(draws.length);
  const last = draws.length ? draws[draws.length - 1].no : 0;
  const seen = new Set<number>();
  for (let i = draws.length - 1; i >= 0 && seen.size < 45; i--) {
    const d = draws[i];
    for (const n of withBonus ? [...d.nums, d.bonus] : d.nums) {
      if (!seen.has(n)) {
        seen.add(n);
        g[n] = last - d.no;
      }
    }
  }
  g[0] = 0;
  return g;
}

export interface Ranked {
  n: number;
  value: number;
}

export function ranked(values: readonly number[], order: 'desc' | 'asc'): Ranked[] {
  const rows = values.map((value, n) => ({ n, value })).slice(1);
  return rows.sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value) || a.n - b.n);
}

/** 번호대(1~10, 11~20, 21~30, 31~40, 41~45) 비중 vs 기대 비중 */
export function bandShare(draws: readonly Draw[], withBonus: boolean) {
  const f = frequency(draws, withBonus);
  const total = f.reduce((a, b) => a + b, 0) || 1;
  const bands = [
    [1, 10],
    [11, 20],
    [21, 30],
    [31, 40],
    [41, 45],
  ] as const;
  return bands.map(([lo, hi]) => {
    let c = 0;
    for (let n = lo; n <= hi; n++) c += f[n];
    return { label: `${lo}~${hi}`, lo, hi, count: c, share: c / total, expected: (hi - lo + 1) / 45 };
  });
}

export interface FirstPrizeSummary {
  most: Draw;
  least: Draw; // 1명 이상 중 1인당 당첨금이 가장 적은 회차
  highestPrize: Draw;
  rollovers: number[]; // 1등 0명 회차
  avgWinners: number;
  typeShare: { auto: number; semi: number; manual: number; total: number; from: number } | null;
}

export function firstPrizeSummary(draws: readonly Draw[]): FirstPrizeSummary {
  const withWinner = draws.filter((d) => d.first.winners > 0);
  const most = withWinner.reduce((a, b) => (b.first.winners > a.first.winners ? b : a));
  const least = withWinner.reduce((a, b) => (b.first.prize < a.first.prize ? b : a));
  const highestPrize = withWinner.reduce((a, b) => (b.first.prize > a.first.prize ? b : a));
  const typed = draws.filter((d) => d.firstType);
  let typeShare: FirstPrizeSummary['typeShare'] = null;
  if (typed.length) {
    const t = { auto: 0, semi: 0, manual: 0 };
    for (const d of typed) {
      t.auto += d.firstType!.auto;
      t.semi += d.firstType!.semi;
      t.manual += d.firstType!.manual;
    }
    typeShare = { ...t, total: t.auto + t.semi + t.manual, from: typed[0].no };
  }
  return {
    most,
    least,
    highestPrize,
    rollovers: draws.filter((d) => d.first.winners === 0).map((d) => d.no),
    avgWinners: withWinner.reduce((s, d) => s + d.first.winners, 0) / draws.length,
    typeShare,
  };
}

/**
 * 당첨번호 패턴별 평균 인기도 지수.
 * 1~31(날짜) 번호가 많은 회차일수록 1등이 많이 나왔는지 본다.
 */
export function popularityByBirthdayCount(draws: readonly Draw[]) {
  const groups = new Map<number, number[]>();
  for (const d of draws) {
    const p = popularityIndex(d);
    if (p === null) continue;
    const k = d.nums.filter((n) => n <= 31).length;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, xs]) => {
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, xs.length - 1));
      return { birthdayCount: k, mean, n: xs.length, ci95: (1.96 * sd) / Math.sqrt(xs.length) };
    });
}

/** 판매 게임 수 대비 1등 인원(인기도 지수)의 연도별 평균 */
export function yearlyFirstPrize(draws: readonly Draw[]) {
  const by = new Map<number, Draw[]>();
  for (const d of draws) {
    const y = Number(d.date.slice(0, 4));
    if (!by.has(y)) by.set(y, []);
    by.get(y)!.push(d);
  }
  return [...by.entries()].map(([year, ds]) => ({
    year,
    draws: ds.length,
    avgWinners: ds.reduce((s, d) => s + d.first.winners, 0) / ds.length,
    avgPrize: ds.filter((d) => d.first.winners).reduce((s, d) => s + d.first.prize, 0) / Math.max(1, ds.filter((d) => d.first.winners).length),
  }));
}
