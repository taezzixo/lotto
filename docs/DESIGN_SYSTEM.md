# 로또 데이터 실험실 디자인 시스템 규칙

디자인 방향: **「인쇄소의 당첨 장부」**. hallmark 스킬의 **Vellum** 테마(옛 인쇄소: 양피지 바탕, 엄버 잉크, 실선과 이중선, 안료 한 가지)를 바탕으로 2026-11-19 사용자 요청("고풍스럽게")에 맞춰 바꿨습니다. 이전 방향 「용지와 공」(분홍 마킹 용지)은 이 문서로 대체되었습니다.

- 장부: 모든 면은 납작하게 인쇄된 종이입니다. 모서리 2px, 그림자 없음, 깊이는 가는 실선(1px)과 이중선(4px double)으로만 표현합니다.
- 마킹 용지 격자(한 줄 7칸)는 그대로 둡니다. 칸마다 번호, 펜 마킹 진하기(빈도), **출현 횟수 숫자**가 함께 찍힙니다.
- 공식 공 색(1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록)은 번호 표시에만 쓰고, 광택 없이 평판 인쇄처럼 칠합니다.
- 움직임은 거의 없습니다(Vellum: Still). 누름·호버 반응만 160ms.

사용한 Claude 스킬(저장소 `.claude/skills/`, 위스키 도감과 같은 5종): frontend-design, ui-ux-pro-max(디자인 시스템 검색: 버건디·금박 계열 권장), hallmark(Vellum 테마·sloplint), emil-design-eng, web-design-guidelines.

## 1. 토큰

**위치**: `src/styles.css` 맨 위(hallmark 스탬프 주석 다음) `:root`. 라이트가 기본이고, 다크는 `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])`와 `:root[data-theme='dark']` 두 곳에 같은 값을 다시 정의합니다. 컴포넌트는 토큰만 참조합니다(sloplint가 토큰 밖 색 값을 FAIL로 잡음).

| 그룹 | 토큰 | 라이트 (양피지) | 다크 (옥스블러드 반전) | 쓰임 |
| --- | --- | --- | --- | --- |
| 바탕 | `--bg` `--surface` `--surface-2` | `#f3eada` / `#f9f3e8` / `#e9dcc7` | `#490c13` / `#531a1e` / `#5d2729` | 양피지 / 장부 낱장 / 띠·우물 |
| 선 | `--line` `--line-strong` | `#bcab96` / `#3a2d24` | `#793f40` / `#dacfbf` | 실선, 낱장 위 잉크 선, 이중선 |
| 글자 | `--ink` `--ink-2` `--muted` | 엄버 `#261a12` 계열 | 종이색 `#f2eadd` 계열 | 본문 / 보조 / 설명 |
| 안료 | `--accent` `--accent-deep` `--accent-soft` `--accent-ink` | 군청 `#2942ab` | 금박 `#ebc573` | 주 버튼, 선택, 포커스, 큰 지표 숫자, 인장(로고·배지). **안료는 하나** |
| 당첨 | `--win` `--win-soft` | `#2f6b3f` | `#9fd6a6` | 등수 배지·축하 문구(항상 글자와 함께) |
| 공 | `--ball-1`~`--ball-5` + `-ink` | 공식 공 색 | 회색만 밝게 | `Ball`에만 |
| 순위 테두리 | `--rank-top` `--rank-next` | `#c0392b` / `#d9a514` | `#ff6f61` / `#f2c94c` | 출현 1~6위 / 7~10위 칸 테두리 |
| 차트 | `--series-1` `--series-2` `--series-3` | `#3552bc` `#be7c1c` `#98397e` | `#b48c2b` `#6280da` `#b25196` | 차트 데이터만 (dataviz 검증 통과, 다크 3번은 대비 2.94라 범례에 값 직접 표기) |
| 카메라 | `--frame` `--cam-*` | 테마 무관 | 테마 무관 | QR 카메라 화면 |
| 섬유 결 | `--fibre` | 0.5 | 0.25 | `.fibre` 띠(홈 최신 회차)에만 |

**글꼴** (Google Fonts, `index.html`)

| 역할 | 토큰 | 글꼴 | 규칙 |
| --- | --- | --- | --- |
| 큰 제목 | `--font-display` | Grenze Gotisch 600 + 송명(한글) | 30px 이상에서만(화면 제목, 홈 회차 제목) |
| 낱장 제목 | `--font-head` | 송명 | h2·h3, 배지 이름 |
| 큰 숫자 | `--font-figure` | Grenze 400·500 | 당첨금, 카운트다운, 지표, 운 지수 |
| 본문·라벨·표 숫자 | `--font-body` | Hanken Grotesk + Gothic A1(한글) | 표·공 숫자는 고정폭(tabular) |

