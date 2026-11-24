"""조합 모양 통계와 1등 당첨자 수(인기도) 분석.

A. 모양 통계: 가능한 조합 8,145,060개 전체의 정확한 분포 vs 실제 1,251회 → 적합도 검정
B. 모양 필터 규칙: 필터가 실제 당첨 조합을 덮는 비율 ÷ 전체 조합 중 필터 비율 = 리프트(당첨 확률 배수)
   - 고정 필터와, 매주 과거 데이터로 '자주 나온 모양'을 학습하는 후향 필터
C. 인기도: 1등 당첨자 수 ~ 포아송(판매 게임 수 / 8,145,060 × 인기 배수), 조합 특징으로 포아송 회귀
"""
import itertools
import json
import math
import sys

import numpy as np

N = 8145060
D = json.load(open(sys.argv[1]))
D = D["draws"] if isinstance(D, dict) else D
T = len(D)
W = np.array([sorted(d["nums"]) for d in D], dtype=np.int16)

# ---------------------------------------------------------------- 전체 조합
C = np.fromiter(itertools.chain.from_iterable(itertools.combinations(range(1, 46), 6)), dtype=np.int8, count=N * 6).reshape(N, 6).astype(np.int16)
PRIMES = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43}


def shape(X):
    """X: (k,6) 오름차순. 모양 특징 dict"""
    d = np.diff(X, axis=1)
    f = {}
    f["합계"] = X.sum(1)
    f["홀수 개수"] = (X % 2).sum(1)
    f["23 이상 개수"] = (X >= 23).sum(1)
    f["연번 쌍 수"] = (d == 1).sum(1)
    band = (X - 1) // 10  # 1-10,11-20,...,41-45
    bc = np.stack([(band == b).sum(1) for b in range(5)], 1)
    f["번호대 가짓수"] = (bc > 0).sum(1)
    f["한 번호대 최대 개수"] = bc.max(1)
    endd = X % 10
    ec = np.stack([(endd == e).sum(1) for e in range(10)], 1)
    f["끝수 가짓수"] = (ec > 0).sum(1)
    # AC값: 서로 다른 차이 개수 - 5
    diffs = np.stack([X[:, j] - X[:, i] for i in range(6) for j in range(i + 1, 6)], 1)
    ds = np.sort(diffs, 1)
    f["AC값"] = 1 + (np.diff(ds, axis=1) != 0).sum(1) - 5
    f["소수 개수"] = np.isin(X, list(PRIMES)).sum(1)
    f["3의 배수 개수"] = (X % 3 == 0).sum(1)
    f["간격(최대-최소)"] = X[:, 5] - X[:, 0]
    f["31 이하 개수"] = (X <= 31).sum(1)
    return f


def chi2_sf(x, k):
    """카이제곱 상위 확률 (정규화 불완전 감마)"""
    a, z = k / 2, x / 2
    if z <= 0:
        return 1.0
    if z < a + 1:
        s, t, n = 1 / a, 1 / a, a
        for _ in range(500):
            n += 1
            t *= z / n
            s += t
            if t < s * 1e-14:
                break
        return 1 - s * math.exp(-z + a * math.log(z) - math.lgamma(a))
    b = z + 1 - a
    c = 1 / 1e-300
    dd = 1 / b
    h = dd
    for i in range(1, 500):
        an = -i * (i - a)
        b += 2
        dd = an * dd + b
        dd = 1 / dd if abs(dd) > 1e-300 else 1e300
        c = b + an / c
        if abs(c) < 1e-300:
            c = 1e-300
        de = dd * c
        h *= de
        if abs(de - 1) < 1e-14:
            break
    return math.exp(-z + a * math.log(z) - math.lgamma(a)) * h


SC = shape(C)
SW = shape(W)
out = {"A": [], "B": [], "C": {}}

