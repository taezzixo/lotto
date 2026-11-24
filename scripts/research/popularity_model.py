"""1등 당첨자 수(인기도) 포아송 회귀: 전체·자동·수동 분리, 앞/뒤 절반 재현성, 전체 조합의 인기 배수와 당첨 시 몫.
사용: python3 scripts/research/popularity_model.py public/data/draws.json"""
import itertools, json, math, sys
import numpy as np
from poisson_irls import poisson_irls
N = 8145060
D = json.load(open(sys.argv[1])); D = D["draws"] if isinstance(D, dict) else D
T = len(D)
W = np.array([sorted(d["nums"]) for d in D], dtype=np.int16)

def feats(X):
    d = np.diff(X, axis=1)
    row = (X - 1) // 7
    f = {
        "합계/100": X.sum(1) / 100,
        "같은 간격 3개 이상(등차)": np.array([np.bincount(r).max() >= 3 for r in d], float) if len(X) < 100000 else None,
        "연번 쌍 수": (d == 1).sum(1).astype(float),
        "용지 같은 가로줄 최대 개수": np.stack([(row == r).sum(1) for r in range(7)], 1).max(1).astype(float),
    }
    return f

def ap3(X):
    d = np.diff(X, axis=1)
    out = np.zeros(len(X), bool)
    ds = np.sort(d, 1)
    # 같은 값이 3번 이상: 정렬 후 i, i+2 같음
    for i in range(3):
        out |= ds[:, i] == ds[:, i + 2]
    return out.astype(float)

F = feats(W); F["같은 간격 3개 이상(등차)"] = ap3(W)
names = list(F)
price = np.array([2000 if d["date"] < "2004-08-01" else 1000 for d in D], float)
games = np.array([d["sales"] for d in D], float) / price
mu0 = games / N
win = np.array([d["first"]["winners"] for d in D], float)
year = np.array([int(d["date"][:4]) for d in D])
res = {}
def fit(mask, y, label, extra_year=False):
    cols = [np.ones(T)] + [F[k] for k in names]
    Xm = np.column_stack(cols)[mask]
    b, se, phi, mu = poisson_irls(Xm, y[mask], np.log(mu0[mask]))
    res[label] = {"회차": int(mask.sum()), "과산포": round(phi, 2), "계수": {n: {"배수": round(math.exp(bb), 3), "95%": f"{math.exp(bb-1.96*s):.3f}~{math.exp(bb+1.96*s):.3f}", "z": round(bb/s, 2)} for n, bb, s in zip(names, b[1:], se[1:])}}
    return b
allm = np.ones(T, bool)
b_all = fit(allm, win, "전체 1등(1~최신)")
ft = [d.get("firstType") for d in D]
m262 = np.array([f is not None and d["first"]["winners"] > 0 or (f is not None) for f, d in zip(ft, D)])
auto = np.array([(f or {}).get("auto", 0) for f in ft], float)
manu = np.array([(f or {}).get("manual", 0) + (f or {}).get("semi", 0) for f in ft], float)
# firstType 있는 회차만 (1등 0명이어도 firstType 0으로 취급 가능하면 포함)
has = np.array([f is not None for f in ft]) | (win == 0) & (np.arange(T) >= 261)
fit(has, auto, "자동 당첨자만 (262회~)")
fit(has, manu, "수동·반자동 당첨자만 (262회~)")
# 앞/뒤 반으로 나눠 재현성
half = T // 2
fit(np.arange(T) < half, win, f"앞 절반 (1~{half}회)")
fit(np.arange(T) >= half, win, f"뒤 절반 ({half+1}~{T}회)")

# 전체 조합에 모델 적용 → 인기 배수 분포
C = np.fromiter(itertools.chain.from_iterable(itertools.combinations(range(1, 46), 6)), dtype=np.int8, count=N * 6).reshape(N, 6).astype(np.int16)
FC = feats(C); FC["같은 간격 3개 이상(등차)"] = ap3(C)
eta = sum(b_all[i + 1] * FC[k] for i, k in enumerate(names))
m = np.exp(eta - np.log(np.mean(np.exp(eta))))  # 전체 조합 평균 = 1로 맞춤 (인기 배수의 상대값)
qs = np.quantile(m, [0.1, 0.25, 0.5, 0.75, 0.9])
lam = 116992886000 / 1000 / N  # 최근(1251회) 판매 기준 무작위 기대 1등 수
def share(mult):  # 내가 1등일 때 받는 몫 기대 = E[1/(1+K)], K~Poisson(lam*mult)
    x = lam * mult
    return (1 - math.exp(-x)) / x
dec = np.quantile(m, np.linspace(0, 1, 11))
res["조합 인기 배수 분포(평균 1)"] = {"하위10%": round(qs[0], 3), "하위25%": round(qs[1], 3), "중앙": round(qs[2], 3), "상위25%": round(qs[3], 3), "상위10%": round(qs[4], 3), "최소": round(float(m.min()), 3), "최대": round(float(m.max()), 3)}
lo = m <= qs[0]; hi = m >= qs[4]
res["당첨 시 몫"] = {
  "기준 λ(1251회 판매)": round(lam, 2),
  "인기 하위10% 조합 평균 배수": round(float(m[lo].mean()), 3),
  "인기 상위10% 조합 평균 배수": round(float(m[hi].mean()), 3),
  "몫 기대(하위10%) ÷ 몫 기대(평균 조합)": round(share(float(m[lo].mean())) / share(1.0), 3),
  "몫 기대(상위10%) ÷ 몫 기대(평균 조합)": round(share(float(m[hi].mean())) / share(1.0), 3),
  "하위10% 예시 합계 평균": round(float(C[lo].sum(1).mean()), 1),
  "상위10% 예시 합계 평균": round(float(C[hi].sum(1).mean()), 1),
}
print(json.dumps(res, ensure_ascii=False, indent=1))
