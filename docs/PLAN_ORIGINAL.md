# 차세대 오픈 통계형 로또 번호 분석·생성 플랫폼 제품 요구사항 정의서 (PRD)

- **문서 버전**: v1.0
- **작성 기준일**: 2026년 11월 18일 (제1,250회 추첨 데이터 반영 기준)
- **제품 형태**: 반응형 웹 애플리케이션 (PWA 지원) + 서버리스 자동 데이터 수집 파이프라인
- **핵심 가치 제안**: 불투명한 유료 번호 추천을 배제하고, [동행복권 공식 통계](https://www.dhlottery.co.kr/lt645/stats) 및 제1회~제1,250회 전수 데이터를 기반으로 사용자가 직접 필터 가중치를 설계·백테스팅하는 투명한 로또 데이터 실험실(Data Playground)

---

## 1. 배경 및 문제 정의: 유료 예측 시장의 불신을 투명한 데이터 경험으로 해결한다

국내 로또 정보 서비스 시장은 결제액 기준 약 70% 점유율을 차지해 온 [로또리치](https://m.lottorich.co.kr/)([한경비즈니스 보도](https://magazine.hankyung.com/business/article/201807244057b))나 [로또타파](https://lottotapa.com/stat/stat_number.php) 등 유료 멤버십 사이트와, [프리또](https://freetto.io/)·[큐레이터 단비 로또 번호 생성기 Pro](https://min-inter.co.kr/lotto-analyzer/)·[더워드크래커](https://www.thewordcracker.com/lotto/) 등 무료 웹 생성기로 이원화되어 있습니다.

그러나 기존 유료 예측 서비스는 과학적 근거가 없는 ‘AI 1등 예측’이나 ‘미당첨 시 전액 환불’ 특약을 내세워 고액 결제를 유도한 뒤 환불을 거부하는 구조적 문제를 안고 있습니다. 실제로 [한국소비자원 피해구제 통계(라이센스뉴스 보도)](https://www.lcnews.co.kr/news/articleView.html?idxno=76227)에 따르면 2019~2023년 5년간 접수된 로또 예측 서비스 피해구제 신청은 **총 1,917건**(계약해지 시 환급 거부 및 위약금 과다 부과 60.9%·1,168건, 미당첨 환급 약정 불이행 27.6%·529건, 청약철회 거부 7.3%·139건)에 달하며, 사업자 연락 두절 등으로 인한 처리불능 비율이 41.1%(788건)를 기록했습니다([한겨레 보도](https://www.hani.co.kr/arti/economy/consumer/1142498.html)).

반면 기존 무료 사이트들은 단순 난수 추출에 그치거나([더워드크래커](https://www.thewordcracker.com/lotto/)), 단일 화면에 수십 개의 통계표를 나열해 모바일 사용성이 떨어지는 한계([로또엔](https://www.lottoen.com/lotto645/lab/number), [로또퍼스트](https://lottofirst.co.kr/))를 보입니다. 따라서 신규 플랫폼은 **1등 당첨 확률(1/8,145,060)은 매 회차 독립시행으로 고정되어 있음을 정직하게 고지**하되, **과거 1,250회차 분포 기반의 정밀 필터링**, **즉시 백테스팅(Backtesting)**, **공동 당첨 회피를 통한 기대 실수령액 최적화**를 무료로 제공하는 방향으로 설계합니다.

| 시장 구분 및 대표 서비스 | 기존 제공 방식 | 핵심 문제점 (Pain Point) | 신규 플랫폼의 해결 전략 (Product Solution) |
| :--- | :--- | :--- | :--- |
| **유료 멤버십형**<br>([로또리치](https://m.lottorich.co.kr/), [로또타파](https://lottotapa.com/stat/stat_number.php)) | 고가 정기결제 후 블랙박스 알고리즘 번호 SMS 발송 | 알고리즘 근거 불투명, 환불 거부·위약금 분쟁([한국소비자원 1,917건](https://www.lcnews.co.kr/news/articleView.html?idxno=76227)) | 100% 무료 오픈 필터 제공, 사용자가 직접 가중치 슬라이더를 조작하고 산출 근거를 실시간 확인 |
| **무료 올인원 포털형**<br>([프리또](https://freetto.io/), [로또퍼스트](https://lottofirst.co.kr/)) | 6가지 기본 추천 방식, 브라우저 30일 번호 보관 및 자동 채점 | AC값·합계 구간·끝수 합 등 세부 수학적 필터의 복합 커스터마이징 불가 | 다중 통계 필터 조합기 + 생성 번호의 제1~1,250회 즉시 백테스팅 시뮬레이터 결합 |
| **통계 대시보드 웹앱형**<br>([로또 번호 생성기 Pro](https://min-inter.co.kr/lotto-analyzer/), [로또엔](https://www.lottoen.com/lotto645/lab/number)) | 핫·콜드 번호 분류, 홀짝·고저·합계 비율 차트 제공 | 보너스 볼 포함/미포함 기준 혼재, 데이터 나열식 구성으로 모바일 조작성 저하 | 상단 ‘보너스 포함/제외’ 전역 토글 제공 및 모바일 퍼스트 카드·슬라이더 UI 적용 |
| **단순 난수 추출형**<br>([더워드크래커](https://www.thewordcracker.com/lotto/)) | 포함·제외수 선택 후 브라우저 난수 추출 | 역대 당첨 번호 DB 미연동으로 과거 당첨 이력 대조 및 통계 검증 불가 | 클라이언트 메모리에 경량화된 전 회차 데이터(약 150KB)를 로드해 0.1초 내 역대 등수 대조 |

---

## 2. 타깃 사용자 페르소나 및 핵심 가치

신규 사이트는 로그인이나 회원가입 강제 없이 즉시 기능을 사용할 수 있어야 하며, 사용자의 성향에 따라 세 가지 핵심 세그먼트를 타깃으로 합니다.

| 페르소나 유형 | 주요 행동 특성 및 니즈 | 핵심 제공 기능 (Key Feature) |
| :--- | :--- | :--- |
| **데이터 실험형 분석가**<br>(30~50대, 수동·반자동 선호) | [로또타파](https://lottotapa.com/stat/stat_number.php)나 [로또엔](https://www.lottoen.com/lotto645/lab/number)에서 미출현 번호·이월수·동반출현 통계를 직접 대조하며 번호를 조합함 | 보너스 포함/미포함 전역 토글, 45×45 동반출현 매트릭스, 오픈 레시피 가중치 슬라이더, 1~1,250회 백테스팅 |
| **기댓값 최적화 전략가**<br>(20~40대, 합리적 구매자) | 확률이 1/8,145,060으로 같다면 제1,128회(1등 63명 당첨, [로또 번호 생성기 Pro 통계](https://min-inter.co.kr/lotto-analyzer/))처럼 당첨금이 쪼개지는 인기 번호를 피하고 싶어 함 | 생일수(1~31) 편중·연속 마킹·전주 당첨번호 중복을 감점하는 **비인기 조합(독식 기댓값) 스코어링** 및 세후 실수령액 계산기 |
| **간편 관리형 주간 구매자**<br>(전 연령대, 자동·추천 번호 혼용) | 매주 토요일 추첨 직후 내가 뽑은 번호와 구매 용지의 당첨 여부를 번거로운 로그인 없이 확인하고 싶어 함 | 무가입 `IndexedDB` 로컬 번호 보관함, 토요일 20:35 추첨 후 자동 채점 배지, 모바일 카메라 QR 스캔 연동 |

---

## 3. 사용자 워크플로 (User Workflow) 상세 설계

사용자가 사이트에 진입하여 통계를 탐색하고, 맞춤형 번호를 생성·검증한 뒤, 추첨 후 결과를 확인하기까지의 5단계 엔드투엔드(End-to-End) 사용자 흐름입니다.

### 3.1 단계별 사용자 여정 (5-Step User Journey)

1. **Step 1 — 진입 및 글로벌 기준 설정 (Entry & Global Toggle)**
   - 사용자는 메인 화면 상단에서 최신 회차(예: 제1,250회 당첨번호 `1, 5, 18, 23, 27, 28 + 8`, 1등 9명·1인당 31억 316만 원, [프리또 제1,250회 결과](https://freetto.io/))와 다음 회차 판매 마감(매주 토요일 20:00) 카운트다운을 확인합니다.
   - **보너스 번호 포함/미포함 전역 토글**: 기본 6개 당첨번호만 집계할지(34번 188회 1위, [로또타파 기준](https://lottotapa.com/stat/stat_number.php)), 2등 보너스 번호까지 포함할지(27번 217회 1위, [시그널파이어 기준](https://signalfire85.tistory.com/40)) 선택하면 페이지 내 모든 히트맵과 순위표가 즉시 동기화됩니다.
   - **분석 구간 선택 탭**: `전체 회차(1~최신)` / `최근 100회` / `최근 50회` / `최근 15회` 중 분석 범위를 전환합니다.

2. **Step 2 — 오픈 레시피 필터 및 가중치 설정 (Filter & Weight Configuration)**
   - **고정수(포함수) 및 제외수 선택**: 1~45번 볼 그리드에서 고정수(최대 5개)와 제외수(최대 35개)를 탭하여 지정합니다. 고정수 선택 시 해당 번호와 역대 동반 출현 빈도가 높은 ‘궁합수’([동행복권 동반출현 통계](https://www.dhlottery.co.kr/lt645/stats))가 하이라이트됩니다.
   - **핫·콜드·미출현 프리셋 선택**:
     - `핫 넘버(상위 20%, 보너스 포함 204회 이상)`: 27번(217회), 13·34번(212회), 12번(208회), 33번(207회) 등 다빈도 번호 가중치 부여([로또 번호 생성기 Pro](https://min-inter.co.kr/lotto-analyzer/)).
     - `콜드 넘버(하위 30%, 보너스 포함 191회 이하)`: 9번(165회), 22·41번(170회), 23번(172회), 29번(174회) 등 저빈도 번호 회귀 전략 적용.
     - `장기 미출현 번호`: 최근 15회~24회 연속 미출현 번호(예: 17번 24회 연속 미출현, 30번 22회 미출현 등) 우선 포함 옵션.
   - **통계적 균형 필터(수학적 범위 제한)**:
     - **6개 번호 총합 구간**: 기본값 `91 ~ 180` (역대 당첨 번호의 **85.3%**가 해당 구간에 분포하며 전체 평균 합계는 **138**, [로또 번호 생성기 Pro](https://min-inter.co.kr/lotto-analyzer/)).
     - **홀짝 및 고저(1~22 대 23~45) 비율**: 극단적 쏠림(6:0 또는 0:6) 제외 여부 설정.
     - **연속번호 제한**: 무연속(역대 **48.2%**) 또는 1쌍 연속(역대 **39.4%**)까지만 허용하고, 3쌍 이상 연속(역대 **1.8%**)은 자동 필터링.
     - **AC값(산술적 복잡도)**: `7 ~ 10` 구간 필터 적용 여부 선택.

3. **Step 3 — 번호 생성 및 희소성(기댓값) 스코어링 확인 (Generation & EV Scoring)**
   - 사용자가 `[조건 맞춤 번호 5조합 생성]` 버튼을 누르면 조건을 만족하는 5세트(A~E열)의 번호가 즉시 추출됩니다.
   - 각 조합 우측에 **희소성 등급(S / A / B / C)** 배지가 표시됩니다.
     - 1~31(날짜·생일 숫자) 비중이 과도하거나, 로또 용지상 일직선·대각선 패턴, 직전 회차 당첨번호 3개 이상 중복 조합은 다수 구매자와 겹쳐 1등 당첨 시 당첨금이 분산될 위험이 높으므로 감점 처리하고 사유를 툴팁으로 안내합니다.

4. **Step 4 — 제1회~최신 회차 즉시 백테스팅 (Instant Historical Backtesting)**
   - 생성된 조합별로 `[역대 당첨 대조]`를 클릭하거나 자동 인라인 배지를 통해 지난 1,250회 동안 해당 6개 번호가 거둔 성적을 확인합니다.
   - 출력 항목: `역대 1등 일치(0~N회)`, `2등 일치`, `3등 일치(번호 5개 일치)`, `4등 일치(4개 일치)`, `5등 일치(3개 일치)` 횟수 및 가장 최근에 상위 등수에 근접했던 회차 번호·일자 표시.

5. **Step 5 — 무가입 보관함 저장 및 추첨 후 자동 채점·세금 계산 (Vault & Post-Draw Check)**
   - 생성한 조합은 `[내 보관함에 저장]` 클릭 시 브라우저 `IndexedDB`(비회원 기본 90일~영구 보관, JSON 파일 백업·복원 및 간편 소셜 로그인 동기화 지원)에 저장됩니다.
   - 매주 토요일 추첨 완료 후 보관함 접속 시 당첨 등수와 당첨금이 자동 매칭되며, **실수령액 계산기**([프리또 세금 계산 기준](https://freetto.io/): 200만 원 이하 비과세, 200만 원 초과~3억 원 이하 22%, 3억 원 초과분 33% 원천징수)를 통해 세후 수령액을 즉시 보여줍니다.

---

## 4. 데이터 자동수집 및 사전 연산 워크플로 (Automated Data Pipeline)

[동행복권 공식 웹사이트](https://www.dhlottery.co.kr/)는 회차별 당첨 정보를 JSON으로 반환하는 내부 엔드포인트(`getLottoNumber`)를 제공합니다([달서비 Python 크롤링 가이드](https://dalseobi.tistory.com/159)). 그러나 프런트엔드 브라우저에서 이 URL을 직접 호출하면 **CORS(Cross-Origin Resource Sharing) 에러**로 차단되며, 다수 트래픽이 동행복권 서버로 직접 향할 경우 IP 차단 위험이 있습니다([Velog DB 연동 사례](https://velog.io/@kwj1830/lotto-3)). 따라서 **주 1회 동작하는 서버리스 배치 파이프라인(GitHub Actions 또는 Cloud Scheduler)**이 데이터를 수집·검증·사전 연산하여 정적 JSON(CDN) 또는 자체 DB에 적재하는 아키텍처를 채택합니다([블러드스트로베리 GitHub Actions 가이드](https://bloodstrawberry.tistory.com/1352)).

### 4.1 원본 데이터 소스 및 응답 명세

- **호출 URL**: `GET https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={회차번호}`
- **응답 특성**: HTTP 상태 코드는 `200 OK`이나 응답 헤더의 `Content-Type`이 `text/html`로 내려오는 경우가 있으므로 파서에서 `resp.json()` 대신 `json.loads(resp.text)`로 파싱해야 안전합니다. 미추첨 회차 조회 시 `{"returnValue": "fail"}`을 반환합니다([Velog API 검증](https://velog.io/@kwj1830/lotto-3)).

| 원본 JSON 필드명 | 데이터 타입 | 설명 및 예시 값 (제1,000회 기준) | 파생 파이프라인 활용 용도 |
| :--- | :--- | :--- | :--- |
| `returnValue` | `String` | 조회 성공 여부 (`"success"` 또는 `"fail"`) | 신규 회차 추첨 완료 및 집계 반영 여부 판별 |
| `drwNo` | `Number` | 추첨 회차 번호 (`1000`) | 기본 키(Primary Key) 및 시계열 정렬 기준 |
| `drwNoDate` | `String` | 추첨 일자 (`"2022-01-29"`) | 연도별·월별 통계 및 회차 검증 |
| `drwtNo1` ~ `drwtNo6` | `Number` | 오름차순 정렬된 기본 당첨번호 6개 (`2, 8, 19, 22, 32, 42`) | 번호별 출현 빈도, 합계, 홀짝, 고저, 연속수, AC값 계산 |
| `bnusNo` | `Number` | 2등 보너스 번호 (`39`) | 보너스 포함 빈도 통계 및 백테스팅 2등 판정 |
| `totSellamnt` | `Number` | 해당 회차 총 판매금액 (`118628811000`원) | 복권기금(42%) 및 총 당첨금(50%) 배분 추이 분석 |
| `firstWinamnt` | `Number` | 1등 1인당 당첨금액 (`1246819620`원) | 역대 1등 평균 당첨금 및 세후 실수령액 계산 |
| `firstPrzwnerCo` | `Number` | 1등 당첨자 수 (`22`명) | 조합 희소성(인기 번호 쏠림 시 당첨자 급증) 분석 |
| `firstAccumamnt` | `Number` | 1등 총 당첨금액 합계 (`27430031640`원) | 1등 배분 재원 검증 |

### 4.2 주간 자동수집 타임라인 및 재시도(Retry) 정책

[프리또 추첨 안내](https://freetto.io/)에 따르면 로또 6/45는 매주 토요일 **20:00에 판매가 마감**되고, **20:35경 MBC 생방송으로 추첨**되며, 1등 당첨자 수와 당첨금 집계가 최종 반영되는 시각은 **토요일 21:00~21:30경**입니다. 이에 맞춘 자동화 파이프라인 스케줄은 다음과 같습니다.

| 단계 (Stage) | 실행 시각 (KST 기준) | 수행 작업 및 예외 처리 로직 |
| :--- | :--- | :--- |
| **Stage 0. 초기 시드 구축**<br>(최초 1회 실행) | 서비스 오픈 전 1회 | 제1회(2002-12-07)부터 최신 회차(제1,250회)까지 `0.2초` 간격으로 순차 호출하거나 [동행복권 통계 페이지](https://www.dhlottery.co.kr/lt645/stats) 엑셀 다운로드 파일을 파싱해 `data/draws_history.json` 초기 생성 |
| **Stage 1. 1차 속보 수집**<br>(당첨번호 우선 반영) | 매주 토요일 **20:45** | 예상 최신 회차(`마지막 저장 회차 + 1`) 호출. `returnValue == "success"`이면 당첨번호 6개+보너스 번호를 우선 반영하고, `firstWinamnt == 0`(집계 중)일 경우 상태 플래그를 `PARTIAL`로 기록 |
| **Stage 2. 최종 집계 수집**<br>(당첨금·인원 확정) | 매주 토요일 **21:20 ~ 22:10**<br>(10분 간격 폴링) | `returnValue == "fail"`이거나 `firstWinamnt == 0`인 경우 **10분 간격으로 최대 6회 재시도(Retry)**. 모든 필드가 0보다 큰 정상 값으로 채워지면 상태를 `COMPLETE`로 확정 |
| **Stage 3. 정합성 검증**<br>(Data Validation) | 수집 직후 즉시 | ① `drwtNo1 < drwtNo2 < ... < drwtNo6` 오름차순 및 `1 <= N <= 45` 범위 검증<br>② 6개 번호 + 보너스 번호 간 중복 없음(Set 크기 7) 검증<br>③ `drwNo == 이전 회차 + 1` 연속성 검증 |
| **Stage 4. 파생 통계 사전 연산**<br>(Pre-computation) | 검증 통과 직후 (약 2초 소요) | 프런트엔드 연산 부하를 줄이기 위해 전체/최근 10·50·100회 빈도, 미출현 주수, 홀짝·고저·합계·AC값 분포, 45×45 동반출현 행렬을 계산하여 `stats_summary.json` 갱신 |
| **Stage 5. 정적 배포 및 알림**<br>(CDN Deploy & Alert) | 연산 완료 직후 | 갱신된 JSON 파일을 Git 리포지토리에 자동 커밋(Cloudflare Pages / Vercel 자동 재배포 트리거) 및 보관함 저장 사용자 대상 웹 푸시(Web Push) 발송 |

### 4.3 자동수집 파이프라인 구현 명세 (GitHub Actions & Python ETL)

리포지토리 내 `.github/workflows/update_lotto_data.yml`과 `scripts/update_lotto.py`로 구성되는 무서버(Serverless) 자동 수집 파이프라인 표준 구성안입니다([블러드스트로베리 GitHub Actions 구현](https://bloodstrawberry.tistory.com/1352) 및 [달서비 Python 코드](https://dalseobi.tistory.com/159) 참조).

```yaml
# .github/workflows/update_lotto_data.yml
name: Weekly Lotto 6/45 Data Ingestion & Pre-computation

on:
  schedule:
    # 매주 토요일 21:20 KST (12:20 UTC) 및 21:50 KST (12:50 UTC) 실행
    - cron: '20,50 12 * * 6'
  workflow_dispatch: # 수동 실행 지원

permissions:
  contents: write

jobs:
  sync-lotto-data:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install requests

      - name: Run ETL and Pre-compute Statistics
        run: python scripts/update_lotto.py

      - name: Commit and Push updated JSON files
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/draws_history.json public/data/stats_summary.json
          git diff --staged --quiet || (git commit -m "chore(data): update latest lotto draw and pre-computed stats" && git push)
```

```python
# scripts/update_lotto.py 핵심 ETL 및 통계 사전 연산 로직
import json
import time
from pathlib import Path
import requests

API_URL = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo={}"
HISTORY_PATH = Path("public/data/draws_history.json")
STATS_PATH = Path("public/data/stats_summary.json")

def calc_ac_value(nums: list[int]) -> int:
    """6개 번호의 산술적 복잡도(AC값)를 계산합니다 (범위: 0 ~ 10)."""
    diffs = set()
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            diffs.add(abs(nums[j] - nums[i]))
    return len(diffs) - (len(nums) - 1)

def fetch_draw_with_retry(drw_no: int, max_retries: int = 3) -> dict | None:
    """동행복권 API에서 특정 회차 JSON을 조회하고 유효성을 검증합니다."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LottoAnalyticsBot/1.0)"}
    for attempt in range(max_retries):
        try:
            resp = requests.get(API_URL.format(drw_no), headers=headers, timeout=10)
            resp.raise_for_status()
            payload = json.loads(resp.text)
            if payload.get("returnValue") != "success":
                return None
            nums = [payload[f"drwtNo{i}"] for i in range(1, 7)]
            bonus = payload["bnusNo"]
            assert len(set(nums + [bonus])) == 7, "Duplicate numbers detected"
            assert all(1 <= n <= 45 for n in nums + [bonus]), "Number out of range 1..45"
            return {
                "drwNo": payload["drwNo"],
                "date": payload["drwNoDate"],
                "nums": nums,
                "bonus": bonus,
                "sum": sum(nums),
                "oddCount": sum(1 for n in nums if n % 2 == 1),
                "highCount": sum(1 for n in nums if n >= 23),
                "ac": calc_ac_value(nums),
                "firstWinamnt": payload["firstWinamnt"],
                "firstPrzwnerCo": payload["firstPrzwnerCo"],
                "totSellamnt": payload["totSellamnt"],
            }
        except Exception:
            time.sleep(5 * (attempt + 1))
    return None
```

---

## 5. 기능 요구사항 명세 (Functional Requirements)

개발 우선순위는 MVP 필수 구현 항목(**P0**), 사용성 고도화 항목(**P1**), 확장 커뮤니티·알림 기능(**P2**)으로 구분합니다.

| 요구사항 ID | 모듈 구분 | 기능 명칭 | 상세 요구사항 및 수용 기준 (Acceptance Criteria) | 우선순위 |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01** | 통계 대시보드 | 보너스 포함/미포함 전역 토글 | • 토글 전환 시 1~45번 출현 횟수, 순위, 히트맵 색상이 즉시 재계산되어야 함<br>• 제1~1,250회 기준 보너스 제외 시 34번(188회), 보너스 포함 시 27번(217회)이 정확히 1위로 표시되어야 함([로또타파](https://lottotapa.com/stat/stat_number.php), [시그널파이어](https://signalfire85.tistory.com/40)) | **P0** |
| **FR-02** | 통계 대시보드 | 회차 구간별 핫·콜드·미출현 분석 | • 전체 / 최근 100회 / 50회 / 15회 구간 필터 지원<br>• 각 번호의 현재 연속 미출현 회차 수(예: 15회 이상 미출현 배지) 및 구간별(1~10, 11~20, 21~30, 31~40, 41~45) 출현 비중 시각화([프리또](https://freetto.io/)) | **P0** |
| **FR-03** | 번호 생성기 | 오픈 레시피 다중 필터 조합기 | • 고정수(최대 5개), 제외수(최대 35개) 지정<br>• 총합 구간 슬라이더(기본 `91~180`), 홀짝 비율(예: `2:4 ~ 4:2`), 고저 비율, 연속번호 허용 쌍 수(`0~1쌍`), AC값(`7~10`) 조건을 만족하는 조합만 필터링하여 1회 5세트 생성([로또 번호 생성기 Pro](https://min-inter.co.kr/lotto-analyzer/)) | **P0** |
| **FR-04** | 검증 엔진 | 제1회~최신 회차 즉시 백테스팅 | • 생성되거나 사용자가 직접 입력한 6개 번호를 전체 당첨 이력 배열과 대조해 1~5등 당첨 횟수, 일치 회차, 총 가상 당첨금 및 ROI를 `100ms` 이내에 출력 | **P0** |
| **FR-05** | 기댓값 엔진 | 비인기 조합 스코어링 & 세금 계산기 | • 생일수(1~31) 5개 이상 포함, 3연속 번호, 용지 일직선 패턴 등에 감점을 부여해 독식 기댓값 등급(S~C) 산출<br>• 200만 원 이하 비과세, 3억 이하 22%, 3억 초과 33% 세율을 반영한 세후 실수령액 계산기 제공([프리또 세금 안내](https://freetto.io/)) | **P1** |
| **FR-06** | 사용자 보관함 | 무가입 로컬 보관함 & 자동 채점 | • 회원가입 없이 브라우저 `IndexedDB`에 생성 번호와 메모를 저장하고 JSON 내보내기/가져오기 지원<br>• 토요일 최신 회차 데이터 반영 시 보관함 내 조합의 당첨 등수 자동 하이라이트 | **P1** |
| **FR-07** | 통계 심화 | 45×45 동반출현(궁합수) 매트릭스 | • 특정 번호 선택 시 역대 가장 많이 함께 당첨된 상위 5개 동반 번호와 가장 적게 나온 번호 제시([동행복권 통계](https://www.dhlottery.co.kr/lt645/stats)) | **P1** |
| **FR-08** | 모바일 유틸리티 | 실물 로또 QR 스캔 & 전체 성적 공시 | • 모바일 웹 카메라(`BarcodeDetector` / `ZXing`)로 실물 복권 QR코드를 스캔해 즉시 당첨 확인 및 내 보관함 등록<br>• 매주 사이트 전체에서 생성된 조합들의 실제 당첨 통계(1~5등 배출 수)를 투명하게 자동 공시([프리또 모두의번호](https://freetto.io/) 벤치마킹) | **P2** |

---

## 6. 비기능 요구사항 (Non-Functional Requirements) 및 컴플라이언스

1. **성능 및 클라이언트 경량화 (Performance)**
   - 제1회~제1,250회 전체 당첨 번호 데이터(`draws_history.json`)는 Gzip/Brotli 압축 시 **35KB 이하**로 유지하여 초기 로딩 시 네트워크 지연을 최소화합니다.
   - 5세트 번호 조건부 생성 및 1,250회차 전체 백테스팅 연산은 클라이언트 Web Worker 또는 메인 스레드에서 **100ms 이내**에 완료되어야 합니다.
   - 만약 사용자가 선택한 필터 조건이 상호 모순되어(예: 고정수 5개를 모두 40번대로 지정하면서 총합 상한을 100으로 설정) `10,000회` 샘플링 내 조합 생성이 불가능할 경우, 무한 루프에 빠지지 않고 즉시 **조건 충돌 안내 메시지**를 띄워야 합니다.

2. **법적·윤리적 컴플라이언스 및 소비자 보호 (Compliance & Ethics)**
   - [한국소비자원 권고사항](https://www.lcnews.co.kr/news/articleView.html?idxno=76227)에 따라 사이트 하단 및 번호 생성 화면에 **“모든 로또 추첨은 독립시행(1등 확률 1/8,145,060)이며, 본 서비스의 통계 필터링은 당첨 확률을 높이지 않고 과거 데이터 탐색 및 참고 목적으로만 제공됩니다”**라는 고지문을 상시 노출합니다.
   - 19세 미만 청소년 복권 구매 불가 안내 및 한국도박문제예방치유원 헬프라인(1336) 링크를 푸터에 명시합니다([프리또 푸터 기준](https://freetto.io/)).

---

## 7. 핵심 성과 지표 (KPI) 및 단계별 출시 로드맵

### 7.1 핵심 성과 지표 (Success Metrics)
- **주간 재방문율 (Weekly Retention Rate)**: 토요일 추첨일(20:30~23:00) 보관함 자동 채점 확인을 위해 재방문하는 주간 활성 사용자(WAU) 비율 **35% 이상** 달성
- **인당 평균 필터 조작 및 백테스팅 실행 횟수**: 세션당 평균 **4회 이상** 가중치 변경 및 백테스팅 실행
- **데이터 파이프라인 무결성 (Pipeline SLA)**: 매주 토요일 **22:00 KST 이전** 최신 회차 당첨번호 및 당첨금 자동 업데이트 성공률 **99.9%**

### 7.2 3단계 출시 로드맵 (Release Roadmap)

| 단계 | 목표 일정 | 핵심 구현 범위 (Deliverables) |
| :--- | :--- | :--- |
| **Phase 1: MVP 출시** | D+1 ~ D+2주 | • 제1~1,250회 시드 데이터 구축 및 GitHub Actions 주간 자동수집 파이프라인 가동<br>• 보너스 포함/미포함 토글형 통계 대시보드 + 오픈 레시피 가중치 번호 생성기 + 1,250회 즉시 백테스팅 |
| **Phase 2: 리텐션 강화** | D+3 ~ D+4주 | • `IndexedDB` 무가입 번호 보관함 및 추첨 후 자동 채점기<br>• 비인기 조합(독식 기댓값) 스코어링 엔진 + 세후 실수령액 계산기 + 45×45 동반출현 매트릭스 |
| **Phase 3: 모바일 확장** | D+5 ~ D+6주 | • PWA(Progressive Web App) 설치 지원 및 토요일 추첨 결과 Web Push 알림<br>• 모바일 웹 카메라 QR 스캐너 및 주간 전체 생성 조합 당첨 성적 투명 공시 보드 |
