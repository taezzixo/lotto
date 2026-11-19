import { useCallback, useEffect, useRef, useState } from 'react';
import type { Actions, AppData } from '../App.tsx';
import type { Game } from '../types.ts';
import { QrError, parseLottoQr, ticketKey } from '../lib/qr.ts';
import { newId } from '../lib/store.ts';
import { currentSalesRound } from '../lib/schedule.ts';
import { Ball } from './Ball.tsx';
import { Slip } from './Slip.tsx';
import { IconClose, IconGrid, IconImage, IconLink, IconScan, IconTrash } from './Icons.tsx';

type Decoder = (src: CanvasImageSource, w: number, h: number) => Promise<string | null>;

/** 네이티브 BarcodeDetector(안드로이드 크롬 등) 우선, 없으면 jsQR(iOS 사파리 등)을 그때 불러온다. */
async function makeDecoder(canvas: HTMLCanvasElement): Promise<Decoder> {
  const BD = (globalThis as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (BD) {
    try {
      const formats: string[] = await BD.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const det = new BD({ formats: ['qr_code'] });
        return async (src) => {
          const codes = await det.detect(src);
          return codes[0]?.rawValue ?? null;
        };
      }
    } catch {
      /* jsQR 로 대체 */
    }
  }
  const jsQR = (await import('jsqr')).default;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return async (src, w, h) => {
    const scale = Math.min(1, 900 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  };
}

export function Scan({ data, actions }: { data: AppData; actions: Actions }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number>(0);
  const [cam, setCam] = useState<'idle' | 'starting' | 'on' | 'denied' | 'unsupported'>('idle');
  const [status, setStatus] = useState('복권의 QR 코드를 네모 안에 맞춰 주세요');
  const [panel, setPanel] = useState<'none' | 'link' | 'manual'>('none');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    window.clearTimeout(loopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam((c) => (c === 'on' || c === 'starting' ? 'idle' : c));
  }, []);
  useEffect(() => stop, [stop]);

  const handle = useCallback(
    async (raw: string): Promise<boolean> => {
      try {
        const p = parseLottoQr(raw);
        const key = await ticketKey(p.v);
        navigator.vibrate?.(60);
        actions.save({ id: newId(), source: 'qr', round: p.round, key, createdAt: new Date().toISOString(), games: p.games });
        setError(null);
        return true;
      } catch (e) {
        setError(e instanceof QrError ? e.message : 'QR을 읽지 못했어요. 다시 비추거나 번호를 직접 입력해 주세요.');
        return false;
      }
    },
    [actions],
  );

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam('unsupported');
      return;
    }
    setCam('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCam('on');
      setStatus('복권의 QR 코드를 네모 안에 맞춰 주세요');
      const decode = await makeDecoder(canvasRef.current);
      let last: string | null = null;
      let rejected: string | null = null;
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          if (video.readyState >= 2) {
            const value = await decode(video, video.videoWidth, video.videoHeight);
            if (value && value === last && value !== rejected) {
              setStatus('읽었어요');
              if (await handle(value)) {
                stop();
                return;
              }
              rejected = value; // 같은 잘못된 QR을 계속 처리하지 않음
              setStatus('이 QR은 로또 6/45 복권이 아니에요');
            }
            last = value;
          }
        } catch {
          /* 다음 프레임에서 다시 시도 */
        }
        loopRef.current = window.setTimeout(tick, 140);
      };
      void tick();
    } catch (e) {
      setCam((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'unsupported');
    }
  };

  const fromImage = async (file: File) => {
    setError(null);
    try {
      const bmp = await createImageBitmap(file);
      const decode = await makeDecoder(canvasRef.current);
      const value = await decode(bmp, bmp.width, bmp.height);
      if (!value) setError('사진에서 QR을 찾지 못했어요. QR이 크게 나오도록 다시 찍어 주세요.');
      else await handle(value);
    } catch {
      setError('사진을 열 수 없어요. 다른 사진을 골라 주세요.');
    }
  };

  return (
    <div className="view">
      <header className="view-head">
        <h2>QR 찍고 바로 채점</h2>
        <p>복권에 인쇄된 QR을 비추면 자동으로 채점하고 내 기록에 저장해요. 영상은 저장하지 않아요.</p>
      </header>

      <div className="scanner">
        <video ref={videoRef} playsInline muted hidden={cam !== 'on'} />
        {cam === 'on' ? (
          <>
            <div className="frame" aria-hidden="true" />
            <p className="status" aria-live="polite">
              {status}
            </p>
            <button type="button" className="icon-btn close" onClick={stop} aria-label="카메라 끄기">
              <IconClose />
            </button>
          </>
        ) : (
          <div className="idle">
            {cam === 'denied' ? (
              <p>카메라 권한이 꺼져 있어요. 브라우저 주소창의 설정에서 카메라를 허용하거나, 아래에서 사진이나 직접 입력을 써 주세요.</p>
            ) : cam === 'unsupported' ? (
              <p>이 브라우저에서는 카메라를 쓸 수 없어요. 아래에서 사진이나 직접 입력을 써 주세요.</p>
            ) : (
              <p>카메라는 QR을 읽는 데만 써요.</p>
            )}
            <button type="button" className="btn" onClick={start} disabled={cam === 'starting'}>
              <IconScan />
              {cam === 'starting' ? '카메라 켜는 중…' : '카메라 켜기'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="alt-actions">
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          <IconImage />
          사진에서 읽기
        </button>
        <button type="button" className="btn ghost" aria-expanded={panel === 'link'} onClick={() => setPanel(panel === 'link' ? 'none' : 'link')}>
          <IconLink />
          QR 링크 붙여넣기
        </button>
        <button type="button" className="btn ghost" aria-expanded={panel === 'manual'} onClick={() => setPanel(panel === 'manual' ? 'none' : 'manual')}>
          <IconGrid />
          번호 직접 입력
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void fromImage(f);
          e.target.value = '';
        }}
      />

      {panel === 'link' && <LinkPanel onSubmit={handle} />}
      {panel === 'manual' && <ManualPanel data={data} actions={actions} />}
    </div>
  );
}

