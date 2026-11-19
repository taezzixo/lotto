"""update_lotto.py 오프라인 단위 테스트 + 저장된 데이터 무결성 테스트.

실행: python -m unittest discover -s scripts -v
"""
import datetime as dt
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import update_lotto as U

U.time.sleep = lambda s: None
REPO_DATA = Path(__file__).resolve().parent.parent / "public" / "data" / "draws.json"


def draw_at(no: int) -> dt.datetime:
    return U.FIRST_DRAW_AT + U.WEEK * (no - 1)


def official_row(no, nums, bonus, winners=10, prize=2_000_000_000, sales=10**11):
    d = draw_at(no).strftime("%Y%m%d")
    row = {"ltEpsd": no, "ltRflYmd": d, "bnsWnNo": bonus, "rnk1WnNope": winners,
           "rnk1WnAmt": prize, "wholEpsdSumNtslAmt": sales}
    row.update({f"tm{i + 1}WnNo": n for i, n in enumerate(nums)})
    return row


def smok_payload(no, nums, bonus, winners=10, prize=2_000_000_000):
    return {"draw_no": no, "numbers": nums, "bonus_no": bonus, "date": draw_at(no).date().isoformat() + "T00:00:00Z",
            "divisions": [{"prize": prize, "winners": winners}], "total_sales_amount": 10**11,
            "winners_combination": {"auto": 7, "semi_auto": 1, "manual": 2}}


class FakeSources:
    """URL → 응답 매핑으로 http_get을 대체."""

    def __init__(self):
        self.official = {}   # no -> row
        self.smok = {}       # no -> payload
        self.testrapod = []  # legacy payloads
        self.gerosyab = []   # rows
        self.down = set()

    def __call__(self, url, timeout=15, retries=3):
        if "dhlottery" in url:
            if "official" in self.down:
                raise U.SourceError("timed out")
            no = int(url.rsplit("=", 1)[1])
            rows = [self.official[n] for n in sorted(self.official) if abs(n - no) <= 2]
            return json.dumps({"data": {"list": rows}})
        if "smok95" in url:
            if "smok95" in self.down:
                raise U.SourceError("down")
            no = int(url.rsplit("/", 1)[1].split(".")[0])
            if no not in self.smok:
                raise U.SourceError(url + ": 404")
            return json.dumps(self.smok[no])
        if "Testrapod" in url:
            return json.dumps(self.testrapod)
        if "gerosyab" in url:
            keys = ["drwNo", "drwNoDate", "firstPrzwnerCo", "firstWinamnt"] + [f"drwtNo{i}" for i in range(1, 7)] + ["bnusNo"]
            return json.dumps({"keys": keys, "data": [[r[k] for k in keys] for r in self.gerosyab]})
        raise U.SourceError("unknown " + url)


def legacy(no, nums, bonus, winners=10, prize=2_000_000_000):
    p = {"drwNo": no, "drwNoDate": draw_at(no).date().isoformat(), "bnusNo": bonus, "firstPrzwnerCo": winners,
         "firstWinamnt": prize, "totSellamnt": 10**11}
    p.update({f"drwtNo{i + 1}": n for i, n in enumerate(nums)})
    return p