# ---------------------------------------------------------------- A. 적합도
for name in SC:
    allv = SC[name]
    obs = SW[name]
    if name in ("합계", "간격(최대-최소)"):
        edges = np.unique(np.quantile(allv, np.linspace(0, 1, 11)))
        edges[-1] += 1
        ca = np.histogram(allv, edges)[0]
        co = np.histogram(obs, edges)[0]
        labels = [f"{int(edges[i])}~{int(edges[i + 1]) - 1}" for i in range(len(edges) - 1)]
    else:
        vals = np.arange(allv.min(), allv.max() + 1)
        ca = np.array([(allv == v).sum() for v in vals])
        co = np.array([(obs == v).sum() for v in vals])
        labels = [str(v) for v in vals]
        # 기대 5 미만 칸은 이웃과 합침
        i = 0
        ca, co, labels = list(ca), list(co), list(labels)
        while True:
            exp = np.array(ca) / N * T
            small = [k for k in range(len(exp)) if exp[k] < 5]
            if not small or len(ca) <= 2:
                break
            k = small[0]
            j = k + 1 if k + 1 < len(ca) else k - 1
            a, b = sorted((k, j))
            ca[a] += ca[b]
            co[a] += co[b]
            labels[a] = labels[a].split("~")[0] + "~" + labels[b].split("~")[-1]
            del ca[b], co[b], labels[b]
        ca, co = np.array(ca), np.array(co)
    exp = ca / N * T
    chi = float(((co - exp) ** 2 / exp).sum())
    df = len(ca) - 1
    p = chi2_sf(chi, df)
    top = int(np.argmax(ca))
    out["A"].append({"특징": name, "칸": len(ca), "카이제곱": round(chi, 1), "자유도": df, "p값": round(p, 3), "가장 흔한 칸": labels[top], "그 칸 이론": round(ca[top] / N, 3), "그 칸 실제": round(co[top] / T, 3)})

# ---------------------------------------------------------------- B. 모양 필터 리프트
def lift(mask_all, mask_obs):
    frac = mask_all.mean()
    cov = mask_obs.mean()
    k = mask_obs.sum()
    # 이항 근사 표준오차
    se = math.sqrt(frac * (1 - frac) / len(mask_obs)) / frac if frac > 0 else 0
    return {"전체 조합 중 비율": round(float(frac), 4), "실제 당첨 덮음": round(float(cov), 4), "리프트": round(float(cov / frac), 3), "리프트 95% 오차": round(1.96 * se, 3), "덮은 회차": int(k)}


filters = {
    "합계 100~175": lambda S: (S["합계"] >= 100) & (S["합계"] <= 175),
    "홀수 2~4개": lambda S: (S["홀수 개수"] >= 2) & (S["홀수 개수"] <= 4),
    "23 이상 2~4개": lambda S: (S["23 이상 개수"] >= 2) & (S["23 이상 개수"] <= 4),
    "연번 쌍 1개 이하": lambda S: S["연번 쌍 수"] <= 1,
    "AC값 7 이상": lambda S: S["AC값"] >= 7,
    "번호대 3~4가지": lambda S: (S["번호대 가짓수"] >= 3) & (S["번호대 가짓수"] <= 4),
}
combo = None
for name, fn in filters.items():
    ma, mo = fn(SC), fn(SW)
    out["B"].append({"필터": name, **lift(ma, mo)})
    combo = (ma, mo) if combo is None else (combo[0] & ma, combo[1] & mo)
out["B"].append({"필터": "위 6개 모두", **lift(*combo)})

# 후향 학습 필터: 매 회차, 과거 당첨 조합의 (합계 10분위, 홀수, 23이상, 연번, AC) 칸 중
# '이론보다 자주 나온 칸'만 남기는 필터 → 그 회차 당첨 조합이 들어가는지, 필터 크기는 얼마인지
keys_all = None
def key(S):
    sb = np.digitize(S["합계"], np.quantile(SC["합계"], np.linspace(0, 1, 6)[1:-1]))  # 합계 5분위
    return sb * 1000 + S["홀수 개수"] * 100 + np.minimum(S["연번 쌍 수"], 2) * 10 + np.minimum(np.maximum(S["AC값"] - 5, 0), 5)
KA = key(SC)
KW = key(SW)
uk, inv = np.unique(KA, return_inverse=True)
cell_frac = np.bincount(inv) / N
widx = np.searchsorted(uk, KW)
seen = np.zeros(len(uk))
hits = 0
size_sum = 0
n_eval = 0
for t in range(T):
    if t >= 200:
        ratio = (seen / t) / cell_frac  # 과거 실제 빈도 ÷ 이론
        keep = ratio >= 1.0
        size = cell_frac[keep].sum()
        hits += keep[widx[t]]
        size_sum += size
        n_eval += 1
    seen[widx[t]] += 1
out["B"].append({"필터": "후향 학습: 과거에 이론보다 자주 나온 모양 칸만 (201회~)", "전체 조합 중 비율": round(size_sum / n_eval, 4), "실제 당첨 덮음": round(hits / n_eval, 4), "리프트": round((hits / n_eval) / (size_sum / n_eval), 3), "리프트 95% 오차": None, "덮은 회차": int(hits)})

