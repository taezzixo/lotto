import { useMemo, useRef, useState } from 'react';
import type { Actions, AppData } from '../App.tsx';
import type { Ticket } from '../types.ts';
import { gradeTickets, hitReport } from '../lib/report.ts';
import { MATCH_PROB } from '../lib/lotto.ts';
import { exportFile, mergeImport } from '../lib/store.ts';
import { GAME_TYPE_LABEL, pct, won } from '../lib/format.ts';
import { STRATEGIES } from '../lib/strategy.ts';
import { Ball, MatchBalls } from './Ball.tsx';
import { BarChart, Legend } from './Charts.tsx';
import { IconDownload, IconScan, IconTrash, IconUpload } from './Icons.tsx';
import { computeBadges } from '../lib/badges.ts';
import { BadgeShelf } from './Badges.tsx';
import { ShareCard } from './ShareCard.tsx';

const BACKUP_KEY = 'lotto-lab:backed-up-at';
function readBackedUp(): boolean {
  try {
    return !!localStorage.getItem(BACKUP_KEY);
  } catch {
    return false;
  }
}

export function Records({ data, tickets, actions }: { data: AppData; tickets: Ticket[]; actions: Actions }) {
  const [withPicks, setWithPicks] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [backedUp, setBackedUp] = useState(readBackedUp);
  const fileRef = useRef<HTMLInputElement>(null);
  const scope = useMemo(() => tickets.filter((t) => withPicks || t.source !== 'analysis'), [tickets, withPicks]);
  const { graded } = useMemo(() => gradeTickets(scope, data.byNo), [scope, data.byNo]);
  const rep = useMemo(() => hitReport(graded), [graded]);
  const rounds = useMemo(() => [...new Set(tickets.map((t) => t.round))].sort((a, b) => b - a), [tickets]);
  const allGraded = useMemo(() => gradeTickets(tickets, data.byNo).graded, [tickets, data.byNo]);
  const badges = useMemo(() => computeBadges(tickets, allGraded, { backedUp }), [tickets, allGraded, backedUp]);

  const doExport = () => {
    const blob = new Blob([exportFile(tickets)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lotto-lab-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    try {
      localStorage.setItem(BACKUP_KEY, new Date().toISOString());
    } catch {
      /* 저장 불가 환경 */
    }
    setBackedUp(true);
    actions.toast('기록 파일을 내려받았어요');
  };
  const doImport = async (f: File) => {
    try {
      const r = mergeImport(tickets, await f.text());
      actions.replaceAll(r.tickets);
      actions.toast(`복권 ${r.added}장을 가져왔어요${r.skipped ? ` (${r.skipped}장은 이미 있거나 형식이 달라 건너뜀)` : ''}`);
    } catch (e) {
      actions.toast((e as Error).message);
    }
  };

  return (
    <div className="view">
      <header className="view-head">
        <h2>나의 적중률</h2>
        <p>저장한 복권은 이 기기에만 남아요. 기기를 바꾸기 전에 기록 파일을 내려받아 두세요.</p>
      </header>

      {tickets.length === 0 ? (
        <section className="sheet empty">
          <h3>아직 저장한 복권이 없어요</h3>
          <p>복권 QR을 찍으면 채점 결과가 여기 쌓이고, 내 운이 무작위로 산 사람들과 비교해 어느 정도인지 알려 드려요.</p>
          <button type="button" className="btn" onClick={() => actions.go('scan')}>
            <IconScan />
            첫 복권 찍기
          </button>
        </section>
      ) : (
        <>
          <div className="filters">
            <label className="switch">
              <input type="checkbox" checked={withPicks} onChange={(e) => setWithPicks(e.target.checked)} />
              적중 기록에서 담은 분석 번호도 포함
            </label>
          </div>

          {rep.games === 0 ? (
            <section className="sheet empty">
              <h3>추첨을 기다리는 중이에요</h3>
              <p>저장한 복권의 추첨이 끝나면 앱을 열 때 자동으로 채점하고 적중률을 보여 드려요.</p>
            </section>
          ) : (
            <div className="grid-2">
              <section className="sheet luck" aria-labelledby="luck-title">
                <h3 id="luck-title">운 지수</h3>
                <span className="big num">{rep.luckIndex}</span>
                <p>
                  100이면 딱 평균이에요. 채점한 {rep.games}게임에서 평균 {rep.avgMatched.toFixed(2)}개를 맞혀{' '}
                  {rep.luckTop <= 0.5 ? (
                    <>
                      같은 수만큼 무작위로 산 사람 중 <b>상위 {Math.max(1, Math.round(rep.luckTop * 100))}%</b>예요.
                    </>
                  ) : (
                    <>평균보다 조금 덜 맞았어요. 다음 주 확률은 누구나 같아요.</>
                  )}
                </p>
                {rep.games < 10 && <p className="notice">10게임이 넘으면 비교가 더 정확해져요.</p>}
                <div>
                  <button type="button" className="btn ghost" onClick={() => setSharing(true)}>
                    공유 카드 만들기
                  </button>
                </div>
              </section>

              <section className="sheet" aria-labelledby="hit-title">
                <div className="sheet-head">
                  <h3 id="hit-title">숫자로 본 내 기록</h3>
                </div>
                <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div className="stat">
                    <span>번호 적중률</span>
                    <b>{pct(rep.hitRate)}</b>
                    <small>무작위 13.3%</small>
                  </div>
                  <div className="stat">
                    <span>5등 이상 당첨</span>
                    <b>{pct(rep.winRate)}</b>
                    <small>무작위 2.4%</small>
                  </div>
                  <div className="stat">
                    <span>산 금액</span>
                    <b>{won(rep.cost)}</b>
                    <small>{rep.games}게임</small>
                  </div>
                  <div className="stat">
                    <span>확인된 당첨금</span>
                    <b>{won(rep.knownPrize)}</b>
                    <small>{rep.unknownPrizeWins ? `2·3등 ${rep.unknownPrizeWins}건은 동행복권에서 확인` : '4·5등 고정액, 1등 실제 금액'}</small>
                  </div>
                </div>
              </section>

              <section className="sheet" aria-labelledby="dist-title">
                <div className="sheet-head">
                  <h3 id="dist-title">몇 개씩 맞혔나</h3>
                </div>
                <BarChart
                  ariaLabel="일치 개수별 내 게임 비율과 무작위 이론 비율"
                  height={190}
                  data={rep.dist.map((c, k) => ({
                    key: k,
                    label: `${k}개`,
                    value: c / rep.games,
                    marker: MATCH_PROB[k],
                    tip: `${k}개 일치: 내 게임 ${c}개 (${pct(c / rep.games)}), 무작위 이론 ${pct(MATCH_PROB[k], 2)}`,
                  }))}
                  format={(v) => pct(v, 0)}
                />
                <Legend
                  items={[
                    { label: '내 게임', color: 'var(--series-1)' },
                    { label: '무작위 이론', color: 'var(--series-2)', line: true },
                  ]}
                />
              </section>

              <section className="sheet" aria-labelledby="extra-title">
                <div className="sheet-head">
                  <h3 id="extra-title">등수와 행운 번호</h3>
                </div>
                <div className="stats" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {([1, 2, 3, 4, 5] as const).map((r) => (
                    <div className="stat" key={r}>
                      <span>{r}등</span>
                      <b style={{ fontSize: 'var(--step-2)' }}>{rep.ranks[r]}</b>
                    </div>
                  ))}
                </div>
                {rep.luckyNumbers.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p className="notice">가장 많이 맞힌 내 번호</p>
                    <ol className="rank-list" style={{ marginTop: 6 }}>
                      {rep.luckyNumbers.map((l) => (
                        <li key={l.n}>
                          <Ball n={l.n} />
                          <span>
                            <b className="num">{l.hits}번</b> 맞힘 <span className="muted">({l.picked}번 고름)</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {Object.keys(rep.byType).length > 1 && (
                  <div style={{ marginTop: 14 }}>
                    <p className="notice">구매 방식별 평균 일치</p>
                    <ul className="mini-list" style={{ marginTop: 6 }}>
                      {Object.entries(rep.byType).map(([k, v]) => (
                        <li key={k}>
                          <span>{GAME_TYPE_LABEL[k as keyof typeof GAME_TYPE_LABEL]}</span>
                          <span className="num">
                            {v!.avg.toFixed(2)}개 <span className="muted">({v!.games}게임)</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}

          <BadgeShelf badges={badges} />

          <section className="sheet" aria-labelledby="list-title">
            <div className="sheet-head">
              <h3 id="list-title">저장한 복권</h3>
              <p>{tickets.length}장</p>
            </div>
            <div style={{ display: 'grid', gap: 18 }}>
              {rounds.map((round) => {
                const draw = data.byNo.get(round);
                const ts = tickets.filter((t) => t.round === round);
                return (
                  <div className="round-group" key={round}>
                    <div className="round-head">
                      <h3>제{round}회</h3>
                      {draw ? (
                        <span className={`badge${draw.status === 'COMPLETE' ? '' : ' pending'}`}>{draw.status === 'PROVISIONAL' ? '잠정 채점' : '채점 완료'}</span>
                      ) : (
                        <span className="badge pending">추첨 대기</span>
                      )}
                    </div>
                    {ts.map((t) => (
                      <div className="ticket" key={t.id}>
                        <div className="ticket-head">
                          <span>{t.source === 'qr' ? 'QR로 저장' : t.source === 'manual' ? '직접 입력' : `분석 번호 (${STRATEGIES.find((s) => s.id === t.games[0].strategy)?.name ?? ''})`}</span>
                          <button type="button" className="icon-btn" aria-label={`제${round}회 복권 지우기`} onClick={() => actions.remove(t.id)}>
                            <IconTrash />
                          </button>
                        </div>
                        <ul className="game-rows" style={{ margin: 0 }}>
                          {t.games.map((g) => {
                            const r = draw ? gradeOf(g.nums, draw) : null;
                            return (
                              <li key={g.slot}>
                                <span className="slot">{g.slot}</span>
                                <MatchBalls nums={g.nums} draw={draw} />
                                <span className="meta">
                                  <span>{GAME_TYPE_LABEL[g.type]}</span>
                                  {r && (r.rank ? <span className="badge win">{r.rank}등</span> : <span>{r.matched}개 일치</span>)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <section className="sheet" aria-labelledby="backup-title">
        <div className="sheet-head">
          <h3 id="backup-title">기록 백업</h3>
        </div>
        <p className="notice">아이폰 사파리는 오래 열지 않은 사이트의 저장 기록을 지울 수 있어요. 홈 화면에 추가하거나 가끔 파일로 내려받아 두세요.</p>
        <div className="actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={doExport} disabled={!tickets.length}>
            <IconDownload />
            기록 파일 내려받기
          </button>
          <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
            <IconUpload />
            기록 파일 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>
      {sharing && <ShareCard rep={rep} onClose={() => setSharing(false)} onToast={actions.toast} />}
    </div>
  );
}

function gradeOf(nums: number[], draw: { nums: number[]; bonus: number }) {
  const matched = nums.filter((n) => draw.nums.includes(n)).length;
  const bonusHit = nums.includes(draw.bonus);
  const rank = matched === 6 ? 1 : matched === 5 && bonusHit ? 2 : matched === 5 ? 3 : matched === 4 ? 4 : matched === 3 ? 5 : null;
  return { matched, rank };
}