class CollectTests(unittest.TestCase):
    def setUp(self):
        self.src = FakeSources()
        U.http_get = self.src
        U.DOWN.clear()
        U._list_cache.clear()
        self.no = 1251
        self.nums, self.bonus = [3, 9, 17, 22, 38, 44], 12
        self.after = draw_at(self.no) + dt.timedelta(minutes=40)
        self.out = io.StringIO()

    def collect(self, now=None):
        with redirect_stdout(self.out):
            return U.collect(self.no, now or self.after)

    def test_official_complete_with_first_type_backfill(self):
        self.src.official[self.no] = official_row(self.no, self.nums, self.bonus)
        self.src.smok[self.no] = smok_payload(self.no, self.nums, self.bonus)
        r = self.collect()
        self.assertEqual((r["status"], r["source"]), ("COMPLETE", "dhlottery"))
        self.assertEqual(r["firstType"], {"auto": 7, "semi": 1, "manual": 2})
        self.assertEqual(r["date"], draw_at(self.no).date().isoformat())

    def test_official_not_yet_drawn(self):
        self.src.official[self.no - 1] = official_row(self.no - 1, self.nums, self.bonus)
        self.assertIsNone(self.collect())

    def test_official_partial_then_zero_winner_confirmed(self):
        self.src.official[self.no] = official_row(self.no, self.nums, self.bonus, winners=0, prize=0)
        self.assertEqual(self.collect()["status"], "PARTIAL")
        U.DOWN.clear()
        self.assertEqual(self.collect(draw_at(self.no) + dt.timedelta(hours=13))["status"], "COMPLETE")

    def test_official_down_two_mirrors_agree(self):
        self.src.down.add("official")
        self.src.smok[self.no] = smok_payload(self.no, self.nums, self.bonus)
        self.src.testrapod = [legacy(self.no, self.nums, self.bonus)]
        r = self.collect()
        self.assertEqual((r["status"], r["source"]), ("COMPLETE", "mirror:smok95+testrapod"))

    def test_official_down_single_mirror_is_provisional(self):
        self.src.down.update({"official", "smok95"})
        self.src.testrapod = [legacy(self.no, self.nums, self.bonus)]
        self.assertEqual(self.collect()["status"], "PROVISIONAL")

    def test_mirror_majority_wins(self):
        self.src.down.add("official")
        self.src.smok[self.no] = smok_payload(self.no, self.nums, self.bonus)
        self.src.testrapod = [legacy(self.no, self.nums, self.bonus)]
        self.src.gerosyab = [legacy(self.no, [1, 2, 3, 4, 5, 6], self.bonus)]
        r = self.collect()
        self.assertEqual(r["nums"], self.nums)

    def test_mirror_tie_raises(self):
        self.src.down.update({"official", "smok95"})
        self.src.testrapod = [legacy(self.no, self.nums, self.bonus)]
        self.src.gerosyab = [legacy(self.no, [1, 2, 3, 4, 5, 6], self.bonus)]
        with self.assertRaises(U.ValidationError):
            self.collect()

    def test_mirrors_disagree_on_first_prize_is_partial(self):
        self.src.down.add("official")
        self.src.smok[self.no] = smok_payload(self.no, self.nums, self.bonus, winners=0, prize=0)
        self.src.testrapod = [legacy(self.no, self.nums, self.bonus)]
        self.assertEqual(self.collect()["status"], "PARTIAL")


class RunTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        U.DATA_DIR = Path(self.tmp.name)
        U.DRAWS_PATH = U.DATA_DIR / "draws.json"
        U.LATEST_PATH = U.DATA_DIR / "latest.json"
        self.src = FakeSources()
        U.http_get = self.src
        U.DOWN.clear()
        U._list_cache.clear()
        nums = [[1, 2, 3, 4, 5, 6 + i] for i in range(3)]
        self.src.testrapod = [legacy(n + 1, nums[n], 45) for n in range(3)]
        self.src.gerosyab = list(self.src.testrapod)
        for n in range(3):
            self.src.smok[n + 1] = smok_payload(n + 1, nums[n], 45)
        self.src.down.add("official")

    def tearDown(self):
        self.tmp.cleanup()

    def run_etl(self, now, seed=False):
        with redirect_stdout(io.StringIO()):
            return U.run(now, do_seed=seed)

    def test_seed_then_incremental_and_sla(self):
        # smok95 전체 목록은 per-draw payload 목록으로 제공
        self.src.smok_all = [self.src.smok[n] for n in sorted(self.src.smok)]
        orig = self.src.__call__

        def get(url, timeout=15, retries=3):
            if url == U.SMOK_ALL_URL:
                return json.dumps(self.src.smok_all)
            return orig(url, timeout, retries)
        U.http_get = get

        self.assertEqual(self.run_etl(draw_at(3) + dt.timedelta(days=1), seed=True), 0)
        draws = json.loads(U.DRAWS_PATH.read_text())
        self.assertEqual([d["no"] for d in draws], [1, 2, 3])
        self.assertTrue(all(d["status"] == "COMPLETE" for d in draws))

        # 4회: 아직 어느 소스에도 없음 → 추첨 직후엔 정상(0), 36시간 후엔 SLA 실패(1)
        U.DOWN.clear(); U._list_cache.clear()
        self.assertEqual(self.run_etl(draw_at(4) + dt.timedelta(hours=1)), 0)
        U.DOWN.clear(); U._list_cache.clear()
        self.assertEqual(self.run_etl(draw_at(4) + dt.timedelta(hours=37)), 1)

        # 공식 복구 → 4회 COMPLETE
        self.src.down.discard("official")
        self.src.official[4] = official_row(4, [7, 8, 9, 10, 11, 12], 45)
        U.DOWN.clear(); U._list_cache.clear()
        self.assertEqual(self.run_etl(draw_at(4) + dt.timedelta(hours=38)), 0)
        latest = json.loads(U.LATEST_PATH.read_text())
        self.assertEqual((latest["latest"]["no"], latest["latest"]["status"], latest["nextRound"]), (4, "COMPLETE", 5))



