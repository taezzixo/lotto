import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Actions, AppData } from '../App.tsx';
import type { Ticket } from '../types.ts';
import { afterTax } from '../lib/lotto.ts';
import { currentSalesRound, drawReminderIcs, drawTime, remaining, salesClose } from '../lib/schedule.ts';
import { dateKo, won } from '../lib/format.ts';
import { gradeTickets } from '../lib/report.ts';
import { Ball, DrawBalls, MatchBalls } from './Ball.tsx';
import { IconCalendar, IconScan } from './Icons.tsx';

export function Home({ data, tickets, actions }: { data: AppData; tickets: Ticket[]; actions: Actions }) {
  const { latest, draws } = data;
  const nextRound = Math.max(latest.no + 1, currentSalesRound());
  const awaiting = nextRound > latest.no + 1; // 추첨은 끝났는데 데이터 반영 전
  const winners = latest.first.winners;

  const myRecent = useMemo(() => {
    const rounds = [latest.no, nextRound - 1, nextRound].filter((r, i, a) => a.indexOf(r) === i);
    return tickets.filter((t) => rounds.includes(t.round) && t.source !== 'analysis');
  }, [tickets, latest.no, nextRound]);
  const { graded, pending } = useMemo(() => gradeTickets(myRecent, data.byNo), [myRecent, data.byNo]);
  const bestRank = graded.reduce<number | null>((b, g) => (g.result.rank && (!b || g.result.rank < b) ? g.result.rank : b), null);

  return (
    <div className="view">
      <section className="stage" aria-labelledby="latest-title">
        <div className="stage-title">
          <h1 id="latest-title">
            제<span className="num">{latest.no}</span>회 당첨번호
          </h1>
          <span className="muted">{dateKo(latest.date)} 추첨</span>
          {latest.status !== 'COMPLETE' && <span className="badge pending">{latest.status === 'PARTIAL' ? '1등 집계 중' : '잠정 결과'}</span>}
        </div>
        <div className="balls" aria-label={`당첨번호 ${latest.nums.join(', ')}, 보너스 ${latest.bonus}`}>
          {latest.nums.map((n, i) => (
            <Ball key={n} n={n} className="drop" style={{ '--i': i } as CSSProperties} />
          ))}
          <span className="plus" aria-hidden="true">
            +
          </span>
          <Ball n={latest.bonus} className="drop" style={{ '--i': 6 } as CSSProperties} label={`보너스 ${latest.bonus}번`} />
        </div>
        {winners > 0 ? (
          <p className="prize-line">
            1등 {winners}명이 <strong>{won(latest.first.prize)}</strong>씩 받았어요
          </p>
        ) : (
          <p className="prize-line">1등이 나오지 않아 당첨금이 다음 회차로 넘어갔어요</p>
        )}
        <div className="facts">
          {winners > 0 && (
            <span>
              세금 뗀 실수령액 <b>약 {won(afterTax(latest.first.prize))}</b>
            </span>
          )}
          {latest.firstType && winners > 0 && (
            <span>
              1등 중 자동 <b>{latest.firstType.auto}명</b>, 수동 <b>{latest.firstType.manual}명</b>
              {latest.firstType.semi ? (
                <>
                  , 반자동 <b>{latest.firstType.semi}명</b>
                </>
              ) : null}
            </span>
          )}
          <span>
            판매액 <b>{won(latest.sales)}</b>
          </span>
        </div>
      </section>

      <div className="grid-2">
        <section className="sheet" aria-labelledby="next-title">
          <div className="sheet-head">
            <h2 id="next-title">다음 추첨까지</h2>
            <span className="badge">제{nextRound}회</span>
          </div>
          <Countdown round={nextRound} />
          <p className="notice">
            {awaiting
              ? '추첨이 끝났어요. 결과가 반영되면 저장한 복권을 자동으로 채점해요.'
              : `토요일 오후 8시에 판매가 마감되고 8시 35분에 추첨해요.`}
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn ghost" onClick={() => downloadIcs(nextRound)}>
              <IconCalendar />
              캘린더에 결과 알림 추가
            </button>
          </div>
        </section>

        <section className="sheet" aria-labelledby="mine-title">
          <div className="sheet-head">
            <h2 id="mine-title">이번 주 내 복권</h2>
            {graded.length + pending.length > 0 && <span className="badge">{graded.length + pending.length}게임</span>}
          </div>
          {myRecent.length === 0 ? (
            <div className="empty">
              <p>복권을 샀다면 QR을 찍어 두세요. 추첨이 끝나면 앱을 열 때 자동으로 채점해요.</p>
            </div>
          ) : (
            <ul className="mini-list">
              {[...graded.map((g) => ({ key: g.ticket.id + g.game.slot, round: g.ticket.round, slot: g.game.slot, nums: g.game.nums, draw: g.draw, rank: g.result.rank, matched: g.result.matched })),
                ...pending.map((p) => ({ key: p.ticket.id + p.game.slot, round: p.ticket.round, slot: p.game.slot, nums: p.game.nums, draw: undefined, rank: null, matched: null }))]
                .slice(0, 6)
                .map((r) => (
                  <li key={r.key}>
                    <span className="row-meta">
                      <b>
                        제{r.round}회 {r.slot}
                      </b>
                      <span>{r.draw ? (r.rank ? `${r.rank}등` : `${r.matched}개 일치`) : '추첨 대기'}</span>
                    </span>
                    <MatchBalls nums={r.nums} draw={r.draw} />
                  </li>
                ))}
            </ul>
          )}
          {bestRank && <p className="celebrate">이번 주 최고 {bestRank}등! 당첨금은 동행복권에서 꼭 확인하세요.</p>}
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn big" onClick={() => actions.go('scan')}>
              <IconScan />
              QR 찍고 바로 채점
            </button>
          </div>
        </section>
      </div>

      <section className="sheet" aria-labelledby="recent-title">
        <div className="sheet-head">
          <h2 id="recent-title">최근 회차</h2>
          <button type="button" className="link-btn" onClick={() => actions.go('stats')}>
            통계 보기
          </button>
        </div>
        <ul className="mini-list">
          {draws
            .slice(-6, -1)
            .reverse()
            .map((d) => (
              <li key={d.no}>
                <span className="row-meta">
                  <b>제{d.no}회</b>
                  <span>
                    {Number(d.date.slice(5, 7))}월 {Number(d.date.slice(8))}일, 1등 {d.first.winners}명
                  </span>
                </span>
                <DrawBalls nums={d.nums} bonus={d.bonus} size={28} />
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

function Countdown({ round }: { round: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const close = salesClose(round);
  const draw = drawTime(round);
  const target = now < close ? close : draw;
  const r = remaining(target, now);
  const label = now < close ? '판매 마감까지' : r.ms > 0 ? '추첨까지' : '추첨 완료, 결과 집계 중';
  const when = draw.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <div>
      <div className="countdown" role="timer" aria-label={`${label} ${r.days}일 ${r.hours}시간 ${r.minutes}분`}>
        <span className="unit">
          <b>{r.days}</b>
          <span>일</span>
        </span>
        <span className="unit">
          <b>{String(r.hours).padStart(2, '0')}</b>
          <span>시간</span>
        </span>
        <span className="unit">
          <b>{String(r.minutes).padStart(2, '0')}</b>
          <span>분</span>
        </span>
        <span className="unit">
          <b>{String(r.seconds).padStart(2, '0')}</b>
          <span>초</span>
        </span>
      </div>
      <p className="muted" style={{ fontSize: 'var(--step--1)' }}>
        {label}. 추첨은 {when}
      </p>
    </div>
  );
}

function downloadIcs(round: number) {
  const blob = new Blob([drawReminderIcs(round)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lotto-${round}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
