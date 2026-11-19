import type { Ticket } from '../types.ts';
import type { GradedGame } from './report.ts';
import { luckPercentile } from './report.ts';

export interface Badge {
  id: string;
  name: string;
  rule: string;
  earned: boolean;
  /** 획득한 회차(있으면) */
  round?: number;
  /** 진행도 0~1 (획득 전 표시용) */
  progress?: number;
}

const real = (t: Ticket) => t.source !== 'analysis';

/** 연속 회차 최대 길이 */
function longestStreak(rounds: number[]): number {
  const set = [...new Set(rounds)].sort((a, b) => a - b);
  let best = 0;
  let cur = 0;
  for (let i = 0; i < set.length; i++) {
    cur = i > 0 && set[i] === set[i - 1] + 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}

/** 같은 6개 번호를 연속 회차로 산 최대 길이 */
function sameNumbersStreak(tickets: Ticket[]): number {
  const byKey = new Map<string, number[]>();
  for (const t of tickets) {
    for (const g of t.games) {
      const k = g.nums.join(',');
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(t.round);
    }
  }
  let best = 0;
  for (const rounds of byKey.values()) best = Math.max(best, longestStreak(rounds));
  return best;
}

/**
 * 배지(업적) 계산. 저장된 복권과 채점 결과만으로 매번 다시 계산한다(따로 저장하지 않음).
 * 분석 번호(적중 기록에서 담은 번호)는 배지에 포함하지 않는다.
 */
export function computeBadges(tickets: readonly Ticket[], graded: readonly GradedGame[], opts: { backedUp?: boolean } = {}): Badge[] {
  const mine = tickets.filter(real);
  const g = graded.filter((x) => real(x.ticket));
  const first = <T,>(xs: T[]) => (xs.length ? xs[0] : undefined);
  const byRoundAsc = [...g].sort((a, b) => a.ticket.round - b.ticket.round);
  const firstWin = first(byRoundAsc.filter((x) => x.result.rank === 5 || (x.result.rank !== null && x.result.rank < 5)));
  const near = first(byRoundAsc.filter((x) => x.result.matched >= 5));
  const bonusOnly = first(byRoundAsc.filter((x) => x.result.bonusHit && x.result.rank === null));
  const streak = longestStreak(mine.map((t) => t.round));
  const total = g.reduce((s, x) => s + x.result.matched, 0);
  const luck = g.length >= 30 ? luckPercentile(total, g.length) : 1;
  const autoN = g.filter((x) => x.game.type === 'auto').length;
  const manualN = g.filter((x) => x.game.type === 'manual').length;
  const same = sameNumbersStreak(mine);
  const qr = mine.filter((t) => t.source === 'qr');

  return [
    { id: 'first-scan', name: '첫 발자국', rule: '복권 QR을 처음 찍기', earned: qr.length > 0, round: qr.at(-1)?.round, progress: qr.length ? 1 : 0 },
    { id: 'first-win', name: '5등 데뷔', rule: '처음으로 5등 이상 당첨', earned: !!firstWin, round: firstWin?.ticket.round },
    { id: 'streak-4', name: '개근상', rule: '4주 연속 복권 저장', earned: streak >= 4, progress: Math.min(1, streak / 4) },
    { id: 'near-miss', name: '아깝다!', rule: '한 게임에서 5개 일치', earned: !!near, round: near?.ticket.round },
    { id: 'club-100', name: '100게임 클럽', rule: '채점한 게임 100개', earned: g.length >= 100, progress: Math.min(1, g.length / 100) },
    { id: 'bonus-tease', name: '보너스의 장난', rule: '등수 없이 보너스 번호만 맞은 게임', earned: !!bonusOnly, round: bonusOnly?.ticket.round },
    { id: 'luck-10', name: '운 상위 10%', rule: '30게임 이상에서 운 백분위 10% 이내', earned: luck <= 0.1, progress: Math.min(1, g.length / 30) },
    { id: 'auto-50', name: '자동 신봉자', rule: '자동으로 산 게임 50개 채점', earned: autoN >= 50, progress: Math.min(1, autoN / 50) },
    { id: 'manual-50', name: '수동 장인', rule: '직접 고른 게임 50개 채점', earned: manualN >= 50, progress: Math.min(1, manualN / 50) },
    { id: 'same-4', name: '같은 번호 사랑', rule: '같은 번호를 4주 연속 구매', earned: same >= 4, progress: Math.min(1, same / 4) },
    { id: 'backup', name: '데이터 수집가', rule: '기록 파일 내려받기', earned: !!opts.backedUp, progress: opts.backedUp ? 1 : 0 },
  ];
}
