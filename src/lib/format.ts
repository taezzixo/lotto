/** 3103164459 → "31억 316만 원" (만 원 미만 버림) */
export function won(amount: number): string {
  if (amount < 10_000) return `${amount.toLocaleString('ko-KR')}원`;
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / 10_000);
  const parts = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  return `${parts.join(' ')} 원`;
}

/** 큰 금액 축 눈금용: "30억" */
export function wonShort(amount: number): string {
  if (amount >= 100_000_000) return `${Math.round(amount / 100_000_000).toLocaleString('ko-KR')}억`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString('ko-KR')}만`;
  return `${amount}`;
}

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** 2026-11-14 → "2026년 11월 14일" */
export function dateKo(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export function oneIn(p: number): string {
  const n = 1 / p;
  return n < 10 ? `${n.toFixed(1)}명 중 1명` : `${Math.round(n).toLocaleString('ko-KR')}명 중 1명`;
}

export const GAME_TYPE_LABEL = { auto: '자동', manual: '수동', semi: '반자동', pick: '분석 번호' } as const;
