# 로또랩 디자인 시스템 규칙

디자인 방향: **「용지와 공」**. 로또를 사 본 사람이면 누구나 아는 두 물건에서 가져왔습니다.

1. **마킹 용지**: 분홍 잉크로 인쇄된 한 줄 7칸 번호 격자, 그리고 컴퓨터용 펜으로 칠한 표시. 통계 히트맵과 번호 직접 입력이 같은 격자를 씁니다. 빈도는 펜 마킹의 진하기로 표현합니다.
2. **추첨 공**: 방송 추첨기의 광택 있는 공. 공식 공 색(1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록)은 **당첨번호와 내 번호를 보여 줄 때만** 씁니다.

대담함은 첫 화면의 큰 공 일곱 개(한 번 떨어지는 등장 움직임)에만 씁니다. 나머지는 조용한 용지 면으로 둡니다. 2026-11-18 작성.

## 1. 토큰 정의

**위치**: `src/styles.css` 맨 위 `:root` 블록 한 곳. 라이트가 기본이고, 다크는 `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])`와 `:root[data-theme='dark']` 두 곳에 같은 값을 다시 정의합니다. 컴포넌트는 토큰만 참조하고 색 값을 직접 쓰지 않습니다.

| 그룹 | 토큰 | 라이트 | 다크 | 쓰임 | 쓰지 말 곳 |
| --- | --- | --- | --- | --- | --- |
| 바탕 | `--bg` `--surface` `--surface-2` | 감열지 회백 `#eceef5` / 용지 `#fff` / `#f5f6fb` | 추첨 스튜디오 밤 `#0b0f22` / `#141a35` / `#1a2142` | 면의 깊이: bg < surface-2 < surface | 글자 |
| 선 | `--line` `--line-strong` | `#d9dcea` `#b9bed6` | `#283058` `#3a4475` | 테두리, 격자선, 입력칸(3:1) | |
| 글자 | `--ink` `--ink-2` `--muted` | `#161b3a` 계열 | `#eceefa` 계열 | 본문 / 보조 / 설명 | 큰 면 채우기 |
| 펜 마킹 | `--mark-rgb` | 잉크와 같은 남색 | 밝은 회백 | 격자 히트맵 진하기 `rgba(var(--mark-rgb), a)` | |
| 분홍 잉크 | `--slip` `--slip-hi` `--slip-lo` `--slip-ink` `--slip-soft` | `#cf2f68` | `#ff5c93` | 주 버튼, 선택 상태, 용지 격자, 탭 강조, 포커스 링 | 차트 외 장식 그라데이션 |
| 당첨 | `--win` `--win-soft` | `#1d7f52` | `#5fd39a` | 등수 배지, 축하 문구 — **항상 글자와 함께** | 차트 계열색 |
| 공 | `--ball-1`~`--ball-5` + `-ink` | 공식 공 색 | 회색만 약간 어둡게 | `Ball` 컴포넌트만 | 버튼·배경·차트 |
| 차트 | `--series-1` `--series-2` `--series-3` | `#cf2f68` `#2a6fd6` `#c98a00` | `#e8487f` `#4a84e8` `#b57f0c` | 차트 데이터 표시만 | 버튼·글자 |

- 차트 3색은 dataviz 검증 스크립트를 통과했습니다(라이트·다크 모두 CVD 구분 ΔE ≥ 9.9). 라이트의 `--series-3`은 배경 대비가 3:1에 조금 못 미치므로 범례에 값을 직접 적습니다.
- **글꼴**: 한글 `Gothic A1`(본문·제목), 숫자 `Archivo`(공 번호, 카운트다운, 큰 지표 — 폭 75~85%로 좁혀 씀). Google Fonts `<link>`(index.html), 대체 글꼴 스택 필수.
- **글자 크기**: `--step--1`~`--step-5`(비율 1.25, 기준 15px).
- **모서리**: 격자 칸 4px, 버튼 10px, 면 18px, 공·탭 스캔 버튼은 원. 같은 모서리를 모든 곳에 쓰지 않습니다(위계 표시).
- **움직임**: `--dur-press` 140ms(누름), `--dur-ui` 200ms(상태 변화). 자동 움직임은 첫 화면 공 떨어짐 한 번뿐이며 `prefers-reduced-motion`이면 끕니다.

## 2. 컴포넌트

**위치**: `src/components/*.tsx`. 화면 단위 하나에 파일 하나. 계산은 `src/lib/*.ts` 순수 함수(단위 테스트)로 분리하고 컴포넌트는 표시만 합니다.

