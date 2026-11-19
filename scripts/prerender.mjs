#!/usr/bin/env node
/**
 * 회차별 정적 페이지(검색엔진용) 생성 — `vite build` 직후 실행.
 *   dist/r/<회차>/index.html   회차 당첨번호·1등 정보 + 앱으로 가는 링크
 *   dist/r/index.html          전체 회차 목록
 *   dist/robots.txt, dist/sitemap.xml (SITE_URL이 있을 때만 사이트맵)
 * 자바스크립트 없이 읽히는 HTML만 만든다. 색·글꼴은 앱 토큰(styles.css)과 같은 값.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const NAME = '로또 데이터 실험실';
const draws = JSON.parse(readFileSync(join(ROOT, 'public/data/draws.json'), 'utf8'));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const group = (n) => Math.min(5, Math.ceil(n / 10));
function won(a) {
  if (a < 10000) return `${a.toLocaleString('ko-KR')}원`;
  const eok = Math.floor(a / 1e8);
  const man = Math.floor((a % 1e8) / 1e4);
  return [eok && `${eok.toLocaleString('ko-KR')}억`, man && `${man.toLocaleString('ko-KR')}만`].filter(Boolean).join(' ') + ' 원';
}
function afterTax(p) {
  if (p <= 2_000_000) return p;
  const t = p - 1000;
  return Math.round(p - Math.min(t, 3e8) * 0.22 - Math.max(0, t - 3e8) * 0.33);
}
const dateKo = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
};
const ball = (n, extra = '') => `<span class="ball g${group(n)}${extra}">${n}</span>`;

const CSS = `
:root{--bg:#f3eada;--surface:#f9f3e8;--surface-2:#e9dcc7;--line:#bcab96;--ink:#261a12;--ink-2:#3a2d24;--muted:#62554a;--accent:#2942ab;--accent-ink:#f5eee0;
--b1:#e8b512;--b1i:#2a1d00;--b2:#2f6fd0;--b3:#d6423f;--b4:#7f8291;--b5:#2c9a5c;--r:2px;--top:var(--ink);color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0b1426;--surface:#111d35;--surface-2:#16264a;--line:#24365e;--ink:#e8eefc;--ink-2:#c6d2ee;--muted:#8ea0c8;--accent:#4cc9f0;--accent-ink:#06121f;--b4:#8d909e;--r:12px;--top:var(--line);color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 'Pretendard Variable',Pretendard,-apple-system,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all}
.wrap{max-width:760px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-right)) 48px max(16px,env(safe-area-inset-left))}
a{color:var(--accent);text-underline-offset:3px}header{padding-bottom:8px;border-bottom:1px solid var(--ink)}header a{color:var(--ink);font-weight:700;font-size:1.1rem;text-decoration:none}
.sheet{background:var(--surface);border:1px solid var(--line);border-top:1px solid var(--top);border-radius:var(--r);padding:20px;margin-top:16px}
.sheet.lead{background:var(--surface-2)}
h1{margin:0;font-size:1.9rem;line-height:1.2;font-weight:800;letter-spacing:-.03em}h2{margin:0 0 8px;font-size:1.15rem;font-weight:700;letter-spacing:-.02em}
.muted{color:var(--muted)}.balls{display:flex;flex-wrap:wrap;gap:clamp(4px,1.4vw,8px);align-items:center;margin:16px 0}
.ball{display:inline-grid;place-items:center;width:clamp(32px,9.4vw,46px);height:clamp(32px,9.4vw,46px);border-radius:50%;font-weight:700;font-size:clamp(13px,4vw,19px);color:#fff;
background:var(--b);box-shadow:inset 0 0 0 2px rgba(255,255,255,.28)}
.g1{--b:var(--b1);color:var(--b1i)}.g2{--b:var(--b2)}.g3{--b:var(--b3)}.g4{--b:var(--b4)}.g5{--b:var(--b5)}
.sm .ball{width:28px;height:28px;font-size:12px}.sm{margin:0;gap:4px}
dl{display:grid;grid-template-columns:auto 1fr;gap:0 16px;margin:0}dt,dd{padding:7px 0;border-bottom:1px solid var(--line)}dt{color:var(--muted)}dd{margin:0;font-weight:600}
.cta{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:2px;background:var(--accent);color:var(--accent-ink);font-weight:500;text-decoration:none;margin-right:12px;margin-top:8px}
.nav{display:flex;justify-content:space-between;gap:12px;margin-top:16px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}thead th{border-bottom:1px solid var(--ink)}td,th{padding:8px 4px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
.tw{overflow-x:auto}footer{margin-top:28px;padding-top:12px;border-top:1px solid var(--ink);font-size:.8rem;color:var(--muted)}`;

function page({ title, desc, path, body }) {
  const canonical = SITE_URL ? `<link rel="canonical" href="${SITE_URL}${path}">\n<meta property="og:url" content="${SITE_URL}${path}">` : '';
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:site_name" content="${NAME}">
${canonical}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${CSS}</style>
</head>
<body><div class="wrap">
<header><a href="/">${NAME}</a></header>
${body}
<footer>로또 추첨은 매번 독립적이며 1등 확률은 언제나 8,145,060분의 1입니다. 동행복권과 관계없는 비공식 서비스이며, 당첨 여부와 당첨금은 <a href="https://www.dhlottery.co.kr/">동행복권</a>에서 꼭 확인하세요. 만 19세 미만은 복권을 살 수 없습니다. 도박 문제 상담 1336.</footer>
</div></body></html>
`;
}

function write(rel, html) {
  const file = join(DIST, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

const byNo = new Map(draws.map((d) => [d.no, d]));
for (const d of draws) {
  const w = d.first.winners;
  const firstText = w > 0 ? `1등 ${w}명, 1인당 ${won(d.first.prize)}` : d.status === 'COMPLETE' ? '1등 없음(이월)' : '1등 집계 중';
  const title = `로또 제${d.no}회 당첨번호 ${d.nums.join(' ')} + ${d.bonus} (${dateKo(d.date)})`;
  const desc = `로또 6/45 제${d.no}회(${dateKo(d.date)} 추첨) 당첨번호 ${d.nums.join(', ')}, 보너스 ${d.bonus}. ${firstText}.`;
  const facts = [
    ['추첨일', `${dateKo(d.date)} 토요일`],
    ['1등', w > 0 ? `${w}명` : firstText],
    ...(w > 0 ? [['1인당 당첨금', won(d.first.prize)], ['세금 뗀 실수령액(추정)', `약 ${won(afterTax(d.first.prize))}`]] : []),
    ...(d.firstType && w > 0 ? [['1등 구매 방식', `자동 ${d.firstType.auto}명, 수동 ${d.firstType.manual}명${d.firstType.semi ? `, 반자동 ${d.firstType.semi}명` : ''}`]] : []),
    ...(d.sales ? [['총 판매액', won(d.sales)]] : []),
    ['번호 합계', String(d.nums.reduce((a, b) => a + b, 0))],
    ['홀수 개수', `${d.nums.filter((n) => n % 2).length}개`],
  ];
  const prev = byNo.get(d.no - 1);
  const next = byNo.get(d.no + 1);
  const body = `
<section class="sheet lead">
<h1>제${d.no}회 당첨번호</h1>
<p class="muted">${dateKo(d.date)} 추첨</p>
<div class="balls" aria-label="당첨번호 ${d.nums.join(', ')}, 보너스 ${d.bonus}">${d.nums.map((n) => ball(n)).join('')}<span aria-hidden="true">+</span>${ball(d.bonus)}</div>
<dl>${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
</section>
<section class="sheet">
<h2>이 회차 복권을 샀다면</h2>
<p>복권의 QR을 찍으면 바로 채점하고 기록을 남겨 드려요.</p>
<a class="cta" href="/?tab=scan">QR 찍고 채점하기</a><a href="/?tab=stats">번호 통계 보기</a>
</section>
<nav class="nav">${prev ? `<a href="/r/${prev.no}/">제${prev.no}회</a>` : '<span></span>'}<a href="/r/">전체 회차</a>${next ? `<a href="/r/${next.no}/">제${next.no}회</a>` : '<span></span>'}</nav>`;
  write(`r/${d.no}/index.html`, page({ title: `${title} | ${NAME}`, desc, path: `/r/${d.no}/`, body }));
}

const latest = draws[draws.length - 1];
const rows = [...draws]
  .reverse()
  .map((d) => `<tr><td><a href="/r/${d.no}/">제${d.no}회</a></td><td>${d.date}</td><td><span class="balls sm">${d.nums.map((n) => ball(n)).join('')}<span>+</span>${ball(d.bonus)}</span></td><td>${d.first.winners}명</td></tr>`)
  .join('\n');
write(
  'r/index.html',
  page({
    title: `로또 전체 회차 당첨번호 (제1회~제${latest.no}회) | ${NAME}`,
    desc: `로또 6/45 제1회(2002년)부터 제${latest.no}회까지 모든 당첨번호와 1등 당첨자 수.`,
    path: '/r/',
    body: `<section class="sheet lead"><h1>전체 회차 당첨번호</h1><p class="muted">제1회~제${latest.no}회, 최신 회차가 위에 있어요.</p>
<div class="tw"><table><thead><tr><th>회차</th><th>추첨일</th><th>당첨번호</th><th>1등</th></tr></thead><tbody>
${rows}
</tbody></table></div></section>`,
  }),
);

write('robots.txt', `User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ''}`);
if (SITE_URL) {
  const urls = ['/', '/r/', ...draws.map((d) => `/r/${d.no}/`)];
  write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `<url><loc>${SITE_URL}${u}</loc></url>`)
      .join('\n')}\n</urlset>\n`,
  );
}
console.log(`prerender: 회차 페이지 ${draws.length}개 + 목록${SITE_URL ? ' + sitemap' : ' (SITE_URL 없음 → sitemap 생략)'}`);
