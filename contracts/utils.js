import { FEAR_MULT } from "./constants.js";

/** Derive lognormal params (mu, sigma, lam) from a series of values */
export function deriveParams(values) {
  if (!values.length) return { mu: 5.1, sigma: 0.6, lam: 128 };
  const lv = values.map((v) => Math.log(Math.max(v, 0.001)));
  const mu = lv.reduce((a, b) => a + b, 0) / lv.length;
  const sigma = Math.sqrt(
    lv.map((v) => (v - mu) ** 2).reduce((a, b) => a + b, 0) / lv.length
  );
  return { mu: +mu.toFixed(3), sigma: +sigma.toFixed(3), lam: values.length };
}

/** Monte Carlo: compound Poisson or annual lognormal */
export function runMC({
  events,
  nSim,
  muOverride,
  sigmaOverride,
  lamOverride,
  useAnnual,
}) {
  if (!events.length) return [];
  const lv = events.map((v) => Math.log(Math.max(v, 0.001)));
  const dataMu = lv.reduce((a, b) => a + b, 0) / lv.length;
  const dataSig = Math.sqrt(
    lv.map((v) => (v - dataMu) ** 2).reduce((a, b) => a + b, 0) / lv.length
  );
  const mu = muOverride ?? dataMu;
  const sigma = sigmaOverride ?? dataSig;
  const lam = lamOverride ?? (useAnnual ? 1 : events.length / 25);

  if (useAnnual) {
    return Array.from({ length: nSim }, () => {
      const u = Math.random(),
        v = Math.random();
      return Math.exp(
        mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      );
    });
  }
  return Array.from({ length: nSim }, () => {
    const L = Math.exp(-lam);
    let k = 0,
      p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    let tot = 0;
    for (let j = 0; j < Math.max(k - 1, 1); j++) {
      const u = Math.random(),
        v = Math.random();
      tot += Math.exp(
        mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      );
    }
    return tot;
  });
}

/** Price contract book from sim and strikes */
export function priceContracts(sim, strikes, riskMults, globalMult) {
  return strikes.map((s) => {
    const mult = riskMults[s] ?? globalMult;
    const trueP = (sim.filter((v) => v > s).length / sim.length) * 100;
    const implP = trueP * FEAR_MULT;
    return {
      strike: s,
      trueP,
      implP,
      pure: trueP,
      risk: Math.min(trueP * mult, 99),
      gap: implP - trueP,
      mult,
      edge: implP - trueP > 5 ? "Strong" : implP - trueP > 1 ? "Moderate" : "Thin",
    };
  });
}

export function exceedProb(sim, strike) {
  return sim.filter((v) => v > strike).length / sim.length;
}

/** Kelly for BUY YES */
export function kellyBuyYes(trueP, yesPrice) {
  const b = (1 - yesPrice) / yesPrice;
  if (b <= 0 || trueP <= 0) return 0;
  return Math.max(0, trueP - (1 - trueP) / b);
}

/** Kelly for SELL YES */
export function kellySellYes(trueP, yesPrice) {
  const noPrice = 1 - yesPrice;
  const b = yesPrice / noPrice;
  if (b <= 0) return 0;
  return Math.max(0, 1 - trueP - trueP / b);
}

/** Q-Kalshi style Kelly */
export function qKellyBuy(trueP, yesP) {
  if (yesP <= 0 || yesP >= 1) return 0;
  const b = (1 - yesP) / yesP;
  return Math.max(0, trueP - (1 - trueP) / b);
}

export function qKellySell(trueP, yesP) {
  if (yesP <= 0 || yesP >= 1) return 0;
  const b = yesP / (1 - yesP);
  return Math.max(0, 1 - trueP - trueP / b);
}

/** Quarterly MC: sum 4 independent quarter sims per year */
export function runQMC(qParams, userOverrides, nSim = 40000) {
  return Array.from({ length: nSim }, () => {
    let annual = 0;
    for (const q of [1, 2, 3, 4]) {
      const qs = qParams[q];
      const lam = userOverrides[q]?.lam ?? qs.lam;
      const mu = userOverrides[q]?.mu ?? qs.mu;
      const sig = userOverrides[q]?.sig ?? qs.sig;
      const L = Math.exp(-lam);
      let k = 0,
        p = 1;
      do {
        k++;
        p *= Math.random();
      } while (p > L);
      for (let j = 0; j < Math.max(k - 1, 1); j++) {
        const u = Math.random(),
          v = Math.random();
        annual += Math.exp(
          mu + sig * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
        );
      }
    }
    return annual;
  });
}

/** Single-quarter sim (lognormal draw per quarter). d = Q_HIST[qNum] from data/contractsData */
export function runQSimSingle(qNum, overrides, d, nSim = 30000) {
  const mu = overrides?.mu ?? d.mu;
  const sig = overrides?.sigma ?? d.sigma;
  return Array.from({ length: nSim }, () => {
    const u = Math.max(Math.random(), 1e-10);
    const v = Math.random();
    return Math.exp(
      mu + sig * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    );
  });
}

/** Hurricane season sim (single lognormal) */
export function runHurrSim(mu, sigma, nSim) {
  return Array.from({ length: nSim }, () => {
    const u = Math.max(Math.random(), 1e-10);
    const v = Math.random();
    return Math.exp(
      mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    );
  });
}
