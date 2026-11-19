/** 제1회 추첨: 2002-12-07(토) 20:35 KST. 이후 매주 토요일 20:35, 판매 마감 20:00 */
export const FIRST_DRAW_MS = Date.UTC(2002, 11, 7, 11, 35); // 20:35 KST = 11:35 UTC
export const WEEK_MS = 7 * 24 * 3600 * 1000;
const SALES_CLOSE_BEFORE_MS = 35 * 60 * 1000;

export function drawTime(round: number): Date {
  return new Date(FIRST_DRAW_MS + (round - 1) * WEEK_MS);
}

export function salesClose(round: number): Date {
  return new Date(drawTime(round).getTime() - SALES_CLOSE_BEFORE_MS);
}

/** 지금 시각 기준 추첨이 끝난 마지막 회차 */
export function lastDrawnRound(now: Date = new Date()): number {
  return Math.floor((now.getTime() - FIRST_DRAW_MS) / WEEK_MS) + 1;
}

/** 지금 판매 중인(다음 추첨) 회차 */
export function currentSalesRound(now: Date = new Date()): number {
  return lastDrawnRound(now) + 1;
}

export function remaining(target: Date, now: Date = new Date()) {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { ms, days, hours, minutes, seconds };
}

/** 추첨 알림 일정(.ics) — 서버 없이 토요일 결과 확인 알림 */
export function drawReminderIcs(round: number): string {
  const start = new Date(drawTime(round).getTime() + 15 * 60 * 1000); // 20:50 KST
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//lotto-lab//KO',
    'BEGIN:VEVENT',
    `UID:lotto-lab-${round}@lotto-lab`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:로또 제${round}회 결과 확인`,
    'DESCRIPTION:로또 데이터 실험실을 열면 저장한 복권이 자동으로 채점됩니다.',
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:로또 제${round}회 결과 확인`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