# ---------------------------------------------------------------- C. 인기도 포아송 회귀
price = np.array([2000 if d["date"] < "2004-08-01" else 1000 for d in D], float)
sales = np.array([d.get("sales") or 0 for d in D], float)
win = np.array([d["first"]["winners"] for d in D], float)
ok = (sales > 0)
games = sales / price
mu0 = games / N  # 무작위로 산 사람만 있을 때 기대 1등 수
prev = np.zeros((T, 46), bool)
for t in range(1, T):
    prev[t, D[t - 1]["nums"]] = True
X = W
feat = {}
feat["31 이하 개수"] = SW["31 이하 개수"]
feat["모두 31 이하"] = (X <= 31).all(1).astype(float)
feat["연번 쌍 수"] = SW["연번 쌍 수"]
col = (X - 1) % 7  # 용지 7칸 기준 세로줄
row = (X - 1) // 7
feat["용지 같은 세로줄 최대 개수"] = np.stack([(col == c).sum(1) for c in range(7)], 1).max(1)
feat["용지 같은 가로줄 최대 개수"] = np.stack([(row == r).sum(1) for r in range(7)], 1).max(1)
feat["직전 회차 번호 개수"] = np.array([prev[t, X[t]].sum() for t in range(T)])
feat["7의 배수 개수"] = (X % 7 == 0).sum(1)
feat["5의 배수 개수"] = (X % 5 == 0).sum(1)
d = np.diff(X, axis=1)
feat["같은 간격 3개 이상(등차)"] = np.array([max(np.bincount(r)) >= 3 for r in d]).astype(float)
feat["40 이상 개수"] = (X >= 40).sum(1)
feat["합계/100"] = SW["합계"] / 100

def poisson_irls(Xm, y, off, iters=50):
    beta = np.zeros(Xm.shape[1])
    beta[0] = math.log(max(y.sum(), 1) / np.exp(off).sum())
    for _ in range(iters):
        eta = Xm @ beta + off
        mu = np.exp(eta)
        z = eta - off + (y - mu) / mu
        Wt = mu
        XtW = Xm.T * Wt
        beta_new = np.linalg.solve(XtW @ Xm, XtW @ z)
        if np.max(np.abs(beta_new - beta)) < 1e-10:
            beta = beta_new
            break
        beta = beta_new
    mu = np.exp(Xm @ beta + off)
    cov = np.linalg.inv((Xm.T * mu) @ Xm)
    # 과산포 보정
    phi = float(((y - mu) ** 2 / mu).sum() / (len(y) - Xm.shape[1]))
    se = np.sqrt(np.diag(cov) * max(phi, 1))
    return beta, se, phi, mu

names = list(feat)
Xm = np.column_stack([np.ones(T)] + [feat[k] for k in names])[ok]
y = win[ok]
off = np.log(mu0[ok])
beta, se, phi, mu = poisson_irls(Xm, y, off)
out["C"]["회차 수"] = int(ok.sum())
out["C"]["과산포"] = round(phi, 2)
out["C"]["기본 인기 배수(절편)"] = round(math.exp(beta[0]), 3)
out["C"]["계수"] = [{"특징": n, "배수(특징 1 증가당)": round(math.exp(b), 3), "95% 범위": f"{math.exp(b - 1.96 * s):.3f}~{math.exp(b + 1.96 * s):.3f}", "z": round(b / s, 2)} for n, b, s in zip(names, beta[1:], se[1:])]

# 단순 표: 31 이하 개수별 실제/기대
tab = []
for k in range(0, 7):
    m = ok & (feat["31 이하 개수"] == k)
    if m.sum():
        tab.append({"31 이하 개수": k, "회차": int(m.sum()), "실제 1등 합": int(win[m].sum()), "무작위 기대": round(float(mu0[m].sum()), 1), "인기 배수": round(float(win[m].sum() / mu0[m].sum()), 2)})
out["C"]["31 이하 개수별"] = tab
tab = []
for k in range(0, 4):
    m = ok & (np.minimum(feat["연번 쌍 수"], 3) == k)
    if m.sum():
        tab.append({"연번 쌍": k, "회차": int(m.sum()), "실제 1등 합": int(win[m].sum()), "무작위 기대": round(float(mu0[m].sum()), 1), "인기 배수": round(float(win[m].sum() / mu0[m].sum()), 2)})
out["C"]["연번 쌍별"] = tab

# 모델로 전체 조합의 예측 인기 배수 분포 → 상·하위 조합 비교
print(json.dumps(out, ensure_ascii=False, indent=1))
np.save(sys.argv[2], beta) if len(sys.argv) > 2 else None
