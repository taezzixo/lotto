import { useEffect, useState } from 'react';
import { IconClose } from './Icons.tsx';

const DISMISS_KEY = 'lotto-lab:install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * 복권을 2장 이상 저장한 사용자에게 홈 화면 추가를 권한다.
 * 아이폰 사파리는 오래 열지 않은 사이트의 저장 기록을 지울 수 있는데, 홈 화면 앱은 예외라서다.
 */
export function InstallCard({ ticketCount }: { ticketCount: number }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return !!localStorage.getItem(DISMISS_KEY) || isStandalone();
    } catch {
      return isStandalone();
    }
  });

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  if (hidden || ticketCount < 2 || (!evt && !isIos())) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* 무시 */
    }
    setHidden(true);
  };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === 'accepted') dismiss();
  };

  return (
    <section className="sheet install" aria-labelledby="install-title">
      <div className="sheet-head">
        <h2 id="install-title">홈 화면에 추가하기</h2>
        <button type="button" className="icon-btn" onClick={dismiss} aria-label="다시 보지 않기">
          <IconClose />
        </button>
      </div>
      <p>앱처럼 바로 열리고, 저장한 복권 기록이 브라우저 정리로 지워지지 않아요.</p>
      {evt ? (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={install}>
            홈 화면에 추가
          </button>
        </div>
      ) : (
        <p className="notice" style={{ marginTop: 8 }}>
          사파리 아래쪽 공유 버튼을 누른 뒤 「홈 화면에 추가」를 고르세요.
        </p>
      )}
    </section>
  );
}
