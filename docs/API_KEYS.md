# 키·비밀값 목록 (값은 여기에 쓰지 않음)

| 이름 | 위치 | 필요 여부 | 용도 |
| --- | --- | --- | --- |
| `LOTTO_OFFICIAL_BASE` | GitHub Secrets | 선택(비상용) | 동행복권이 해외 IP를 막을 때 국내 릴레이 주소. 비워 두면 `https://www.dhlottery.co.kr`를 직접 호출 |
| `GH_TOKEN` | Cloudflare Worker 비밀값(Secret) | 권장 | Cloudflare Cron이 토요일 밤 GitHub 수집(`workflow_dispatch`)을 정시에 깨움. 없으면 GitHub 예약만으로 수집(몇 시간 지연 가능) |
| `SITE_URL` | Cloudflare 빌드 변수 | 선택 | 운영 주소(예: `https://lotto.kth95280.workers.dev`). 있으면 sitemap·canonical 생성. 비밀값 아님 |

- 수집 출처(동행복권, smok95, Testrapod, gerosyab)는 모두 키가 필요 없습니다.
- 브라우저에 들어가는 키(`VITE_*`)는 없습니다.

## `GH_TOKEN` 만들고 넣기

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
   - Repository access: **Only select repositories** → `taezzixo/lotto`
   - Permissions → Repository permissions → **Actions: Read and write** (나머지는 기본값 그대로)
   - 만료일은 최대 1년. 만료되면 같은 방법으로 다시 만들어 교체
2. Cloudflare 대시보드 → Workers 및 Pages → `lotto` → 설정(Settings) → 변수 및 비밀(Variables and Secrets) → 추가
   - 유형 **Secret**, 이름 `GH_TOKEN`, 값 = 1번 토큰 → 배포
3. 확인: 같은 화면의 「트리거」(Triggers)에 Cron 2개(`*/10 12-14 * * SAT`, `7 0 * * SUN`)가 보이면 정상. 실행 기록은 Workers → `lotto` → 로그(Observability)에 `[cron] 건너뜀/수집 시작` 한 줄씩 남음

- 토큰은 이 저장소의 Actions 실행만 할 수 있고 코드를 고칠 수 없습니다.
- 이미 최신 회차가 확정 반영돼 있으면 GitHub를 부르지 않으므로 토요일 밤 실제 호출은 보통 1~3번입니다.
