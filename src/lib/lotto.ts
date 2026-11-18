import type { Draw, GradeResult } from '../types.ts';

export const TOTAL_COMBOS = 8_145_060; // C(45, 6)
export const TICKET_PRICE = 1000;

/** 1게임 일치 개수 0~6의 경우의 수 (초기하분포) */
export const MATCH_COUNTS = [3262623, 3454542, 1233765, 182780, 11115, 234, 1] as const;
export const MATCH_PROB = MATCH_COUNTS.map((c) => c / TOTAL_COMBOS);
export const EXPECTED_MATCH = 0.8; // 6 × 6/45
export const MATCH_VARIANCE = 0.6145454545454545;
/** 5등 이상(3개 이상 일치) 확률 */
export const WIN_PROB = (182780 + 11115 + 234 + 1) / TOTAL_COMBOS;

export const RANK_ODDS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: TOTAL_COMBOS,
  2: TOTAL_COMBOS / 6,
  3: TOTAL_COMBOS / 228,
  4: TOTAL_COMBOS / 11115,
  5: TOTAL_COMBOS / 182780,
};
export const FIXED_PRIZE: Partial<Record<1 | 2 | 3 | 4 | 5, number>> = { 4: 50_000, 5: 5_000 };

/** 공 색 묶음: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록 */
export function ballGroup(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.ceil(n / 10)) as 1 | 2 | 3 | 4 | 5;
}

export function grade(nums: readonly number[], draw: Pick<Draw, 'nums' | 'bonus'>): GradeResult {
  const matched = nums.filter((n) => draw.nums.includes(n)).length;
  const bonusHit = nums.includes(draw.bonus);
  const rank =
    matched === 6 ? 1 : matched === 5 && bonusHit ? 2 : matched === 5 ? 3 : matched === 4 ? 4 : matched === 3 ? 5 : null;
  return { matched, bonusHit, rank };
}

export function isValidGame(nums: readonly number[]): boolean {
  return nums.length === 6 && new Set(nums).size === 6 && nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);
}

/** 1등 세후 실수령액: (당첨금 − 구입비 1,000원)에 3억 이하 22%, 초과분 33%. 200만 원 이하 비과세 */
export function afterTax(prize: number): number {
  if (prize <= 2_000_000) return prize;
  const taxable = prize - TICKET_PRICE;
  const low = Math.min(taxable, 300_000_000);
  const high = Math.max(0, taxable - 300_000_000);
  return Math.round(prize - low * 0.22 - high * 0.33);
}

/** 인기도 지수 = 실제 1등 인원 ÷ 기대 인원(판매 게임 수 ÷ 8,145,060) */
export function popularityIndex(d: Pick<Draw, 'sales' | 'first'>): number | null {
  if (!d.sales) return null;
  const expected = d.sales / TICKET_PRICE / TOTAL_COMBOS;
  return d.first.winners / expected;
}
