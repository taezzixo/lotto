import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Draw, Ticket } from '../types.ts';
import { MATCH_PROB, WIN_PROB, afterTax, ballGroup, grade, popularityIndex } from './lotto.ts';
import { QrError, parseLottoQr, ticketKey } from './qr.ts';
import { drawTime, lastDrawnRound, salesClose } from './schedule.ts';
import { bandShare, firstPrizeSummary, frequency, gaps, inPeriod, popularityByBirthdayCount, ranked } from './stats.ts';
import { gradeTickets, hitReport, luckPercentile } from './report.ts';
import { STRATEGIES, backtest, pickFor, randomPick, summarize } from './strategy.ts';
import { addTicket, exportFile, mergeImport } from './store.ts';
import { dateKo, won } from './format.ts';
import { collectDecision } from './collect.ts';

const draws: Draw[] = JSON.parse(readFileSync(new URL('../../public/data/draws.json', import.meta.url), 'utf8'));
const byNo = new Map(draws.map((d) => [d.no, d]));
const SAMPLE_QR = 'http://m.dhlottery.co.kr/?v=0936m041720353943q071215303244m071113171829q010222253142m0414182731421050908394';

test('확률표 합계와 5등 이상 확률', () => {
  assert.ok(Math.abs(MATCH_PROB.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(WIN_PROB - 0.023834) < 1e-6);
});

test('공 색 묶음', () => {
  assert.deepEqual([1, 10, 11, 20, 21, 30, 31, 40, 41, 45].map(ballGroup), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('등수 판정', () => {
  const d = { nums: [1, 5, 18, 23, 27, 28], bonus: 8 };
  assert.deepEqual(grade([1, 5, 18, 23, 27, 28], d), { matched: 6, bonusHit: false, rank: 1 });
  assert.equal(grade([1, 5, 18, 23, 27, 8], d).rank, 2);
  assert.equal(grade([1, 5, 18, 23, 27, 9], d).rank, 3);
  assert.equal(grade([1, 5, 18, 23, 40, 41], d).rank, 4);
  assert.equal(grade([1, 5, 18, 40, 41, 42], d).rank, 5);
  assert.equal(grade([1, 5, 40, 41, 42, 43], d).rank, null);
});

test('세후 실수령액', () => {
  assert.equal(afterTax(50_000), 50_000);
  assert.equal(afterTax(2_000_000), 2_000_000);
  // 31억 316만: 3억까지 22%, 초과분 33%
  const prize = 3_103_164_459;
  const taxable = prize - 1000;
  assert.equal(afterTax(prize), Math.round(prize - 300_000_000 * 0.22 - (taxable - 300_000_000) * 0.33));
});

test('QR 해석: 5게임, 유형, 슬롯', () => {
  const r = parseLottoQr(SAMPLE_QR);
  assert.equal(r.round, 936);
  assert.deepEqual(r.games.map((g) => g.type), ['manual', 'auto', 'manual', 'auto', 'manual']);
  assert.deepEqual(r.games[4].nums, [4, 14, 18, 27, 31, 42]);
  const skip = parseLottoQr('http://m.dhlottery.co.kr/?v=1100m010203040506n000000000000q0708091011121234567890');
  assert.deepEqual(skip.games.map((g) => g.slot), ['A', 'C']);
  assert.equal(parseLottoQr('1250q010518232728').games[0].nums.join(), '1,5,18,23,27,28');
});

test('QR 오류 코드', () => {
  const code = (s: string) => {
    try {
      parseLottoQr(s);
      return 'OK';
    } catch (e) {
      return (e as QrError).code;
    }
  };
  assert.equal(code('https://example.com/?v=1250q010518232728'), 'NOT_LOTTO');
  assert.equal(code('hello'), 'BAD_FORMAT');
  assert.equal(code('http://m.dhlottery.co.kr/?v=1250q010518232746'), 'BAD_NUMBERS');
  assert.equal(code('http://m.dhlottery.co.kr/?v=1250n000000000000'), 'NO_GAMES');
});

test('QR 해시는 원문과 다르고 안정적', async () => {
  const a = await ticketKey('0936m041720353943');
  assert.equal(a, await ticketKey('0936m041720353943'));
  assert.ok(!a.includes('0936'));
});

test('추첨 일정: 1회·1000회·1250회 날짜', () => {
  const kst = (d: Date) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16);
  assert.equal(kst(drawTime(1)), '2002-12-07T20:35');
  assert.equal(kst(drawTime(1000)), '2022-01-29T20:35');
  assert.equal(kst(drawTime(1250)), '2026-11-14T20:35');
  assert.equal(kst(salesClose(1251)), '2026-11-21T20:00');
  assert.equal(lastDrawnRound(new Date('2026-11-18T03:00:00Z')), 1250);
  assert.equal(lastDrawnRound(new Date('2026-11-21T11:34:00Z')), 1250);
  assert.equal(lastDrawnRound(new Date('2026-11-21T11:36:00Z')), 1251);
  for (const d of draws) assert.equal(kst(drawTime(d.no)).slice(0, 10), d.date);
});

test('빈도: 외부 통계와 일치 (1~1250회)', () => {
  const upto = draws.filter((d) => d.no <= 1250);
  assert.deepEqual(ranked(frequency(upto, false), 'desc')[0], { n: 34, value: 188 });
  assert.deepEqual(ranked(frequency(upto, true), 'desc')[0], { n: 27, value: 217 });
  assert.equal(frequency(upto, false).reduce((a, b) => a + b, 0), 1250 * 6);
  assert.equal(inPeriod(draws, 15).length, 15);
});

test('미출현: 최신 회차 번호는 0', () => {
  const g = gaps(draws, false);
  for (const n of draws.at(-1)!.nums) assert.equal(g[n], 0);
  assert.ok(g.slice(1).every((x) => x >= 0));
});

test('번호대 비중: 5개 단위 9구간, 합 = 1', () => {
  const s = bandShare(draws, false);
  assert.equal(s.length, 9);
  assert.deepEqual([s[0].label, s[8].label], ['1~5', '41~45']);
  assert.ok(Math.abs(s.reduce((a, b) => a + b.share, 0) - 1) < 1e-9);
  assert.ok(s.every((b) => Math.abs(b.expected - 5 / 45) < 1e-12));
  assert.equal(bandShare(draws, false, 10).length, 5);
});

test('1등 요약: 최다 1128회 63명, 이월 14회', () => {
  const s = firstPrizeSummary(draws);
  assert.equal(s.most.no, 1128);
  assert.equal(s.most.first.winners, 63);
  assert.equal(s.rollovers.length, 14);
  assert.equal(s.typeShare?.from, 262);
  assert.ok(popularityIndex(byNo.get(1128)!)! > 4); // 기대 인원의 4배 이상
});

test('인기도 지수: 생일수 묶음은 0~6 중 존재하는 값만', () => {
  const rows = popularityByBirthdayCount(draws);
  assert.equal(rows.reduce((s, r) => s + r.n, 0), draws.length);
  assert.ok(rows.every((r) => r.birthdayCount >= 0 && r.birthdayCount <= 6 && r.mean > 0));
});

test('운 백분위: 경계값과 정규근사 연속성', () => {
  assert.equal(luckPercentile(0, 10), 1);
  assert.ok(Math.abs(luckPercentile(3, 1) - WIN_PROB) < 1e-12);
  const exact = luckPercentile(420, 500);
  const approx = luckPercentile(421, 501);
  assert.ok(Math.abs(exact - approx) < 0.03);
});

test('내 기록 채점과 리포트', () => {
  const tickets: Ticket[] = [
    { id: 'a', source: 'qr', round: 1250, createdAt: '2026-11-14T10:00:00Z', games: [
      { slot: 'A', type: 'auto', nums: [1, 5, 18, 23, 27, 28] },
      { slot: 'B', type: 'manual', nums: [1, 5, 18, 40, 41, 42] },
    ] },
    { id: 'b', source: 'qr', round: 9999, createdAt: '2026-11-18T10:00:00Z', games: [{ slot: 'A', type: 'auto', nums: [1, 2, 3, 4, 5, 6] }] },
  ];
  const { graded, pending } = gradeTickets(tickets, byNo);
  assert.equal(graded.length, 2);
  assert.equal(pending.length, 1);
  const r = hitReport(graded);
  assert.equal(r.ranks[1], 1);
  assert.equal(r.ranks[5], 1);
  assert.equal(r.knownPrize, byNo.get(1250)!.first.prize + 5000);
  assert.equal(r.cost, 2000);
  assert.equal(r.avgMatched, 4.5);
  assert.equal(r.byType.manual?.wins, 1);
  assert.equal(r.best?.result.rank, 1);
  assert.deepEqual(r.dist, [0, 0, 0, 1, 0, 0, 1]);
});

test('전략: 직전 데이터만 사용(미래 정보 누설 없음)', () => {
  const recs = backtest('hot', draws);
  const r = recs.find((x) => x.round === 1000)!;
  assert.deepEqual(r.picks, pickFor('hot', draws.slice(0, 999), 1000));
  for (const id of ['cold', 'top'] as const) {
    const rr = backtest(id, draws).find((x) => x.round === 777)!;
    assert.deepEqual(rr.picks, pickFor(id, draws.slice(0, 776), 777));
  }
  assert.deepEqual(randomPick(1251), randomPick(1251));
  assert.equal(STRATEGIES.length, 4);
});

test('전략 요약: 주 수와 분포 합 일치, 무작위는 이론값 근처', () => {
  for (const s of STRATEGIES) {
    const sum = summarize(backtest(s.id, draws));
    assert.equal(sum.weeks, draws.length - 20);
    assert.equal(sum.dist.reduce((a, b) => a + b, 0), sum.weeks);
    assert.ok(sum.avg > 0.6 && sum.avg < 1.0, `${s.id} ${sum.avg}`);
  }
});

test('저장소: 중복 방지·가져오기 병합', () => {
  const t: Ticket = { id: 'x', key: 'k1', source: 'qr', round: 1250, createdAt: '2026-11-18T00:00:00Z', games: [{ slot: 'A', type: 'auto', nums: [1, 2, 3, 4, 5, 6] }] };
  const one = addTicket([], t).tickets;
  assert.ok(addTicket(one, { ...t, id: 'y' }).duplicate);
  const bad = { ...t, id: 'z', key: 'k2', games: [{ slot: 'A', type: 'auto', nums: [1, 1, 2, 3, 4, 5] }] };
  const file = JSON.stringify({ app: 'lotto-lab', version: 1, tickets: [t, bad, { ...t, id: 'w', key: 'k3', round: 1249 }] });
  const m = mergeImport(one, file);
  assert.equal(m.added, 1);
  assert.equal(m.skipped, 2);
  assert.equal(JSON.parse(exportFile(m.tickets)).tickets.length, 2);
  assert.throws(() => mergeImport([], 'nope'));
});

test('금액·날짜 표기', () => {
  assert.equal(won(3_103_164_459), '31억 316만 원');
  assert.equal(won(50_000), '5만 원');
  assert.equal(won(5_000), '5,000원');
  assert.equal(dateKo('2026-11-14'), '2026년 11월 14일');
});

test('배지: 조건별 획득', async () => {
  const { computeBadges } = await import('./badges.ts');
  const d = byNo.get(1250)!;
  const mk = (id: string, round: number, nums: number[], type: 'auto' | 'manual' = 'auto', source: Ticket['source'] = 'qr'): Ticket => ({
    id, source, round, createdAt: '2026-11-01T00:00:00Z', games: [{ slot: 'A', type, nums }],
  });
  const tickets = [1247, 1248, 1249, 1250].map((r, i) => mk(`t${i}`, r, [7, 14, 21, 28, 35, 42], 'manual'));
  tickets.push(mk('w', 1250, [1, 5, 18, 23, 27, 40]), mk('b', 1250, [8, 9, 10, 11, 12, 13]), mk('pick', 1250, [1, 5, 18, 23, 27, 28], 'auto', 'analysis'));
  const { graded } = gradeTickets(tickets, byNo);
  const b = Object.fromEntries(computeBadges(tickets, graded, { backedUp: false }).map((x) => [x.id, x]));
  assert.equal(b['first-scan'].earned, true);
  assert.equal(b['streak-4'].earned, true);
  assert.equal(b['same-4'].earned, true);
  assert.equal(b['near-miss'].earned, true); // 5개 일치
  assert.equal(b['near-miss'].round, 1250);
  assert.equal(b['bonus-tease'].earned, true); // 8 = 1250회 보너스
  assert.equal(b['first-win'].earned, true);
  assert.equal(b['club-100'].earned, false);
  assert.equal(b['backup'].earned, false);
  assert.ok(d.bonus === 8);
});

test('추첨 직후 대체 조회: 필요한 회차 판단과 미러 응답 검증', async () => {
  const { missingRound, fromMirror, fetchFallback } = await import('./fallback.ts');
  // 1251회 추첨 2026-11-21 20:35 KST = 11:35Z
  assert.equal(missingRound(1250, new Date('2026-11-21T11:00:00Z')), null); // 추첨 전
  assert.equal(missingRound(1250, new Date('2026-11-21T12:00:00Z')), null); // 추첨 25분 뒤(대기)
  assert.equal(missingRound(1250, new Date('2026-11-21T12:40:00Z')), 1251); // 65분 뒤
  assert.equal(missingRound(1251, new Date('2026-11-21T12:40:00Z')), null); // 이미 반영
  const ok = { draw_no: 1251, numbers: [44, 3, 9, 17, 22, 38], bonus_no: 12, date: '2026-11-21T00:00:00Z', divisions: [{ prize: 2e9, winners: 10 }], total_sales_amount: 1e11, winners_combination: { auto: 7 } };
  const d = fromMirror(ok, 1251)!;
  assert.deepEqual(d.nums, [3, 9, 17, 22, 38, 44]);
  assert.equal(d.status, 'PROVISIONAL');
  assert.deepEqual(d.firstType, { auto: 7, semi: 0, manual: 0 });
  assert.equal(fromMirror({ ...ok, draw_no: 1250 }, 1251), null); // 회차 불일치(미러도 아직 갱신 전)
  assert.equal(fromMirror({ ...ok, date: '2026-11-14' }, 1251), null); // 날짜 불일치
  assert.equal(fromMirror({ ...ok, bonus_no: 3 }, 1251), null); // 보너스 중복
  assert.equal(fromMirror({ ...ok, numbers: [1, 1, 2, 3, 4, 5] }, 1251), null);
  const fake = (async () => ({ ok: true, json: async () => ok })) as unknown as typeof fetch;
  assert.equal((await fetchFallback(1251, fake))?.no, 1251);
  const broken = (async () => { throw new TypeError('CORS'); }) as unknown as typeof fetch;
  assert.equal(await fetchFallback(1251, broken), null);
});

test('출현 순위표: 45개, 공동 순위', async () => {
  const { rankTable } = await import('./stats.ts');
  const t = rankTable(frequency(draws.filter((d) => d.no <= 1250), false));
  assert.equal(t.length, 45);
  assert.deepEqual(t[0], { n: 34, value: 188, rank: 1 });
  // 13·27번 모두 184회 → 둘 다 2위, 다음은 4위
  assert.deepEqual(t.slice(1, 4).map((r) => [r.n, r.rank]), [[13, 2], [27, 2], [18, 4]]);
  assert.ok(t.every((r, i) => i === 0 || r.value <= t[i - 1].value));
});

test('수집 깨우기 판단: 추첨 직후 대기, 미반영·잠정이면 깨움, 확정이면 건너뜀', () => {
  const sat2105 = new Date('2026-11-21T12:05:00Z'); // 토 21:05 KST, 제1251회 추첨 30분 뒤
  const sat2040 = new Date('2026-11-21T11:40:00Z'); // 추첨 5분 뒤
  assert.equal(collectDecision({ no: 1250, status: 'COMPLETE' }, sat2040).dispatch, false);
  const d = collectDecision({ no: 1250, status: 'COMPLETE' }, sat2105);
  assert.equal(d.expected, 1251);
  assert.equal(d.dispatch, true);
  assert.equal(collectDecision({ no: 1251, status: 'PARTIAL' }, sat2105).dispatch, true);
  assert.equal(collectDecision({ no: 1251, status: 'COMPLETE' }, sat2105).dispatch, false);
  assert.equal(collectDecision(null, sat2105).dispatch, true);
  const sun0907 = new Date('2026-11-22T00:07:00Z');
  assert.equal(collectDecision({ no: 1251, status: 'COMPLETE' }, sun0907).dispatch, false);
});
