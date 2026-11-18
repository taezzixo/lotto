# 로또 데이터 실험실

종이 로또의 QR을 찍으면 바로 채점하고, 기록이 자동으로 쌓여 「나의 적중률」을 보여 주는 무료·무가입 웹앱입니다. 제1회(2002-12-07)부터 모든 당첨번호와 1등 데이터를 함께 봅니다.

- 홈: 최신 회차, 다음 추첨 카운트다운, 이번 주 내 복권
- 통계: 마킹 용지 격자 히트맵, 번호 순위, 1등 당첨자·당첨금·인기도 지수
- QR 채점: 카메라·사진·링크·직접 입력, 자동 저장, 중복 방지
- 적중 기록: 분석 번호 4가지 방법을 매주 실제 당첨번호와 대조한 1,230주 기록
- 내 기록: 운 지수, 운 백분위, 일치 분포, 백업

> 로또 추첨은 매번 독립적이며 1등 확률은 언제나 8,145,060분의 1입니다. 이 서비스의 통계와 분석은 당첨 확률을 높이지 않습니다. 동행복권과 관계없는 비공식 서비스입니다.

## 시작

```bash
npm ci
npm run dev
```

## 검사·빌드

```bash
npm test
npm run build
```

## 데이터

`public/data/draws.json`은 GitHub Actions(`.github/workflows/deploy.yml`)가 매주 토요일 밤 갱신합니다. 출처와 검증 규칙은 `docs/PRD.md` §9, 구성은 `docs/ARCHITECTURE.md`를 봅니다.

## 배포

Cloudflare Workers 정적 자산(`wrangler.jsonc`). Cloudflare에서 저장소를 연결하고 빌드 명령 `npm run build`, 배포 명령 `npx wrangler deploy`를 설정하면 `main` 푸시마다 자동 배포됩니다.

## 문서

`docs/PRD.md`(요구사항), `docs/ARCHITECTURE.md`(구성도), `docs/DESIGN_SYSTEM.md`(디자인), `docs/HANDOFF.md`(인계), `docs/API_KEYS.md`(키 목록), `docs/PLAN_ORIGINAL.md`(최초 기획서)
