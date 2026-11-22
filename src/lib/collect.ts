import { drawTime, lastDrawnRound } from './schedule.ts';

/** 배포된 사이트의 latest.json 중 깨우기 판단에 쓰는 부분 */
export interface LatestInfo {
  no: number;
  status: string;
}

export interface CollectDecision {
  dispatch: boolean;
  /** 지금 시각 기준 추첨이 끝난 마지막 회차 */
  expected: number;
  reason: string;
}

/** 추첨 뒤 이만큼은 기다렸다가 깨운다(공식 발표 전 호출 방지) */
export const SETTLE_MS = 20 * 60 * 1000;

/**
 * Cloudflare 예약 실행이 GitHub 수집을 깨울지 정한다.
 * 사이트 데이터가 이미 최신 회차를 「확정」으로 갖고 있으면 깨우지 않는다.
 */
export function collectDecision(latest: LatestInfo | null, now: Date = new Date()): CollectDecision {
  const expected = lastDrawnRound(now);
  if (now.getTime() - drawTime(expected).getTime() < SETTLE_MS) {
    return { dispatch: false, expected, reason: `제${expected}회 추첨 직후라 기다림` };
  }
  if (!latest) return { dispatch: true, expected, reason: '사이트 데이터를 읽지 못함' };
  if (latest.no < expected) return { dispatch: true, expected, reason: `사이트는 제${latest.no}회까지, 제${expected}회 필요` };
  if (latest.status !== 'COMPLETE') return { dispatch: true, expected, reason: `제${latest.no}회가 아직 ${latest.status}` };
  return { dispatch: false, expected, reason: `제${latest.no}회 확정 반영됨` };
}
