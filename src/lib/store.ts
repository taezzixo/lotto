import type { Ticket } from '../types.ts';
import { isValidGame } from './lotto.ts';

const KEY = 'lotto-lab:tickets:v1';

export interface StoreFile {
  app: 'lotto-lab';
  version: 1;
  exportedAt: string;
  tickets: Ticket[];
}

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 같은 QR(key)이나 같은 id가 이미 있으면 추가하지 않는다. */
export function addTicket(tickets: readonly Ticket[], t: Ticket): { tickets: Ticket[]; duplicate: Ticket | null } {
  const dup = tickets.find((x) => x.id === t.id || (t.key && x.key === t.key)) ?? null;
  if (dup) return { tickets: tickets.slice(), duplicate: dup };
  return { tickets: [t, ...tickets], duplicate: null };
}

export function removeTicket(tickets: readonly Ticket[], id: string): Ticket[] {
  return tickets.filter((t) => t.id !== id);
}

function isTicket(x: unknown): x is Ticket {
  const t = x as Ticket;
  return (
    !!t &&
    typeof t.id === 'string' &&
    Number.isInteger(t.round) &&
    t.round > 0 &&
    ['qr', 'manual', 'analysis'].includes(t.source) &&
    Array.isArray(t.games) &&
    t.games.length > 0 &&
    t.games.every((g) => isValidGame(g.nums))
  );
}

/** 내보낸 파일 병합. 잘못된 항목은 건너뛰고 개수를 알려준다. */
export function mergeImport(tickets: readonly Ticket[], json: string): { tickets: Ticket[]; added: number; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('JSON 파일이 아니에요. 로또랩에서 내보낸 파일을 골라 주세요.');
  }
  const list = (data as StoreFile)?.tickets;
  if (!Array.isArray(list)) throw new Error('로또랩 기록 파일이 아니에요.');
  let out = tickets.slice();
  let added = 0;
  let skipped = 0;
  for (const t of list) {
    if (!isTicket(t)) {
      skipped++;
      continue;
    }
    const r = addTicket(out, t);
    if (r.duplicate) skipped++;
    else {
      out = r.tickets;
      added++;
    }
  }
  out.sort((a, b) => b.round - a.round || b.createdAt.localeCompare(a.createdAt));
  return { tickets: out, added, skipped };
}

export function exportFile(tickets: readonly Ticket[]): string {
  const file: StoreFile = { app: 'lotto-lab', version: 1, exportedAt: new Date().toISOString(), tickets: tickets.slice() };
  return JSON.stringify(file, null, 1);
}

export function loadTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isTicket) : [];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: readonly Ticket[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(tickets));
    return true;
  } catch {
    return false;
  }
}

/** 브라우저가 저장 공간을 지우지 않도록 요청 (iOS 7일 정리 대비) */
export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
