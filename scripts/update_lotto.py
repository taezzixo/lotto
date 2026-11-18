#!/usr/bin/env python3
"""로또 6/45 데이터 수집 ETL (1등 데이터 전용, 표준 라이브러리만 사용).

소스
  공식  : 동행복권 개편 후 JSON 엔드포인트 /lt645/selectPstLt645InfoNew.do
          (LOTTO_OFFICIAL_BASE 환경변수로 국내 릴레이 주소로 바꿀 수 있음)
  미러  : smok95 GitHub Pages, Testrapod/lottoworld, gerosyab/api (서로 독립적으로 수집된 공개 데이터)

상태
  COMPLETE    공식 응답 또는 미러 2곳 이상 일치 + 1등 집계 완료
  PARTIAL     번호는 확정, 1등 인원·당첨금 집계 대기
  PROVISIONAL 미러 1곳만 응답 (클라이언트에 '잠정' 표시)

사용법
  python scripts/update_lotto.py           # 주간 증분 수집
  python scripts/update_lotto.py --seed    # 1회~최신 전체를 미러 3곳 교차검증으로 재구축
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

DATA_DIR = Path(os.environ.get("LOTTO_DATA_DIR", "public/data"))
DRAWS_PATH = DATA_DIR / "draws.json"
LATEST_PATH = DATA_DIR / "latest.json"

KST = dt.timezone(dt.timedelta(hours=9))
FIRST_DRAW_AT = dt.datetime(2002, 12, 7, 20, 35, tzinfo=KST)  # 제1회 추첨
WEEK = dt.timedelta(days=7)
ZERO_WINNER_CONFIRM_AFTER = dt.timedelta(hours=12)  # 1등 0명(이월)은 추첨 12시간 뒤 확정
SLA_LIMIT = dt.timedelta(hours=36)                   # 추첨 후 36시간 내 미확정이면 실패
UA = "Mozilla/5.0 (compatible; LottoLabBot/2.0)"

OFFICIAL_BASE = (os.environ.get("LOTTO_OFFICIAL_BASE") or "https://www.dhlottery.co.kr").rstrip("/")
OFFICIAL_URL = OFFICIAL_BASE + "/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd={}"
SMOK_URL = "https://smok95.github.io/lotto/results/{}.json"
SMOK_ALL_URL = "https://smok95.github.io/lotto/results/all.json"
TESTRAPOD_URL = "https://raw.githubusercontent.com/Testrapod/lottoworld/main/data/lotto_data_list.json"
GEROSYAB_URL = "https://raw.githubusercontent.com/gerosyab/api/main/lotto/win_result.json"

KEY_FIELDS = ("nums", "bonus", "date")              # 번호 동일성 판정
FIRST_FIELDS = ("winners", "prize")                 # 1등 집계 동일성 판정


class SourceError(Exception):
    """소스 접근 실패·형식 오류 → 다음 소스로 넘어감."""


class NotYetDrawn(Exception):
    """해당 회차가 아직 발표되지 않음."""


class ValidationError(Exception):
    """데이터 정합성 위반 → 파이프라인 중단(데이터 미반영) + 알림."""


# ------------------------------------------------------------------ HTTP
class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # 차단 시 에러 페이지로 302 → 실패로 취급
        return None


_opener = build_opener(_NoRedirect)


def http_get(url: str, timeout: int = 15, retries: int = 3) -> str:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with _opener.open(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", "replace")
        except HTTPError as e:
            if e.code == 404:
                raise SourceError(f"{url}: 404") from e
            last = e
        except Exception as e:  # 타임아웃·연결 거부 등
            last = e
        time.sleep(2 * (attempt + 1))
    raise SourceError(f"{url}: {last}")


def parse_json(text: str, src: str):
    try:
        return json.loads(text)  # Content-Type이 text/html이어도 본문이 JSON일 수 있음
    except json.JSONDecodeError as e:
        raise SourceError(f"{src}: JSON 아님 ({text[:80]!r})") from e


# ------------------------------------------------------------------ 소스 어댑터 → 공통 레코드
def _rec(no, date, nums, bonus, winners, prize, sales, first_type=None) -> dict:
    return {
        "no": int(no), "date": date, "nums": sorted(int(n) for n in nums), "bonus": int(bonus),
        "first": {"winners": int(winners or 0), "prize": int(prize or 0)},
        "sales": int(sales or 0), "firstType": first_type,
    }


def from_official_row(r: dict) -> dict:
    d = str(r["ltRflYmd"])
    return _rec(r["ltEpsd"], f"{d[:4]}-{d[4:6]}-{d[6:]}", [r[f"tm{i}WnNo"] for i in range(1, 7)],
                r["bnsWnNo"], r["rnk1WnNope"], r["rnk1WnAmt"], r["wholEpsdSumNtslAmt"])


def from_dh_legacy(p: dict) -> dict:  # Testrapod 미러가 쓰는 구 API 형식
    return _rec(p["drwNo"], p["drwNoDate"], [p[f"drwtNo{i}"] for i in range(1, 7)], p["bnusNo"],
                p["firstPrzwnerCo"], p["firstWinamnt"], p.get("totSellamnt"))


def from_smok(p: dict) -> dict:
    first = (p.get("divisions") or [{}])[0] or {}
    combo = p.get("winners_combination") or None
    ftype = ({"auto": combo.get("auto", 0), "semi": combo.get("semi_auto", 0),
              "manual": combo.get("manual", 0)} if combo else None)
    return _rec(p["draw_no"], p["date"][:10], p["numbers"], p["bonus_no"],
                first.get("winners"), first.get("prize"), p.get("total_sales_amount"), ftype)


def from_gerosyab(row: dict) -> dict:
    return _rec(row["drwNo"], row["drwNoDate"], [row[f"drwtNo{i}"] for i in range(1, 7)], row["bnusNo"],
                row["firstPrzwnerCo"], row["firstWinamnt"], None)


def fetch_official(no: int) -> dict:
    body = parse_json(http_get(OFFICIAL_URL.format(no)), "official")
    rows = (body.get("data") or {}).get("list") if isinstance(body, dict) else None
    if not isinstance(rows, list):
        raise SourceError("official: data.list 없음")
    for r in rows:
        if int(r.get("ltEpsd", -1)) == no:
            return from_official_row(r)
    if rows and max(int(r["ltEpsd"]) for r in rows) < no:
        raise NotYetDrawn()
    raise SourceError(f"official: 응답에 {no}회 없음")


def fetch_smok(no: int) -> dict:
    try:
        return from_smok(parse_json(http_get(SMOK_URL.format(no), retries=2), "smok95"))
    except SourceError as e:
        if str(e).endswith("404"):
            raise NotYetDrawn() from e
        raise


_list_cache: dict[str, dict[int, dict]] = {}


def _full_list(name: str) -> dict[int, dict]:
    if name not in _list_cache:
        if name == "testrapod":
            rows = [from_dh_legacy(p) for p in parse_json(http_get(TESTRAPOD_URL), name)]
        elif name == "gerosyab":
            g = parse_json(http_get(GEROSYAB_URL), name)
            rows = [from_gerosyab(dict(zip(g["keys"], r))) for r in g["data"]]
        else:  # smok95 전체
            rows = [from_smok(p) for p in parse_json(http_get(SMOK_ALL_URL, timeout=30), name)]
        _list_cache[name] = {r["no"]: r for r in rows}
    return _list_cache[name]


def _from_list(name: str):
    def fetch(no: int) -> dict:
        rows = _full_list(name)
        if no not in rows:
            raise NotYetDrawn()
        return rows[no]
    return fetch


OFFICIAL = [("dhlottery", fetch_official)]
MIRRORS = [("smok95", fetch_smok), ("testrapod", _from_list("testrapod")), ("gerosyab", _from_list("gerosyab"))]
DOWN: set[str] = set()  # 서킷 브레이커: 이번 실행에서 실패한 소스는 다시 호출하지 않음


# ------------------------------------------------------------------ 검증·병합
def expected_date(no: int) -> str:
    return (FIRST_DRAW_AT + WEEK * (no - 1)).date().isoformat()


def validate(rec: dict, prev_no: int | None) -> None:
    nums, bonus = rec["nums"], rec["bonus"]
    if len(nums) != 6 or len(set(nums)) != 6:
        raise ValidationError(f"{rec['no']}회: 번호 6개·중복 없음 위반 {nums}")
    if not all(1 <= n <= 45 for n in nums + [bonus]) or bonus in nums:
        raise ValidationError(f"{rec['no']}회: 범위(1~45) 또는 보너스 중복 위반")
    if prev_no is not None and rec["no"] != prev_no + 1:
        raise ValidationError(f"회차 연속성 위반: {prev_no} 다음 {rec['no']}")
    if dt.date.fromisoformat(rec["date"]).weekday() != 5:
        raise ValidationError(f"{rec['no']}회: 추첨일 {rec['date']}이 토요일이 아님")
    if rec["date"] != expected_date(rec["no"]):
        print(f"::warning::{rec['no']}회 추첨일 {rec['date']} ≠ 예상 {expected_date(rec['no'])} (휴회 여부 확인)")


def _key(r: dict) -> tuple:
    return tuple(json.dumps(r[f]) for f in KEY_FIELDS)


def _first_final(r: dict, now: dt.datetime) -> bool:
    w, p = r["first"]["winners"], r["first"]["prize"]
    if w > 0 and p > 0:
        return True
    drawn_at = FIRST_DRAW_AT + WEEK * (r["no"] - 1)
    return w == 0 and now - drawn_at >= ZERO_WINNER_CONFIRM_AFTER  # 1등 0명(이월) 확정


def merge_mirrors(no: int, recs: dict[str, dict], now: dt.datetime) -> dict:
    """미러 레코드 다수결. 2곳 이상 일치해야 확정."""
    groups = Counter(_key(r) for r in recs.values())
    (top_key, votes), *others = groups.most_common()
    if others and others[0][1] == votes:
        raise ValidationError(f"{no}회 미러 간 번호 불일치(다수결 불가): { {k: v['nums'] for k, v in recs.items()} }")
    agree = {k: r for k, r in recs.items() if _key(r) == top_key}
    for k in recs.keys() - agree.keys():
        print(f"::warning::{no}회 {k} 미러 번호가 다수와 다름 → 제외")
    base = next((r for r in agree.values() if r["sales"] > 0), next(iter(agree.values())))
    rec = json.loads(json.dumps(base))
    rec["firstType"] = next((r["firstType"] for r in agree.values() if r["firstType"]), None)
    rec["sales"] = max(r["sales"] for r in agree.values())
    firsts = {tuple(r["first"][f] for f in FIRST_FIELDS) for r in agree.values()}
    if len(agree) < 2:
        rec["status"] = "PROVISIONAL"
    elif len(firsts) == 1 and rec["sales"] > 0 and _first_final(rec, now):
        rec["status"] = "COMPLETE"
    else:
        rec["status"] = "PARTIAL"
    rec["source"] = "mirror:" + "+".join(sorted(agree))
    return rec


def collect(no: int, now: dt.datetime) -> dict | None:
    official = None
    for name, fn in OFFICIAL:
        if name in DOWN:
            continue
        try:
            official = fn(no) | {"source": name}
            break
        except NotYetDrawn:
            return None
        except SourceError as e:
            DOWN.add(name)
            print(f"::notice::{name} 실패 → {e}")

    mirrors: dict[str, dict] = {}
    for name, fn in MIRRORS:
        if name in DOWN or (official and mirrors):  # 공식이 있으면 미러는 1곳만 대조
            continue
        try:
            mirrors[name] = fn(no)
        except NotYetDrawn:
            pass
        except SourceError as e:
            DOWN.add(name)
            print(f"::notice::{name} 실패 → {e}")

    if official:
        for name, m in mirrors.items():
            if _key(m) != _key(official):
                print(f"::warning::{no}회 공식과 {name} 미러 번호 불일치 → 공식 값 사용")
            elif not official["firstType"]:
                official["firstType"] = m["firstType"]  # 1등 자동/수동 인원 보강
        if not official["firstType"] and "smok95" not in DOWN:
            try:
                official["firstType"] = fetch_smok(no)["firstType"]
            except (SourceError, NotYetDrawn):
                pass
        official["status"] = "COMPLETE" if official["sales"] > 0 and _first_final(official, now) else "PARTIAL"
        return official
    if not mirrors:
        return None
    return merge_mirrors(no, mirrors, now)


# ------------------------------------------------------------------ 파일 입출력
def latest_drawn_round(now: dt.datetime) -> int:
    """현재 시각 기준 추첨이 끝났어야 하는 마지막 회차."""
    return (now - FIRST_DRAW_AT) // WEEK + 1


def load() -> list[dict]:
    return json.loads(DRAWS_PATH.read_text("utf-8")) if DRAWS_PATH.exists() else []


def save(draws: list[dict], now: dt.datetime) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    body = "[\n" + ",\n".join(json.dumps(d, ensure_ascii=False, separators=(",", ":")) for d in draws) + "\n]\n"
    if DRAWS_PATH.exists() and DRAWS_PATH.read_text("utf-8") == body:
        return  # 변경 없음 → 커밋도 없음
    DRAWS_PATH.write_text(body, "utf-8")
    latest = draws[-1]
    LATEST_PATH.write_text(json.dumps({
        "latest": latest,
        "count": len(draws),
        "nextRound": latest["no"] + 1,
        "nextDrawAt": (FIRST_DRAW_AT + WEEK * latest["no"]).isoformat(),
        "updatedAt": now.isoformat(timespec="seconds"),
    }, ensure_ascii=False, indent=1) + "\n", "utf-8")


# ------------------------------------------------------------------ 실행 모드
def seed(now: dt.datetime) -> list[dict]:
    """미러 3곳 전체 목록을 회차별로 교차검증해 1회~최신을 구축한다. 3곳 모두 일치해야 통과."""
    lists = {name: _full_list(name) for name in ("smok95", "testrapod", "gerosyab")}
    last = min(max(rows) for rows in lists.values())
    draws: list[dict] = []
    for no in range(1, last + 1):
        recs = {name: rows[no] for name, rows in lists.items() if no in rows}
        if len(recs) < 3 or len({_key(r) for r in recs.values()}) != 1:
            raise ValidationError(f"시드 {no}회: 미러 3곳 불일치 또는 누락 {list(recs)}")
        firsts = {tuple(r["first"][f] for f in FIRST_FIELDS) for r in recs.values()}
        sales = {r["sales"] for r in recs.values() if r["sales"]}
        if len(firsts) != 1 or len(sales) != 1:
            raise ValidationError(f"시드 {no}회: 1등 인원·당첨금·판매액 불일치 {firsts} {sales}")
        rec = merge_mirrors(no, recs, now)
        rec["source"] = "seed:" + "+".join(sorted(recs))
        validate(rec, draws[-1]["no"] if draws else None)
        draws.append(rec)
    print(f"시드 구축: 1~{last}회, 미러 3곳 전 필드 일치")
    return draws


def run(now: dt.datetime, do_seed: bool = False, max_recheck: int = 30) -> int:
    draws = seed(now) if do_seed else load()
    for i, d in enumerate(draws):
        validate(d, draws[i - 1]["no"] if i else None)

    # 1) 미확정 회차 재수집(최신순, 상한 max_recheck)
    pending = [i for i in reversed(range(len(draws))) if draws[i]["status"] != "COMPLETE"][:max_recheck]
    for i in pending:
        rec = collect(draws[i]["no"], now)
        if rec and _key(rec) != _key(draws[i]) and draws[i]["status"] != "PROVISIONAL":
            raise ValidationError(f"{rec['no']}회 저장된 번호와 새 수집 번호가 다름 → 수동 검토 필요")
        if rec:
            draws[i] = rec
        time.sleep(0.3)

    # 2) 신규 회차 수집
    target = latest_drawn_round(now)
    while (draws[-1]["no"] if draws else 0) < target:
        no = (draws[-1]["no"] if draws else 0) + 1
        rec = collect(no, now)
        if rec is None:
            break
        validate(rec, draws[-1]["no"] if draws else None)
        draws.append(rec)
        print(f"{no}회 수집: {rec['nums']}+{rec['bonus']} 1등 {rec['first']['winners']}명 [{rec['status']}/{rec['source']}]")

    if draws:
        save(draws, now)

    # 3) SLA: 추첨 후 36시간이 지났는데 미수집·미확정이면 실패(→ 이슈 알림)
    last_due = FIRST_DRAW_AT + WEEK * (target - 1)
    behind = not draws or draws[-1]["no"] < target or draws[-1]["status"] != "COMPLETE"
    if behind and now - last_due > SLA_LIMIT:
        print(f"::error::{target}회 데이터가 SLA(추첨 후 36시간) 내에 확정되지 않았습니다")
        return 1
    return 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", action="store_true", help="1회~최신을 미러 3곳 교차검증으로 재구축")
    ap.add_argument("--max-recheck", type=int, default=30, help="실행당 미확정 회차 재수집 상한")
    args = ap.parse_args()
    try:
        sys.exit(run(dt.datetime.now(KST), args.seed, args.max_recheck))
    except ValidationError as e:
        print(f"::error::{e}")
        sys.exit(2)


if __name__ == "__main__":
    main()
