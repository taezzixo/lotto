# 키·비밀값 목록 (값은 여기에 쓰지 않음)

| 이름 | 위치 | 필요 여부 | 용도 |
| --- | --- | --- | --- |
| `LOTTO_OFFICIAL_BASE` | GitHub Secrets | 선택(비상용) | 동행복권이 해외 IP를 막을 때 국내 릴레이 주소. 비워 두면 `https://www.dhlottery.co.kr`를 직접 호출 |
| `SITE_URL` | Cloudflare 빌드 변수 | 선택 | 운영 주소(예: `https://lotto-lab.<계정>.workers.dev`). 있으면 sitemap·canonical 생성. 비밀값 아님 |

- 수집 출처(동행복권, smok95, Testrapod, gerosyab)는 모두 키가 필요 없습니다.
- 브라우저에 들어가는 키(`VITE_*`)는 없습니다.