| 컴포넌트 | 역할 | 주요 클래스 |
| --- | --- | --- |
| `Ball.tsx` | 추첨 공, 내 번호 대조 표시(`MatchBalls`: 일치=색, 불일치=흐림, 보너스 일치=분홍 고리), 당첨번호+보너스(`DrawBalls`) | `.ball.g1~g5` `.miss` `.bonus-hit` `.balls` |
| `Slip.tsx` | 마킹 용지 격자(7칸). `heat` 모드 = 진하기, `pick` 모드 = 번호 고르기(`aria-pressed`) | `.slip` `.cell` `.mark` `.slip-legend` |
| `Charts.tsx` | SVG 막대 차트(px 단위로 그려 글자 크기 유지), 기준값 표시선(`marker`), 기준선(`refLine`, 범례로 설명), 신뢰구간, 키보드 ←→ 탐색, 툴팁 문장 | `.chart` `.legend` `.tip` |
| `Home.tsx` | 최신 회차 무대, 카운트다운, 이번 주 내 복권, 최근 회차 | `.stage` `.countdown` `.mini-list` |
| `Stats.tsx` | 구간·보너스 필터, 격자 히트맵 + 번호 상세, 순위, 번호대, 1등 데이터 | `.filters` `.seg` `.detail` `.rank-cols` `.stats` |
| `Scan.tsx` | 카메라 QR, 사진·링크·직접 입력 | `.scanner` `.frame` `.alt-actions` |
| `Analysis.tsx` | 전략 4종 분석 번호, 주간 적중 기록·비교 | `.verdict` `table.data` |
| `Records.tsx` | 운 지수, 일치 분포, 저장한 복권, 백업 | `.luck` `.round-group` `.ticket` |
| `ResultSheet.tsx` | 스캔 직후 결과 시트, 추첨 뒤 새 결과 알림 | `.overlay` `.result` `.game-rows` `.celebrate` |
| `Icons.tsx` | 인라인 SVG 아이콘(`currentColor`), 로고 | — |

공통 패턴
- **면**: `.sheet`(용지 흰 면 + 얇은 선 + 아래 그림자). 한 덩어리 내용에만 씁니다.
- **버튼**: `.btn`(분홍) / `.btn.ghost`(선) / `.btn.big`(엄지 영역 큰 동작). 선택 상태는 `aria-pressed`, 현재 탭은 `aria-current="page"`.
- **배지**: `.badge`(기본) / `.badge.win`(당첨) / `.badge.pending`(대기·잠정). ⚠️ `.slip`은 격자 전용 클래스이므로 수식어로 쓰지 않습니다(이름 충돌 사례 있음).

## 3. 프레임워크·도구

- React 18 + TypeScript(strict) + Vite 5. 런타임 의존성은 `react`, `react-dom`, `jsqr`(iOS 사파리용 QR 판독, 스캔 시 지연 로드)뿐입니다.
- 스타일: 전역 CSS 한 파일(`src/styles.css`) + CSS 사용자 정의 속성. CSS-in-JS·Tailwind 없음.
- 차트: SVG 직접 구현. 새 의존성은 사용자 확인 후 추가합니다.
- 테스트: `node --test`(TS 그대로 실행) + Python `unittest`. 화면은 Playwright 스크린샷(라이트·다크·390px·1280px)으로 확인합니다.

## 4. 에셋·아이콘

- 이미지 에셋 없음. 공·로고·아이콘은 CSS 그라데이션과 인라인 SVG로 그립니다. 동행복권 로고·상표는 쓰지 않습니다.
- **이모지를 아이콘으로 쓰지 않습니다.** 새 아이콘은 `currentColor` 인라인 SVG, 장식이면 `aria-hidden`.

## 5. 스타일 방식

- 짧은 의미 클래스 + 상태 클래스(`.miss`, `.hit`) + ARIA 상태(`[aria-pressed]`, `[aria-current]`). 선택자 깊이 2단계 이내.
- 전역: `word-break: keep-all`, `accent-color: var(--slip)`, `:focus-visible` 분홍 링.
- 반응형: 모바일 기준 + `@media (min-width: 900px)`에서 2열(`.grid-2`). 좌우 여백 `max(16px, env(safe-area-inset-*))`, 가로 스크롤 금지(표는 `.table-wrap` 안에서만).
- 하단 탭 바: 5칸, 가운데 QR 채점 버튼이 가장 큼(엄지 영역). 결과 시트가 열리면 토스트는 위로 올라갑니다.
- 접근성: 터치 대상 44px, 대비 4.5:1, 차트는 표 보기·툴팁 문장 제공, 색만으로 정보 전달 금지(공에는 숫자, 당첨에는 글자).
- **쓰지 않는 것**: 대문자 라벨, "A · B · C" 메타 문자열, 모든 블록을 같은 카드로 감싸기, 이모지 아이콘, 차트에 버튼 강조색, 공 색을 장식에 쓰기.

## 6. 출시 전 점검표

- [x] 이모지 아이콘 없음, 클릭 요소 `cursor: pointer`
- [x] 누름 반응 140~200ms, 자동 움직임은 공 떨어짐 한 번
- [x] 라이트·다크 대비, 키보드 포커스 보임
- [x] `prefers-reduced-motion`이면 움직임 끔
- [x] 390 / 1280px 가로 스크롤 없음(Playwright 검사)
- [x] 차트 색은 `--series-*`만, 검증 스크립트 통과
- [ ] 실기기(아이폰 사파리·안드로이드 크롬) 카메라 QR 인식 확인
