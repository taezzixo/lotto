/**
 * Cloudflare Worker — 정적 사이트(assets) + 토요일 밤 수집 깨우기(Cron Trigger).
 * GitHub Actions 예약 실행은 몇 시간씩 밀릴 수 있어(2026-11-21 약 7시간),
 * Cloudflare가 정해진 시각에 사이트 데이터를 보고 최신 회차가 없으면 workflow_dispatch로 수집을 시작한다.
 * 비밀값: GH_TOKEN (fine-grained, 이 저장소 Actions 읽기·쓰기만). 설정법은 docs/API_KEYS.md.
 */
import { collectDecision, type LatestInfo } from '../src/lib/collect.ts';

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  GH_TOKEN?: string;
  GH_REPO: string;
  GH_WORKFLOW: string;
  GH_REF: string;
}
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}
interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

async function readLatest(env: Env): Promise<LatestInfo | null> {
  try {
    const res = await env.ASSETS.fetch(new Request('https://assets.local/data/latest.json'));
    if (!res.ok) return null;
    const body = (await res.json()) as { latest?: LatestInfo };
    return body.latest && typeof body.latest.no === 'number' ? body.latest : null;
  } catch {
    return null;
  }
}

async function wake(env: Env, now: Date): Promise<string> {
  const decision = collectDecision(await readLatest(env), now);
  if (!decision.dispatch) return `건너뜀: ${decision.reason}`;
  if (!env.GH_TOKEN) return `깨워야 하지만 GH_TOKEN 없음: ${decision.reason}`;
  const res = await fetch(`https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${env.GH_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lotto-collect-cron',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: env.GH_REF }),
  });
  if (res.status === 204) return `수집 시작: ${decision.reason}`;
  return `수집 시작 실패 HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request);
  },
  scheduled(event: ScheduledEvent, env: Env, ctx: Ctx): void {
    ctx.waitUntil(wake(env, new Date(event.scheduledTime)).then((msg) => console.log(`[${event.cron}] ${msg}`)));
  },
};
