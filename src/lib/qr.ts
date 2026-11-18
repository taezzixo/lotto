import type { Game, GameType } from '../types.ts';

const GAME_TYPE: Record<string, Exclude<GameType, 'pick'>> = { q: 'auto', m: 'manual', s: 'semi' };
const HOST_RE = /(^|\.)(dhlottery\.co\.kr|nlotto\.co\.kr|645lotto\.net)$/;

export type QrErrorCode = 'NOT_LOTTO' | 'BAD_FORMAT' | 'BAD_NUMBERS' | 'NO_GAMES';

export class QrError extends Error {
  code: QrErrorCode;
  constructor(code: QrErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface ParsedTicket {
  round: number;
  games: Game[];
  /** QR의 v 값. 해시 계산 후 저장하지 않는다(티켓 일련번호 포함). */
  v: string;
}

/**
 * 로또 6/45 종이 복권 QR 해석.
 * 형식: http://m.dhlottery.co.kr/?v=<회차 4자리>[유형 1글자 + 번호 2자리×6]×(1~5)<TR 10자리>
 * 유형: q 자동, m 수동, s 반자동, n 미사용(건너뜀)
 */
export function parseLottoQr(raw: string): ParsedTicket {
  const text = raw.trim();
  let v: string | null;
  try {
    const url = new URL(text);
    if (!HOST_RE.test(url.hostname)) throw new QrError('NOT_LOTTO', '로또 6/45 복권의 QR이 아니에요.');
    v = url.searchParams.get('v');
  } catch (e) {
    if (e instanceof QrError) throw e;
    v = text; // 주소가 아니면 v 값만 붙여 넣은 경우로 봄
  }
  const m = /^(\d{4})((?:[a-z]\d{12}){1,5})(\d{0,20})$/.exec(v ?? '');
  if (!m) throw new QrError('BAD_FORMAT', 'QR 내용을 읽을 수 없어요. 복권을 다시 비추거나 번호를 직접 입력해 주세요.');

  const games: Game[] = [];
  for (const [i, block] of (m[2].match(/[a-z]\d{12}/g) ?? []).entries()) {
    const type = GAME_TYPE[block[0]];
    if (!type) continue;
    const nums = (block.slice(1).match(/\d{2}/g) ?? []).map(Number).sort((a, b) => a - b);
    if (nums.some((n) => n < 1 || n > 45) || new Set(nums).size !== 6) {
      throw new QrError('BAD_NUMBERS', 'QR 속 번호가 1~45 범위를 벗어났어요.');
    }
    games.push({ slot: 'ABCDE'[i], type, nums });
  }
  if (games.length === 0) throw new QrError('NO_GAMES', '이 복권에는 채점할 게임이 없어요.');
  return { round: Number(m[1]), games, v: v! };
}

/** 중복 판정용 해시. 원문(일련번호 포함)은 저장하지 않는다. */
export async function ticketKey(v: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(v));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5; // FNV-1a (비보안 환경 대체)
  for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 0x01000193);
  return 'fnv-' + (h >>> 0).toString(16);
}