class VerifyLatestTests(unittest.TestCase):
    def setUp(self):
        self.src = FakeSources()
        U.http_get = self.src
        U.DOWN.clear()
        self.nums, self.bonus = [3, 9, 17, 22, 38, 44], 12
        self.no = 1251
        self.stored = [U._rec(self.no, draw_at(self.no).date().isoformat(), self.nums, self.bonus, 10, 2_000_000_000, 10**11) | {"status": "COMPLETE", "source": "dhlottery"}]
        self.now = draw_at(self.no) + dt.timedelta(days=2)

    def verify(self):
        with redirect_stdout(io.StringIO()):
            return U.verify_latest(self.stored, self.now)

    def test_official_matches(self):
        self.src.official[self.no] = official_row(self.no, self.nums, self.bonus)
        self.assertIn("정상", self.verify())

    def test_first_prize_correction_applied(self):
        self.src.official[self.no] = official_row(self.no, self.nums, self.bonus, winners=11, prize=1_900_000_000)
        self.verify()
        self.assertEqual(self.stored[-1]["first"], {"winners": 11, "prize": 1_900_000_000})

    def test_number_mismatch_raises(self):
        self.src.official[self.no] = official_row(self.no, [1, 2, 3, 4, 5, 6], self.bonus)
        with self.assertRaises(U.ValidationError):
            self.verify()

    def test_official_down_is_reported_not_fatal(self):
        self.src.down.add("official")
        self.assertIn("실패", self.verify())


class StoredDataTests(unittest.TestCase):
    """커밋된 public/data/draws.json 무결성."""

    @classmethod
    def setUpClass(cls):
        cls.draws = json.loads(REPO_DATA.read_text("utf-8"))

    def test_continuous_from_round_1(self):
        self.assertEqual([d["no"] for d in self.draws], list(range(1, len(self.draws) + 1)))
        self.assertGreaterEqual(len(self.draws), 1250)
        with redirect_stdout(io.StringIO()):
            for i, d in enumerate(self.draws):
                U.validate(d, self.draws[i - 1]["no"] if i else None)

    def test_known_draws(self):
        by = {d["no"]: d for d in self.draws}
        self.assertEqual((by[1]["nums"], by[1]["bonus"], by[1]["date"]), ([10, 23, 29, 33, 37, 40], 16, "2002-12-07"))
        self.assertEqual((by[1000]["nums"], by[1000]["bonus"], by[1000]["first"]),
                         ([2, 8, 19, 22, 32, 42], 39, {"winners": 22, "prize": 1246819620}))
        self.assertEqual(by[1128]["first"]["winners"], 63)
        self.assertEqual((by[1250]["nums"], by[1250]["bonus"], by[1250]["first"]["winners"]),
                         ([1, 5, 18, 23, 27, 28], 8, 9))

    def test_frequency_matches_published_stats(self):
        """1~1250회 기준 외부 통계와 일치: 보너스 제외 34번 188회 1위, 보너스 포함 27번 217회 1위."""
        upto = [d for d in self.draws if d["no"] <= 1250]
        main = {n: 0 for n in range(1, 46)}
        for d in upto:
            for n in d["nums"]:
                main[n] += 1
        with_bonus = dict(main)
        for d in upto:
            with_bonus[d["bonus"]] += 1
        self.assertEqual(max(main.items(), key=lambda kv: kv[1]), (34, 188))
        self.assertEqual(max(with_bonus.items(), key=lambda kv: kv[1]), (27, 217))
        self.assertEqual((with_bonus[13], with_bonus[34]), (212, 212))

    def test_all_complete(self):
        self.assertTrue(all(d["status"] == "COMPLETE" for d in self.draws[:-1]))


if __name__ == "__main__":
    unittest.main()
