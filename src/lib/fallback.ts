import type { Draw } from '../types.ts';
import { isValidGame } from './lotto.ts';
import { drawTime, lastDrawnRound } from './schedule.ts';

/** 공개 미러(GitHub Pages, CORS 허용). 공식 수집이 늦을 때만 브라우저가 직접 조회한다. */
export const FALLBACK_URL = 'https://smok95.github.io/lotto/results/latest.json';
/** 추첨 후 이 시간이 지나도 사이트 데이터에 새 회차가 없으면 대체 조회 */
export const FALLBACK_AFTER_MS = 60 * 60 * 1000;

/** 지금 대체 조회가 필요한 회차(없으면 null) */
export function missingRound(latestNo: number, now: Date = new Date()): number | null {
  const due = lastDrawnRound(now);
  if (due <= latestNo) return null;
  const next = latestNo + 1;
  return now.getTime() - drawTime(next).getTime() >= FALLBACK_AFTER_MS ? next : null;
}

/** 미러 응답 → 잠정 회차. 형식·회차·날짜가 맞지 않으면 null */
export function fromMirror(p: unknown, expectedNo: number): Draw | null {
  const m = p as {
    draw_no?: number;
    numbers?: number[];
    bonus_no?: number;
    date?: string;
    divisions?: { prize?: number; winners?: number }[];
    total_sales_amount?: number;
    winners_combination?: { auto?: number; semi_auto?: number; manual?: number };
  };
  if (!m || m.draw_no !== expectedNo || !Array.isArray(m.numbers)) return null;
  const nums = [...m.numbers].map(Number).sort((a, b) => a - b);
  const bonus = Number(m.bonus_no);
  if (!isValidGame(nums) || !(bonus >= 1 && bonus <= 45) || nums.includes(bonus)) return null;
  const date = String(m.date ?? '').slice(0, 10);
  const expectedDate = new Date(drawTime(expectedNo).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  if (date !== expectedDate) return null;
  const first = m.divisions?.[0] ?? {};
  const c = m.winners_combination;
  return {
    no: expectedNo,
    date,
    nums,
    bonus,
    first: { winners: Number(first.winners ?? 0), prize: Number(first.prize ?? 0) },
    sales: Number(m.total_sales_amount ?? 0),
    firstType: c ? { auto: c.auto ?? 0, semi: c.semi_auto ?? 0, manual: c.manual ?? 0 } : null,
    status: 'PROVISIONAL',
    source: 'client:smok95',
  };
}

export async function fetchFallback(expectedNo: number, fetcher: typeof fetch = fetch): Promise<Draw | null> {
  try {
    const res = await fetcher(FALLBACK_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    return fromMirror(await res.json(), expectedNo);
  } catch {
    return null; // CORS·네트워크 실패 시 조용히 포기(사이트 데이터 반영을 기다림)
  }
}