## 2. 컴포넌트

| 컴포넌트 | 역할 | 주요 클래스 |
| --- | --- | --- |
| `Ball.tsx` | 평판 인쇄 공(광택 없음), 내 번호 대조(일치=색, 불일치=빈 원, 보너스 일치=안료 고리) | `.ball.g1~g5` `.miss` `.bonus-hit` |
| `Slip.tsx` | 마킹 용지 격자 7칸. `heat` 모드는 마킹 진하기 + **칸 아래 출현 횟수**(`.cnt`), `pick` 모드는 번호 고르기 | `.slip` `.cell` `.mark` `.cnt` |
| `Charts.tsx` | SVG 막대 차트. 칸이 좁으면 x축 라벨을 자동으로 건너뜀(9구간 번호대 차트 대응) | `.chart` `.legend` `.tip` |
| `Stats.tsx` | 위에서부터 **출현 순위표 1~45위**(공 색 그대로, 1~6위 붉은 테두리·7~10위 노란 테두리, 같은 횟수는 공동 순위) → 오래 쉰 번호 + 번호 자세히 → **번호대 비중 5개 단위 9구간** | `.rank-grid` `.rank-cell.top/.next` `.gap-row` `.detail` |
| `Home.tsx` | 최신 회차 띠(섬유 결 + 위 이중선) | `.stage.fibre` `.countdown` |
| `Badges.tsx` | 배지: 획득 = 안료 인장, 미획득 = 점선 고리 진행도 | `.badges` `.coin` |
| `ShareCard.tsx` | 공유 카드 PNG: 양피지 낱장 + 위 이중선 + 군청 인장, 테마 무관 | `.share-preview` |
| `Icons.tsx` | 인라인 SVG(`currentColor`, 장식은 `aria-hidden`), 로고 = 안료 인장(테마 색을 따름) | — |

공통 패턴
- **낱장** `.sheet`: 1px 실선 둘레 + 위쪽 1px 잉크 선, 머리 아래 실선. 그림자 없음.
- **이중선**: 상단 머리글 아래, 하단 탭 바 위, 표 머리 아래, 홈 띠 위, 결과 시트 위, 푸터 위.
- **버튼**: `.btn`(안료) / `.btn.ghost`(1px 잉크 테두리). 고르기 `.seg`는 네모 칸을 이어 붙이고 선택 칸만 안료.
- **하단 탭 바**: 화면 폭 전체의 인쇄 띠(넓은 화면은 가운데 560px). 가운데 QR 채점은 네모난 안료 도장.

## 3. 프레임워크·도구

- React 18 + TypeScript + Vite 5, 런타임 의존성 `react` `react-dom` `jsqr`. 스타일은 `src/styles.css` 한 파일.
- 화면 확인: Playwright 스크린샷(390px 라이트·다크, 1280·1480px).
- **디자인 검사**: `node .claude/skills/hallmark/scripts/sloplint.mjs src --genre editorial --scope app` → **FAIL 0** 유지. 면제는 `styles.css` 맨 위 스탬프 아래에 사유와 함께(글꼴 4종: 한글 때문에 송명 필요 — 승인됨).
- 차트 색 바꿀 때: dataviz 검증 스크립트로 라이트(`#f9f3e8`)·다크(`#531a1e`) 표면 기준 통과 확인.

## 4. 에셋

- 이미지는 PWA 아이콘(`public/icons/*.png`, 군청 인장)과 `favicon.svg`뿐. 회차 페이지(`scripts/prerender.mjs`)도 같은 색·글꼴.
- 이모지를 아이콘으로 쓰지 않습니다. 동행복권 로고·상표는 쓰지 않습니다.

## 5. 쓰지 않는 것

광택·그라데이션 공, 둥근 알약 버튼, 카드 그림자, 두 번째 안료, 양피지 위 옥스블러드 안료(옥스블러드는 다크 바탕만), 찢긴 종이·얼룩·불탄 자국 같은 장식, 대문자 라벨, "A · B" 메타 문자열, 공 색을 장식에 쓰기, Grenze Gotisch를 30px 미만이나 문단에 쓰기.

## 6. 출시 전 점검표

- [x] sloplint FAIL 0
- [x] 390 / 1280 / 1480px 가로 스크롤 없음, 라이트·다크 확인
- [x] 터치 대상 44px, 키보드 포커스(안료 링), `prefers-reduced-motion`
- [x] 차트 색 검증 통과
- [ ] 실기기(아이폰·안드로이드)에서 글꼴 로딩·카메라 확인
