import { useEffect, useRef, useState } from 'react';
import type { HitReport } from '../lib/report.ts';
import { MATCH_PROB } from '../lib/lotto.ts';
import { pct } from '../lib/format.ts';
import { IconClose, IconDownload } from './Icons.tsx';

/**
 * 공유 카드(1080×1350 PNG). 개인정보·번호·일련번호는 넣지 않고 운 지수와 일치 분포만 담는다.
 * 색은 화면 테마와 무관하게 용지(흰 바탕 + 분홍 잉크)로 고정한다.
 */
async function drawCard(rep: HitReport): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const ink = '#261a12';
  const muted = '#62554a';
  const slip = '#2942ab'; // 군청 안료
  const theory = '#be7c1c';
  const ko = "'Hanken Grotesk', 'Gothic A1', 'Apple SD Gothic Neo', sans-serif";
  const head = "'Song Myung', 'Grenze', Georgia, serif";
  const num = "'Grenze', Georgia, serif";

  g.fillStyle = '#e9dcc7';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#f9f3e8';
  g.fillRect(60, 60, W - 120, H - 120);
  // 인쇄소 장부처럼 위쪽 이중선, 둘레 가는 선
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.strokeRect(60, 60, W - 120, H - 120);
  g.fillStyle = ink;
  g.fillRect(60, 60, W - 120, 5);
  g.fillRect(60, 72, W - 120, 2);

  // 머리: 안료 인장 + 이름
  g.fillStyle = slip;
  g.beginPath();
  g.arc(160, 160, 46, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#f5eee0';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(160, 160, 38, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#f5eee0';
  g.font = `500 40px ${num}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('45', 160, 163);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = ink;
  g.font = `400 46px ${head}`;
  g.fillText('로또 데이터 실험실 나의 적중률', 230, 176);

  // 운 지수
  g.fillStyle = muted;
  g.font = `700 36px ${ko}`;
  g.fillText('운 지수', 120, 320);
  g.fillStyle = slip;
  g.font = `500 270px ${num}`;
  g.fillText(String(rep.luckIndex), 108, 560);
  g.fillStyle = ink;
  g.font = `400 42px ${head}`;
  const top = rep.luckTop <= 0.5 ? `무작위로 산 사람 중 상위 ${Math.max(1, Math.round(rep.luckTop * 100))}%` : '평균보다 조금 덜 맞았어요';
  g.fillText(top, 120, 640);
  g.fillStyle = muted;
  g.font = `500 32px ${ko}`;
  g.fillText(`${rep.games}게임, 평균 ${rep.avgMatched.toFixed(2)}개 일치, 번호 적중률 ${pct(rep.hitRate)}`, 120, 700);

  // 일치 분포 막대 (0~4개, 나 vs 이론)
  const base = 1060;
  const maxH = 260;
  const ks = [0, 1, 2, 3, 4];
  const mine = ks.map((k) => (rep.games ? rep.dist[k] / rep.games : 0));
  const maxV = Math.max(...mine, ...ks.map((k) => MATCH_PROB[k])) || 1;
  const bw = 120;
  const gap = (W - 240 - bw * ks.length) / (ks.length - 1);
  ks.forEach((k, i) => {
    const x = 120 + i * (bw + gap);
    const h = (mine[i] / maxV) * maxH;
    g.fillStyle = slip;
    roundRect(g, x, base - h, bw, h, Math.min(2, h / 2));
    g.fill();
    const ty = base - (MATCH_PROB[k] / maxV) * maxH;
    g.strokeStyle = theory;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 6, ty);
    g.lineTo(x + bw + 6, ty);
    g.stroke();
    g.fillStyle = ink;
    g.font = `700 30px ${ko}`;
    g.textAlign = 'center';
    g.fillText(`${k}개`, x + bw / 2, base + 46);
  });
  g.textAlign = 'left';
  g.font = `500 28px ${ko}`;
  g.fillStyle = slip;
  g.fillRect(120, 1150, 26, 26);
  g.fillStyle = ink;
  g.fillText('내 게임', 160, 1172);
  g.strokeStyle = theory;
  g.beginPath();
  g.moveTo(300, 1163);
  g.lineTo(340, 1163);
  g.stroke();
  g.fillText('무작위 이론', 356, 1172);

  g.fillStyle = muted;
  g.font = `500 24px ${ko}`;
  g.fillText('로또 1등 확률은 언제나 8,145,060분의 1. 통계는 재미로만 봐 주세요.', 120, 1240);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('이미지를 만들지 못했어요.'))), 'image/png'));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function ShareCard({ rep, onClose, onToast }: { rep: HitReport; onClose: () => void; onToast: (t: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    drawCard(rep)
      .then((b) => {
        if (!alive) return;
        setBlob(b);
        setUrl(URL.createObjectURL(b));
      })
      .catch((e: Error) => onToast(e.message));
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      document.removeEventListener('keydown', onKey);
    };
  }, [rep, onClose, onToast]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const file = blob ? new File([blob], 'lotto-lab-luck.png', { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: '로또 데이터 실험실 나의 적중률' });
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') onToast('공유하지 못했어요. 이미지 저장을 이용해 주세요.');
    }
  };
  const save = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lotto-lab-luck.png';
    a.click();
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="result" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1} ref={ref}>
        <div className="result-head">
          <div>
            <h2 id="share-title">공유 카드</h2>
            <p>번호와 복권 일련번호는 들어가지 않아요.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <IconClose />
          </button>
        </div>
        <div className="share-preview">{url ? <img src={url} alt={`운 지수 ${rep.luckIndex}, ${rep.games}게임 요약 카드`} /> : <p className="muted">만드는 중…</p>}</div>
        <div className="actions" style={{ marginTop: 14 }}>
          {canShare && (
            <button type="button" className="btn" onClick={share}>
              공유하기
            </button>
          )}
          <button type="button" className={canShare ? 'btn ghost' : 'btn'} onClick={save} disabled={!url}>
            <IconDownload />
            이미지 저장
          </button>
        </div>
      </div>
    </div>
  );
}