function LinkPanel({ onSubmit }: { onSubmit: (raw: string) => Promise<boolean> }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="sheet"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit(value)) setValue('');
      }}
    >
      <label className="field">
        휴대폰 카메라로 QR을 찍어 나온 링크(m.dhlottery.co.kr/?v=…)를 붙여 넣으세요
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="url" placeholder="http://m.dhlottery.co.kr/?v=" required />
      </label>
      <div style={{ marginTop: 12 }}>
        <button className="btn" type="submit">
          채점하기
        </button>
      </div>
    </form>
  );
}

function ManualPanel({ data, actions }: { data: AppData; actions: Actions }) {
  const salesRound = Math.max(data.latest.no + 1, currentSalesRound());
  const [round, setRound] = useState(salesRound);
  const [picked, setPicked] = useState<number[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const rounds = Array.from({ length: 12 }, (_, i) => salesRound - i);

  const toggle = (n: number) => {
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 6 ? p : [...p, n].sort((a, b) => a - b)));
  };
  const fill = () => {
    const pool = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !picked.includes(n));
    const next = picked.slice();
    while (next.length < 6) next.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    setPicked(next.sort((a, b) => a - b));
  };
  const add = () => {
    if (picked.length !== 6 || games.length >= 5) return;
    setGames((g) => [...g, { slot: 'ABCDE'[g.length], type: 'manual', nums: picked }]);
    setPicked([]);
  };
  const save = () => {
    actions.save({ id: newId(), source: 'manual', round, createdAt: new Date().toISOString(), games });
    setGames([]);
  };

  return (
    <section className="sheet" aria-labelledby="manual-title">
      <div className="sheet-head">
        <h3 id="manual-title">번호 직접 입력</h3>
      </div>
      <label className="field" style={{ maxWidth: 260, marginBottom: 12 }}>
        회차
        <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
          {rounds.map((r) => (
            <option key={r} value={r}>
              제{r}회{r === salesRound ? ' (이번 주)' : ''}
            </option>
          ))}
        </select>
      </label>
      <Slip mode="pick" selected={picked} onPick={toggle} label="번호 6개 고르기" />
      <div className="filters" style={{ marginTop: 10 }}>
        <span className="balls" aria-live="polite">
          {picked.length ? picked.map((n) => <Ball key={n} n={n} style={{ ['--size' as string]: '30px' }} />) : <span className="muted">번호 6개를 눌러 주세요</span>}
        </span>
        <span className="actions">
          <button type="button" className="btn ghost" onClick={fill} disabled={picked.length === 6}>
            나머지 무작위
          </button>
          <button type="button" className="btn" onClick={add} disabled={picked.length !== 6 || games.length >= 5}>
            {String.fromCharCode(65 + games.length)}게임에 담기
          </button>
        </span>
      </div>
      {games.length > 0 && (
        <>
          <ul className="manual-games" style={{ marginTop: 14 }}>
            {games.map((g, i) => (
              <li key={g.slot}>
                <span className="slot">{g.slot}</span>
                <span className="balls">
                  {g.nums.map((n) => (
                    <Ball key={n} n={n} />
                  ))}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${g.slot}게임 지우기`}
                  onClick={() => setGames((gs) => gs.filter((_, j) => j !== i).map((x, j) => ({ ...x, slot: 'ABCDE'[j] })))}
                >
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn big" onClick={save}>
              {games.length}게임 저장하고 채점
            </button>
          </div>
        </>
      )}
    </section>
  );
}
