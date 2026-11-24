"""로또 번호 규칙 탐색 — 논리 조건(원자 조건의 AND/OR 조합)으로 '다음 회차에 나올 번호'를 고르는 규칙을 전수·빔 탐색.

정밀도(precision) = 규칙이 고른 번호 중 실제 당첨번호(본번호 6개) 비율. 무작위 기준 6/45 = 13.33%.
학습 구간(101~900회)에서 찾고, 검증 구간(901~최신)에서 다시 잰다. 회차 순서를 섞은 데이터로 같은 탐색을 돌려 우연 수준도 잰다.
"""
import json
import sys
import numpy as np

DRAWS = json.load(open(sys.argv[1]))
if isinstance(DRAWS, dict):
    DRAWS = DRAWS["draws"]
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else -1  # >=0 이면 회차 순서 섞기


def build(draws):
    T = len(draws)
    nums = np.zeros((T, 46), bool)
    bonus = np.zeros((T, 46), bool)
    for i, d in enumerate(draws):
        nums[i, d["nums"]] = True
        bonus[i, d["bonus"]] = True
    feats = {}
    # 누적합으로 창 빈도
    cs = np.vstack([np.zeros((1, 46)), np.cumsum(nums, 0)])  # cs[t] = t회차 이전(인덱스 <t) 합
    bcs = np.vstack([np.zeros((1, 46)), np.cumsum(bonus, 0)])
    idx = np.arange(T)
    for w in (3, 5, 10, 15, 20, 30, 50, 100, 200):
        lo = np.maximum(0, idx - w)
        feats[f"최근{w}회 출현수"] = cs[idx] - cs[lo]
    feats["역대 출현수"] = cs[idx].copy()
    for w in (10, 30):
        lo = np.maximum(0, idx - w)
        feats[f"최근{w}회 보너스 출현수"] = bcs[idx] - bcs[lo]
    # 쉰 회차
    gap = np.zeros((T, 46))
    last = np.full(46, -1)
    for t in range(T):
        gap[t] = np.where(last >= 0, t - last, t + 1)
        last[nums[t]] = t
    feats["쉰 회차"] = gap
    with np.errstate(divide="ignore", invalid="ignore"):
        meangap = np.where(cs[idx] > 0, (idx[:, None] + 1) / np.maximum(cs[idx], 1), idx[:, None] + 1)
    feats["평소 간격 대비 쉰 정도"] = gap / meangap
    # 직전 회차 관련
    prev = np.vstack([np.zeros((1, 46), bool), nums[:-1]])
    prev2 = np.vstack([np.zeros((2, 46), bool), nums[:-2]])
    prevb = np.vstack([np.zeros((1, 46), bool), bonus[:-1]])
    feats["직전 회차 출현"] = prev.astype(float)
    feats["직전 2회 출현수"] = prev.astype(float) + prev2
    feats["직전 보너스"] = prevb.astype(float)
    nb1 = np.zeros((T, 46))
    nb2 = np.zeros((T, 46))
    for s in (-1, 1):
        nb1[:, 1:46] += np.roll(prev, s, axis=1)[:, 1:46]
    for s in (-2, 2):
        nb2[:, 1:46] += np.roll(prev, s, axis=1)[:, 1:46]
    feats["직전 번호 ±1 이웃수"] = nb1
    feats["직전 번호 ±2 이웃수"] = nb2
    # 동반 출현(직전 번호와 과거 함께 나온 횟수 합)
    pair = np.zeros((46, 46))
    pairf = np.zeros((T, 46))
    for t in range(T):
        if t > 0:
            pairf[t] = pair[np.where(nums[t - 1])[0]].sum(0)
        ix = np.where(nums[t])[0]
        pair[np.ix_(ix, ix)] += 1
    np.fill_diagonal(pair, 0)
    feats["직전 번호와 동반 출현"] = pairf
    # 끝수·번호대 반복
    n = np.arange(46)
    endd = np.zeros((T, 46))
    dec = np.zeros((T, 46))
    for t in range(1, T):
        pe = np.where(nums[t - 1])[0]
        endd[t] = np.isin(n % 10, pe % 10)
        dec[t] = [(np.ceil(pe / 10) == np.ceil(k / 10)).sum() if k else 0 for k in n]
    feats["직전 끝수 같음"] = endd
    feats["직전 같은 번호대 개수"] = dec
    # 추세: 최근10 비율 − 최근100 비율
    feats["상승 추세"] = feats["최근10회 출현수"] / 10 - feats["최근100회 출현수"] / 100
    # 번호 자체 성질 (정적)
    feats["번호 크기"] = np.tile(n.astype(float), (T, 1))
    feats["홀수"] = np.tile((n % 2).astype(float), (T, 1))
    feats["끝자리"] = np.tile((n % 10).astype(float), (T, 1))
    return nums, feats


