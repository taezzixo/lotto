import { useEffect, useRef } from 'react';
import type { Actions, AppData } from '../App.tsx';
import type { Ticket } from '../types.ts';
import { MATCH_PROB, RANK_ODDS, afterTax, grade } from '../lib/lotto.ts';
import { drawTime } from '../lib/schedule.ts';
import { GAME_TYPE_LABEL, oneIn, pct, won } from '../lib/format.ts';
import { DrawBalls, MatchBalls } from './Ball.tsx';
import { IconClose } from './Icons.tsx';

function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return ref;
}

/** 스캔·입력 직후 결과 시트 */
export function ResultSheet({ ticket, duplicate, data, onClose, actions }: { ticket: Ticket; duplicate: boolean; data: AppData; onClose: () => void; actions: Actions }) {
  const ref = useDialog(onClose);
  const draw = data.byNo.get(ticket.round);
  const results = draw ? ticket.games.map((g) => ({ g, r: grade(g.nums, draw) })) : [];
  const best = results.reduce<number | null>((b, x) => (x.r.rank && (!b || x.r.rank < b) ? x.r.rank : b), null);
  const maxMatched = results.reduce((m, x) => Math.max(m, x.r.matched), 0);
  const when = drawTime(ticket.round).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const drawn = Date.now() >= drawTime(ticket.round).getTime();

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="result" role="dialog" aria-modal="true" aria-labelledby="result-title" tabIndex={-1} ref={ref}>
        <div className="result-head">
          <div>
            <h2 id="result-title">제{ticket.round}회 {draw ? '채점 결과' : '추첨 대기'}</h2>
            <p>{duplicate ? '이미 저장한 복권이에요. 저장된 결과를 보여 드려요.' : draw ? `${ticket.games.length}게임을 채점하고 저장했어요.` : `${when} 추첨 뒤 자동으로 채점해요.`}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconClose />
          </button>
        </div>

        {draw && (
          <div style={{ marginTop: 12 }}>
            <p className="notice">당첨번호</p>
            <DrawBalls nums={draw.nums} bonus={draw.bonus} size={30} />
          </div>
        )}
        {!draw && drawn && <p className="verdict" style={{ marginTop: 12 }}>추첨은 끝났고 결과를 집계하고 있어요. 반영되면 앱을 열 때 자동으로 채점해요.</p>}

        <ul className="game-rows">
          {ticket.games.map((g) => {
            const r = draw ? grade(g.nums, draw) : null;
            return (
              <li key={g.slot}>
                <span className="slot">{g.slot}</span>
                <MatchBalls nums={g.nums} draw={draw} />
                <span className="meta">
                  <span>{GAME_TYPE_LABEL[g.type]}</span>
                  {r && (r.rank ? <span className="badge win">{r.rank}등 당첨</span> : <span>{r.matched}개 일치</span>)}
                  {r?.bonusHit && !r.rank && <span>보너스 일치</span>}
                </span>
              </li>
            );
          })}
        </ul>

        {draw && best && (
          <p className="celebrate">
            {best}등 당첨이에요!{' '}
            {best === 1
              ? `1인당 ${won(draw.first.prize)}, 세금 뗀 실수령액 약 ${won(afterTax(draw.first.prize))}.`
              : best >= 4
                ? `당첨금 ${best === 4 ? '5만 원' : '5천 원'}이에요.`
                : '당첨금은 동행복권에서 확인하세요.'}{' '}
            {oneIn(1 / RANK_ODDS[best as 1 | 2 | 3 | 4 | 5])}꼴로 나오는 결과예요.
          </p>
        )}
        {draw && !best && (
          <p className="verdict">
            가장 많이 맞힌 게임이 {maxMatched}개 일치예요. 한 게임에서 {maxMatched}개가 맞을 확률은 {pct(MATCH_PROB[maxMatched])}예요.
          </p>
        )}

        <div className="actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onClose();
              actions.go('records');
            }}
          >
            내 기록 보기
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            다른 복권 찍기
          </button>
        </div>
        {draw && <p className="notice" style={{ marginTop: 12 }}>당첨 여부는 동행복권 또는 판매점에서 꼭 다시 확인하세요.</p>}
      </div>
    </div>
  );
}

/** 추첨 뒤 처음 열었을 때: 새로 채점된 회차 요약 */
export function RoundResults({ rounds, tickets, data, onClose, actions }: { rounds: number[]; tickets: Ticket[]; data: AppData; onClose: () => void; actions: Actions }) {
  const ref = useDialog(onClose);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="result" role="dialog" aria-modal="true" aria-labelledby="rr-title" tabIndex={-1} ref={ref}>
        <div className="result-head">
          <h2 id="rr-title">추첨 결과가 나왔어요</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconClose />
          </button>
        </div>
        {rounds.map((round) => {
          const draw = data.byNo.get(round)!;
          const games = tickets.filter((t) => t.round === round).flatMap((t) => t.games);
          const rs = games.map((g) => grade(g.nums, draw));
          const wins = rs.filter((r) => r.rank).length;
          const best = rs.reduce((m, r) => Math.max(m, r.matched), 0);
          return (
            <div key={round} style={{ marginTop: 14 }}>
              <p>
                <b>제{round}회</b> {games.length}게임 중 {wins ? <span className="badge win">{wins}게임 당첨</span> : `최고 ${best}개 일치`}
              </p>
              <DrawBalls nums={draw.nums} bonus={draw.bonus} size={28} />
            </div>
          );
        })}
        <div className="actions" style={{ marginTop: 18 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onClose();
              actions.go('records');
            }}
          >
            자세히 보기
          </button>
        </div>
      </div>
    </div>
  );
}
