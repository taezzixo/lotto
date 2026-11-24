"""포아송 회귀(IRLS) + 과산포 보정 표준오차."""
import math
import numpy as np
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

