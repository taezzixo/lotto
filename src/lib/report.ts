import type { Draw, Game, GameType, GradeResult, Ticket } from '../types.ts';
import { EXPECTED_MATCH, FIXED_PRIZE, MATCH_PROB, MATCH_VARIANCE, TICKET_PRICE, grade } from './lotto.ts';

export interface GradedGame {
  ticket: Ticket;
  game: Game;
  draw: Draw;
  result: GradeResult;
}

export interface PendingGame {
  ticket: Ticket;
  game: Game;
}

export function gradeTickets(tickets: readonly Ticket[], byNo: ReadonlyMap<number, Draw>) {
  const graded: GradedGame[] = [];
  const pending: PendingGame[] = [];
  for (const ticket of tickets) {
    const draw = byNo.get(ticket.round);
    for (const game of ticket.games) {
      if (draw) graded.push({ ticket, game, draw, result: grade(game.nums, draw) });
      else pending.push({ ticket, game });
    }
  }
  return { graded, pending };
}

/** 같은 게임 수를 무작위로 샀을 때 총 일치 개수가 관측값 이상일 확률 P(S ≥ total) */
export function luckPercentile(totalMatched: number, games: number): number {
  if (games <= 0 || totalMatched <= 0) return 1;
  if (games > 500) {
    const mu = EXPECTED_MATCH * games;
    const sd = Math.sqrt(MATCH_VARIANCE * games);
    return 1 - normalCdf((totalMatched - 0.5 - mu) / sd);
  }
  let dist = [1];
  for (let g = 0; g < games; g++) {
    const next = new Array(dist.length + 6).fill(0);
    for (let s = 0; s < dist.length; s++) {
      const p = dist[s];
      if (!p) continue;
      for (let k = 0; k < 7; k++) next[s + k] += p * MATCH_PROB[k];
    }
    dist = next;
  }
  let tail = 0;
  for (let s = Math.max(0, totalMatched); s < dist.length; s++) tail += dist[s];
  return Math.min(1, tail);
}

export function normalCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export interface TypeStat {
  games: number;
  avg: number;
  wins: number;
}

export interface HitReport {
  games: number;
  totalMatched: number;
  avgMatched: number;
  hitRate: number; // Σ일치 ÷ (6 × 게임)
  winRate: number; // 5등 이상 비율
  luckIndex: number; // 평균 일치 ÷ 0.8 × 100
  luckTop: number; // P(S ≥ 관측) — 작을수록 운이 좋음
  dist: number[]; // 일치 0~6 게임 수
  ranks: Record<1 | 2 | 3 | 4 | 5, number>;
  best: GradedGame | null;
  luckyNumbers: { n: number; hits: number; picked: number }[];
  byType: Partial<Record<GameType, TypeStat>>;
  cost: number;
  knownPrize: number; // 1등 실제 + 4·5등 고정액
  unknownPrizeWins: number; // 2·3등(금액 미집계)
}

export function hitReport(graded: readonly GradedGame[]): HitReport {
  const dist = new Array(7).fill(0);
  const ranks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  const hits = new Array(46).fill(0);
  const picked = new Array(46).fill(0);
  const byType: Partial<Record<GameType, TypeStat>> = {};
  let total = 0;
  let knownPrize = 0;
  let unknownPrizeWins = 0;
  let best: GradedGame | null = null;

  for (const g of graded) {
    const { matched, rank } = g.result;
    total += matched;
    dist[matched]++;
    if (rank) {
      ranks[rank]++;
      if (rank === 1) knownPrize += g.draw.first.prize;
      else if (FIXED_PRIZE[rank]) knownPrize += FIXED_PRIZE[rank]!;
      else unknownPrizeWins++;
    }
    for (const n of g.game.nums) {
      picked[n]++;
      if (g.draw.nums.includes(n)) hits[n]++;
    }
    const t = (byType[g.game.type] ??= { games: 0, avg: 0, wins: 0 });
    t.games++;
    t.avg += matched;
    if (rank) t.wins++;
    if (!best || matched > best.result.matched || (matched === best.result.matched && g.result.bonusHit && !best.result.bonusHit)) best = g;
  }
  for (const t of Object.values(byType)) t!.avg = t!.games ? t!.avg / t!.games : 0;

  const games = graded.length;
  const avg = games ? total / games : 0;
  const luckyNumbers = hits
    .map((h, n) => ({ n, hits: h, picked: picked[n] }))
    .filter((x) => x.n > 0 && x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.hits / b.picked - a.hits / a.picked || a.n - b.n)
    .slice(0, 3);

  return {
    games,
    totalMatched: total,
    avgMatched: avg,
    hitRate: games ? total / (6 * games) : 0,
    winRate: games ? (ranks[1] + ranks[2] + ranks[3] + ranks[4] + ranks[5]) / games : 0,
    luckIndex: games ? Math.round((avg / EXPECTED_MATCH) * 100) : 0,
    luckTop: luckPercentile(total, games),
    dist,
    ranks,
    best,
    luckyNumbers,
    byType,
    cost: graded.length * TICKET_PRICE,
    knownPrize,
    unknownPrizeWins,
  };
}