def run(draws, label):
    nums, feats = build(draws)
    T = len(draws)
    tr = np.arange(100, 900)
    te = np.arange(900, T)
    Y_tr = nums[tr, 1:].ravel()
    Y_te = nums[te, 1:].ravel()
    atoms = []
    for name, F in feats.items():
        Ftr = F[tr, 1:].ravel()
        Fte = F[te, 1:].ravel()
        qs = np.unique(np.quantile(Ftr, np.linspace(0.05, 0.95, 19)))
        for q in qs:
            for op in (">=", "<="):
                mtr = Ftr >= q if op == ">=" else Ftr <= q
                mte = Fte >= q if op == ">=" else Fte <= q
                if 50 <= mtr.sum() < len(mtr):
                    atoms.append((f"{name} {op} {q:g}", np.packbits(mtr), np.packbits(mte)))
    ytr = np.packbits(Y_tr)
    yte = np.packbits(Y_te)
    ntr = len(tr)
    nte = len(te)
    pc = np.unpackbits(np.arange(256, dtype=np.uint8)[:, None], axis=1).sum(1)

    def cnt(b):
        return int(pc[b].sum())

    def ev(btr, bte):
        s1 = cnt(btr)
        h1 = cnt(btr & ytr)
        s2 = cnt(bte)
        h2 = cnt(bte & yte)
        return s1, h1, s2, h2

    rules = []  # (desc, btr, bte)
    for a in atoms:
        rules.append((a[0], a[1], a[2]))
    # 2개 AND / OR 전수
    A = len(atoms)
    for i in range(A):
        for j in range(i + 1, A):
            rules.append((f"{atoms[i][0]} AND {atoms[j][0]}", atoms[i][1] & atoms[j][1], atoms[i][2] & atoms[j][2]))
    total_pairs = len(rules)
    # 지원(회차당 고른 번호 수) 구간별 최고 규칙
    results = []
    for desc, btr, bte in rules:
        s1, h1, s2, h2 = ev(btr, bte)
        if s1 < 30:
            continue
        results.append((desc, s1, h1, s2, h2, btr, bte))
    # 빔: 상위 300개 2-조합에 원자 하나 더 AND (3개 조건)
    for band_lo in (6,):
        pass
    top = sorted([r for r in results if r[1] >= 0.5 * ntr], key=lambda r: -r[2] / r[1])[:300]
    for desc, s1, h1, s2, h2, btr, bte in top:
        for a in atoms:
            b1 = btr & a[1]
            c1 = cnt(b1)
            if c1 < 30:
                continue
            b2 = bte & a[2]
            results.append((f"{desc} AND {a[0]}", c1, cnt(b1 & ytr), cnt(b2), cnt(b2 & yte), b1, b2))
    out = {"label": label, "atoms": A, "rules": len(results), "pairs": total_pairs, "train_rounds": ntr, "test_rounds": nte, "bands": []}
    for name, lo, hi in (("회차당 6개 안팎 (실제로 6개 고르는 수준)", 4, 9), ("회차당 1~4개", 1, 4), ("회차당 0.1~1개 (드물게 고름)", 0.1, 1), ("아주 드물게 (학습 구간 30번 이상)", 30 / ntr, 0.1)):
        cand = [r for r in results if lo * ntr <= r[1] < hi * ntr]
        if not cand:
            continue
        best = max(cand, key=lambda r: r[2] / r[1])
        # 학습에서 상위 20개의 검증 평균
        top20 = sorted(cand, key=lambda r: -r[2] / r[1])[:20]
        out["bands"].append({
            "band": name,
            "candidates": len(cand),
            "best": best[0],
            "train_prec": best[2] / best[1],
            "train_per_round": best[1] / ntr,
            "test_prec": best[4] / best[3] if best[3] else None,
            "test_support": best[3],
            "top20_train_prec": float(np.mean([r[2] / r[1] for r in top20])),
            "top20_test_prec": float(np.mean([r[4] / r[3] for r in top20 if r[3]])),
        })
    # 50% 이상 나온 규칙(학습) 수와 검증 성적
    hi50 = [r for r in results if r[2] / r[1] >= 0.5]
    out["train_ge50"] = len(hi50)
    out["train_ge50_examples"] = [
        {"rule": r[0], "train": f"{r[2]}/{r[1]}", "test": f"{r[4]}/{r[3]}"} for r in sorted(hi50, key=lambda r: -r[1])[:5]
    ]
    out["train_ge50_test_prec"] = (sum(r[4] for r in hi50) / max(1, sum(r[3] for r in hi50))) if hi50 else None
    # 전체 최고 정밀도(학습 지원 ≥ 회차당 1개)
    return out


if SEED >= 0:
    rng = np.random.default_rng(SEED)
    order = rng.permutation(len(DRAWS))
    draws = [DRAWS[i] for i in order]
    label = f"회차 순서를 섞은 데이터(seed {SEED})"
else:
    draws = DRAWS
    label = "실제 데이터"
print(json.dumps(run(draws, label), ensure_ascii=False, indent=1))
