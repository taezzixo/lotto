# CLAUDE.md — 로또 데이터 실험실 작업 가이드

새 대화는 이 파일 → `docs/HANDOFF.md`(다음 할 일) 순서로 읽습니다.

## 무엇인가
종이 로또 QR을 찍으면 바로 채점하고 기록을 쌓아 「나의 적중률」을 보여 주는 무료·무가입 모바일 웹. 통계는 1등 데이터(당첨자 수·당첨금·인기도)에 집중. 구성은 Notion 「[기본 구성도 v1] 시스템 구성도 — 새 대시보드 레퍼런스」를 따름.

## 명령
- `npm run dev` — 개발 서버 (데이터는 `public/data/*.json`)
- `npm test` — 계산 로직(`node --test src/lib/*.test.ts`) + 수집·데이터 무결성(`python3 -m unittest discover -s scripts`)
- `npm run build` — `tsc --noEmit` + `vite build` → `dist/`
- `python3 scripts/update_lotto.py` — 증분 수집, `--seed`는 1회부터 재구축(미러 3곳 교차검증)

## 규칙
- 계산은 `src/lib/*.ts` 순수 함수 + 테스트, 화면은 `src/components/`. TS 파일 import는 `.ts`/`.tsx` 확장자를 붙임(node --test가 그대로 실행).
- 색·글꼴·간격은 `src/styles.css` `:root` 토큰만. 다크는 두 블록(미디어 쿼리·`data-theme`)에 같이 추가. 규칙은 `docs/DESIGN_SYSTEM.md`.
- 디자인은 「인쇄소의 당첨 장부」(hallmark Vellum): 공 색은 번호 표시에만, 안료(라이트 군청·다크 금박)는 주 동작·선택에만, 차트는 `--series-*`만. 모서리 2px·그림자 없음·가는 실선. 글꼴은 Pretendard 하나(위계는 굵기·크기). 이모지 아이콘·"A · B" 메타 문자열·대문자 라벨 금지.
- 디자인 스킬은 `.claude/skills/`(frontend-design, ui-ux-pro-max, hallmark, emil-design-eng, web-design-guidelines). 화면을 바꾸면 `node .claude/skills/hallmark/scripts/sloplint.mjs src --genre editorial --scope app`으로 FAIL 0 유지.
- QR 원문(일련번호 포함)은 저장하지 않음 — `ticketKey()` 해시만.
- 확률 고지(푸터)와 "당첨은 동행복권에서 확인" 안내를 지우지 않음. "확률을 높인다"는 표현 금지.
- 데이터 파일(`public/data`)은 봇이 커밋함. 손으로 고치면 `StoredDataTests`가 깨질 수 있음.
- 런타임 의존성 추가는 사용자 확인 후. 현재 `react`, `react-dom`, `jsqr`, `pretendard`(글꼴).
- 작업 브랜치에서 작업 → 테스트·빌드 통과 → 사용자 허락 후 `main` 반영.

## 기록
GitHub `docs/`와 Notion 「대시보드 v1.0 / [로또 데이터 실험실] (lotto)」에 같은 내용을 둡니다. 문서를 바꾸면 Notion도 갱신하고 `docs/HANDOFF.md`의 업로드 기록을 남깁니다.
