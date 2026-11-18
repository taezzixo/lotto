/** public/data/draws.json 한 회차 (scripts/update_lotto.py 가 생성) */
export interface Draw {
  no: number;
  date: string; // YYYY-MM-DD (토요일)
  nums: number[]; // 본번호 6개, 오름차순
  bonus: number;
  first: { winners: number; prize: number }; // 1등 인원 / 1인당 당첨금(원)
  sales: number; // 총 판매액(원)
  firstType: { auto: number; semi: number; manual: number } | null;
  status: 'COMPLETE' | 'PARTIAL' | 'PROVISIONAL';
  source: string;
}

export interface LatestFile {
  latest: Draw;
  count: number;
  nextRound: number;
  nextDrawAt: string;
  updatedAt: string;
}

export type GameType = 'auto' | 'manual' | 'semi' | 'pick';
export type TicketSource = 'qr' | 'manual' | 'analysis';

export interface Game {
  slot: string; // A~E
  type: GameType;
  nums: number[];
  strategy?: string; // source === 'analysis' 일 때 전략 id
}

export interface Ticket {
  id: string;
  source: TicketSource;
  round: number;
  key?: string; // QR 원문 SHA-256 (중복 판정용, 원문은 저장하지 않음)
  createdAt: string;
  games: Game[];
}

export interface GradeResult {
  matched: number;
  bonusHit: boolean;
  rank: 1 | 2 | 3 | 4 | 5 | null;
}
