import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Draw, LatestFile, Ticket } from './types.ts';
import { addTicket, loadTickets, removeTicket, requestPersist, saveTickets } from './lib/store.ts';
import { IconChart, IconHome, IconMoon, IconScan, IconSun, IconTarget, IconTicket, Logo } from './components/Icons.tsx';
import { Home } from './components/Home.tsx';
import { Stats } from './components/Stats.tsx';
import { Scan } from './components/Scan.tsx';
import { Analysis } from './components/Analysis.tsx';
import { Records } from './components/Records.tsx';
import { ResultSheet, RoundResults } from './components/ResultSheet.tsx';

export type Tab = 'home' | 'stats' | 'scan' | 'analysis' | 'records';
const TABS: Tab[] = ['home', 'stats', 'scan', 'analysis', 'records'];
const SEEN_KEY = 'lotto-lab:seen-round';
const THEME_KEY = 'lotto-lab:theme';

export interface AppData {
  draws: Draw[];
  byNo: Map<number, Draw>;
  latest: Draw;
}

export interface Actions {
  go: (tab: Tab) => void;
  save: (t: Ticket) => void;
  remove: (id: string) => void;
  replaceAll: (ts: Ticket[]) => void;
  toast: (text: string, undo?: () => void) => void;
}

function readTab(): Tab {
  const t = new URLSearchParams(location.search).get('tab') as Tab | null;
  return t && TABS.includes(t) ? t : 'home';
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 환경(사생활 보호 모드 등) */
  }
}

async function fetchData(): Promise<AppData> {
  const res = await fetch('./data/draws.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`당첨번호 데이터를 불러오지 못했어요 (HTTP ${res.status}).`);
  const draws: Draw[] = await res.json();
  return { draws, byNo: new Map(draws.map((d) => [d.no, d])), latest: draws[draws.length - 1] };
}

async function fetchLatestNo(): Promise<number | null> {
  try {
    const res = await fetch('./data/latest.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    return ((await res.json()) as LatestFile).latest.no;
  } catch {
    return null;
  }
}

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>(() => loadTickets());
  const [tab, setTab] = useState<Tab>(readTab);
  const [theme, setTheme] = useState<string | null>(() => safeGet(THEME_KEY));
  const [toastState, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [sheet, setSheet] = useState<{ ticket: Ticket; duplicate: boolean } | null>(null);
  const [roundResults, setRoundResults] = useState<number[] | null>(null);
  const toastTimer = useRef<number>(0);

  const load = useCallback(() => {
    fetchData()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // 앱으로 돌아오면 새 회차가 올라왔는지 확인 → 자동 채점
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || !data) return;
      const no = await fetchLatestNo();
      if (no && no > data.latest.no) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [data, load]);

  // 새로 채점된 회차 알림
  useEffect(() => {
    if (!data) return;
    const seen = Number(safeGet(SEEN_KEY) ?? 0);
    const fresh = [...new Set(tickets.filter((t) => t.round > seen && data.byNo.has(t.round) && t.createdAt < drawDateIso(data.byNo.get(t.round)!)).map((t) => t.round))];
    if (fresh.length) setRoundResults(fresh.sort((a, b) => b - a));
    safeSet(SEEN_KEY, String(data.latest.no));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.latest.no]);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  const go = useCallback((t: Tab) => {
    setTab(t);
    const url = new URL(location.href);
    if (t === 'home') url.searchParams.delete('tab');
    else url.searchParams.set('tab', t);
    history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  }, []);

  const toast = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 2600);
  }, []);

  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;

  const commit = useCallback(
    (next: Ticket[]) => {
      ticketsRef.current = next;
      setTickets(next);
      if (!saveTickets(next)) toast('이 브라우저에서는 기록을 저장할 수 없어요. 사생활 보호 모드를 꺼 주세요.');
    },
    [toast],
  );

  const actions: Actions = useMemo(
    () => ({
      go,
      toast,
      save: (t) => {
        const first = ticketsRef.current.length === 0;
        const r = addTicket(ticketsRef.current, t);
        setSheet({ ticket: r.duplicate ?? t, duplicate: !!r.duplicate });
        if (r.duplicate) return;
        commit(r.tickets);
        toast('내 기록에 저장했어요', () => {
          commit(removeTicket(ticketsRef.current, t.id));
          setSheet(null);
          setToast(null);
        });
        if (first) void requestPersist();
      },
      remove: (id) => {
        const removed = ticketsRef.current.find((t) => t.id === id);
        commit(removeTicket(ticketsRef.current, id));
        if (removed)
          toast('기록을 지웠어요', () => {
            commit(addTicket(ticketsRef.current, removed).tickets.sort((a, b) => b.round - a.round));
            setToast(null);
          });
      },
      replaceAll: commit,
    }),
    [go, toast, commit],
  );

  const toggleTheme = () => {
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    safeSet(THEME_KEY, next);
  };
  const isDark = theme ? theme === 'dark' : typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <div className="app">
      <header className="topbar">
        <a className="wordmark" href="./" onClick={(e) => (e.preventDefault(), go('home'))}>
          <Logo />
          로또랩
        </a>
        <button className="icon-btn" type="button" onClick={toggleTheme} aria-label={isDark ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기'}>
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
      </header>

      <main>
        {error && (
          <section className="sheet empty" role="alert">
            <h2>데이터를 불러오지 못했어요</h2>
            <p>{error} 인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>
            <button className="btn" type="button" onClick={() => (setError(null), load())}>
              다시 불러오기
            </button>
          </section>
        )}
        {!data && !error && <p className="muted" style={{ padding: '40px 4px' }}>당첨번호를 불러오는 중이에요…</p>}
        {data && tab === 'home' && <Home data={data} tickets={tickets} actions={actions} />}
        {data && tab === 'stats' && <Stats data={data} />}
        {data && tab === 'scan' && <Scan data={data} actions={actions} />}
        {data && tab === 'analysis' && <Analysis data={data} actions={actions} />}
        {data && tab === 'records' && <Records data={data} tickets={tickets} actions={actions} />}
      </main>

      <footer className="footer">
        <p>
          로또 추첨은 매번 독립적이며 1등 확률은 언제나 8,145,060분의 1입니다. 이 사이트의 통계와 분석 번호는 당첨 확률을 높이지 않으며 과거 데이터를
          살펴보는 재미로만 제공됩니다.
        </p>
        <p>
          동행복권과 관계없는 비공식 서비스입니다. 당첨 여부와 당첨금은 <a href="https://www.dhlottery.co.kr/" target="_blank" rel="noreferrer">동행복권</a>
          에서 꼭 확인하세요. 만 19세 미만은 복권을 살 수 없습니다. 도박 문제 상담은 <a href="tel:1336">1336</a>(한국도박문제예방치유원).
        </p>
        {data && (
          <p>
            데이터: 제1회~제{data.latest.no}회, 매주 토요일 밤 자동 갱신
          </p>
        )}
      </footer>

      <nav className="tabbar" aria-label="주요 화면">
        <TabButton tab="home" cur={tab} go={go} icon={<IconHome />} label="홈" />
        <TabButton tab="stats" cur={tab} go={go} icon={<IconChart />} label="통계" />
        <button type="button" className="tab tab-scan" aria-current={tab === 'scan' ? 'page' : undefined} onClick={() => go('scan')}>
          <span className="lens">
            <IconScan />
          </span>
          QR 채점
        </button>
        <TabButton tab="analysis" cur={tab} go={go} icon={<IconTarget />} label="적중 기록" />
        <TabButton tab="records" cur={tab} go={go} icon={<IconTicket />} label="내 기록" />
      </nav>

      {sheet && data && <ResultSheet ticket={sheet.ticket} duplicate={sheet.duplicate} data={data} onClose={() => setSheet(null)} actions={actions} />}
      {roundResults && data && !sheet && (
        <RoundResults rounds={roundResults} tickets={tickets} data={data} onClose={() => setRoundResults(null)} actions={actions} />
      )}
      {toastState && (
        <div className="toast" role="status">
          <span>{toastState.text}</span>
          {toastState.undo && (
            <button type="button" onClick={toastState.undo}>
              되돌리기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function drawDateIso(d: Draw): string {
  return `${d.date}T11:35:00.000Z`; // 20:35 KST
}

function TabButton({ tab, cur, go, icon, label }: { tab: Tab; cur: Tab; go: (t: Tab) => void; icon: JSX.Element; label: string }) {
  return (
    <button type="button" className="tab" aria-current={cur === tab ? 'page' : undefined} onClick={() => go(tab)}>
      {icon}
      {label}
    </button>
  );
}
