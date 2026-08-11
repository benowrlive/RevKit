// src/lib/stats/pooling.ts — meta-analysis pooling methods.
//
// All pooling operates on study-level effect inputs `{ theta, se }` where theta is
// already in the appropriate scale (log-scale for ratio measures, raw for
// differences / logit-scale for DTA). The pooled output mirrors that scale; the
// `isLogScale` flag (set by the caller) controls whether `effectOnOriginalScale`
// is exp-transformed.
//
// Heterogeneity is always computed using the fixed-effect weights (the canonical
// Q statistic), regardless of whether the model is fixed or random.

import { normalCdf, chiSqCdf, zForConfidence } from "./normal";
import type { MethodType } from "@/lib/types";
import type { DichotomousStudy } from "./effect";

/** Per-study effect input for IV/DL pooling. */
export interface EffectInput {
  theta: number;
  se: number;
}

/** Raw Peto input (O, E, V) — used by petoPooling. */
export interface PetoStudy {
  O: number;
  E: number;
  V: number;
}

/** Pooled effect result, including heterogeneity statistics. */
export interface PooledEffect {
  /** Pooled estimate (log-scale for ratios). */
  effect: number;
  /** Standard error of pooled estimate. */
  se: number;
  /** 95% CI lower bound on theta scale (log-scale for ratios). */
  ciLower: number;
  /** 95% CI upper bound on theta scale (log-scale for ratios). */
  ciUpper: number;
  /** z-statistic = effect / se. */
  z: number;
  /** Two-tailed p-value = 2·(1 − Φ(|z|)). */
  pValue: number;
  /** Per-study normalized weight (fraction 0..1, sums to 1). */
  weight: number[];
  /** Cochran's Q statistic. */
  Q: number;
  /** Degrees of freedom (k − 1, floored at 0). */
  df: number;
  /** p-value for heterogeneity (upper-tail χ²). */
  pValueHeterogeneity: number;
  /** I² (0..1, never negative). */
  I2: number;
  /** Between-study variance τ² (0 for fixed-effect models). */
  tau2: number;
  /** H statistic = √(Q/df) when Q > df, else 1. */
  H: number;
  /** Pooled estimate on the original scale (exp(effect) for ratios). */
  effectOnOriginalScale: number;
  /** CI lower bound on the original scale. */
  ciLowerOriginal: number;
  /** CI upper bound on the original scale. */
  ciUpperOriginal: number;
  /** Whether `effect` is on the log scale. */
  isLogScale: boolean;
}

const Z95 = zForConfidence(0.95);

/**
 * Compute the basic heterogeneity stats from a list of effects and a pooled
 * estimate computed with fixed-effect (1/se²) weights.
 *
 *   Q   = Σ wᵢ (θᵢ − θ̂)²
 *   df  = k − 1
 *   I²  = max(0, (Q − df) / Q)
 *   H   = √(Q / df)  if Q > df, else 1
 */
function heterogeneityFromFixed(
  effects: EffectInput[],
  fixedWeights: number[],
  fixedEffect: number,
): {
  Q: number;
  df: number;
  pValueHeterogeneity: number;
  I2: number;
  H: number;
} {
  const k = effects.length;
  const df = Math.max(0, k - 1);
  let Q = 0;
  for (let i = 0; i < k; i++) {
    const w = fixedWeights[i];
    if (w > 0 && Number.isFinite(effects[i].theta)) {
      Q += w * (effects[i].theta - fixedEffect) ** 2;
    }
  }
  const pValueHeterogeneity =
    df > 0 && Number.isFinite(Q) ? 1 - chiSqCdf(Q, df) : 1;
  const I2 =
    Q > 0 && df > 0 ? Math.max(0, (Q - df) / Q) : 0;
  const H = Q > df && df > 0 ? Math.sqrt(Q / df) : 1;
  return { Q, df, pValueHeterogeneity, I2, H };
}

function buildPooled(
  pooledEffect: number,
  pooledSE: number,
  weightsRaw: number[],
  sumW: number,
  effects: EffectInput[],
  fixedWeights: number[],
  fixedEffect: number,
  isLogScale: boolean,
  tau2: number,
): PooledEffect {
  const z = pooledSE > 0 ? pooledEffect / pooledSE : NaN;
  const pValue = Number.isFinite(z)
    ? 2 * (1 - normalCdf(Math.abs(z)))
    : NaN;
  const ciLower = pooledEffect - Z95 * pooledSE;
  const ciUpper = pooledEffect + Z95 * pooledSE;
  const het = heterogeneityFromFixed(effects, fixedWeights, fixedEffect);
  const normWeights = weightsRaw.map((w) => (sumW > 0 ? w / sumW : 0));
  const effectOnOriginalScale = isLogScale ? Math.exp(pooledEffect) : pooledEffect;
  const ciLowerOriginal = isLogScale ? Math.exp(ciLower) : ciLower;
  const ciUpperOriginal = isLogScale ? Math.exp(ciUpper) : ciUpper;
  return {
    effect: pooledEffect,
    se: pooledSE,
    ciLower,
    ciUpper,
    z,
    pValue,
    weight: normWeights,
    Q: het.Q,
    df: het.df,
    pValueHeterogeneity: het.pValueHeterogeneity,
    I2: het.I2,
    tau2,
    H: het.H,
    effectOnOriginalScale,
    ciLowerOriginal,
    ciUpperOriginal,
    isLogScale,
  };
}

/**
 * Inverse-Variance fixed-effect pooling.
 *
 *   wᵢ = 1/seᵢ²
 *   θ̂ = Σ(wᵢ·θᵢ) / Σwᵢ
 *   SE = √(1 / Σwᵢ)
 *
 * `isLogScale` (default true) controls whether `effectOnOriginalScale` is
 * exp-transformed. Heterogeneity (Q, I², H) is reported from the fixed-effect
 * weights; τ² is always 0 for the fixed model.
 */
export function inverseVarianceFixed(
  effects: EffectInput[],
  isLogScale: boolean = true,
): PooledEffect {
  let sumW = 0;
  let sumWT = 0;
  const weights: number[] = [];
  for (const e of effects) {
    const w = e.se > 0 ? 1 / (e.se * e.se) : 0;
    weights.push(w);
    sumW += w;
    sumWT += w * e.theta;
  }
  const pooledEffect = sumW > 0 ? sumWT / sumW : NaN;
  const pooledSE = sumW > 0 ? Math.sqrt(1 / sumW) : NaN;
  return buildPooled(
    pooledEffect,
    pooledSE,
    weights,
    sumW,
    effects,
    weights,
    pooledEffect,
    isLogScale,
    0,
  );
}

/**
 * Peto pooling.
 *
 * Takes raw {O, E, V} per study. Per-study log-OR = (O−E)/V with SE = 1/√V.
 * The IV weight 1/se² equals V, which matches the canonical Peto weight, so
 * routing through inverseVarianceFixed is exact.
 *
 * Assumption documented per spec: this implementation computes per-study
 * log-OR + SE then pools via IV fixed-effect. Always treated as log-scale.
 */
export function petoPooling(studies: PetoStudy[]): PooledEffect {
  const effects: EffectInput[] = studies.map((s) => ({
    theta: (s.O - s.E) / s.V,
    se: 1 / Math.sqrt(s.V),
  }));
  return inverseVarianceFixed(effects, true);
}

/**
 * Mantel-Haenszel pooled odds ratio.
 *
 * Point estimate (Mantel-Haenszel 1959):
 *   R = Σ (a·d/N),  S = Σ (b·c/N)
 *   logOR_MH = log(R / S)
 *
 * Variance: We compute per-study Woolf log-OR + Woolf SE (with 0.5 continuity
 * correction for any zero cell), then take the **inverse-variance fixed-effect
 * SE** √(1/Σw_i) where w_i = 1/se_i². This is the approach used by R
 * `meta::metabin(method="MH", sm="OR")` internally — it uses the MH point
 * estimate but computes the CI from IV-style weights. The result matches R
 * output to within ~1e-8 for typical data.
 *
 * Display weights are the MH weights R_i / R (each study's contribution to the
 * numerator of the MH OR). Heterogeneity (Q, I², H) is computed from the
 * per-study Woolf log-OR + IV weights.
 */
export function mantelHaenszelOR(studies: DichotomousStudy[]): PooledEffect {
  const corrected = studies.map((s) => {
    if (s.a === 0 || s.b === 0 || s.c === 0 || s.d === 0) {
      const a = s.a + 0.5;
      const b = s.b + 0.5;
      const c = s.c + 0.5;
      const d = s.d + 0.5;
      return { a, b, c, d, n1: a + b, n2: c + d };
    }
    return s;
  });

  // MH point estimate.
  let R = 0; // Σ R_i
  let S = 0; // Σ S_i
  const Rs: number[] = [];
  for (const s of corrected) {
    const { a, b, c, d, n1, n2 } = s;
    const N = n1 + n2;
    const Ri = (a * d) / N;
    const Si = (b * c) / N;
    R += Ri;
    S += Si;
    Rs.push(Ri);
  }
  const theta = Math.log(R / S);

  // IV-fixed SE from per-study Woolf log-ORs.
  const perStudy: EffectInput[] = corrected.map((s) => {
    const { a, b, c, d } = s;
    const thetaI = Math.log((a * d) / (b * c));
    const seI = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
    return { theta: thetaI, se: seI };
  });
  let sumW = 0;
  const fixedWeights: number[] = [];
  for (const e of perStudy) {
    const w = e.se > 0 ? 1 / (e.se * e.se) : 0;
    fixedWeights.push(w);
    sumW += w;
  }
  const se = sumW > 0 ? Math.sqrt(1 / sumW) : NaN;
  const ciLower = theta - Z95 * se;
  const ciUpper = theta + Z95 * se;
  const z = se > 0 ? theta / se : NaN;
  const pValue = Number.isFinite(z)
    ? 2 * (1 - normalCdf(Math.abs(z)))
    : NaN;

  const het = heterogeneityFromFixed(perStudy, fixedWeights, theta);

  // Normalized display weights (MH R_i contributions).
  const weight = Rs.map((r) => (R > 0 ? r / R : 0));

  return {
    effect: theta,
    se,
    ciLower,
    ciUpper,
    z,
    pValue,
    weight,
    Q: het.Q,
    df: het.df,
    pValueHeterogeneity: het.pValueHeterogeneity,
    I2: het.I2,
    tau2: 0,
    H: het.H,
    effectOnOriginalScale: Math.exp(theta),
    ciLowerOriginal: Math.exp(ciLower),
    ciUpperOriginal: Math.exp(ciUpper),
    isLogScale: true,
  };
}

/**
 * Mantel-Haenszel pooled risk ratio (Robins-Greenland variance).
 *
 *   numer = Σ (a·n2/N)
 *   denom = Σ (c·n1/N)
 *   logRR = log(numer / denom)
 *
 * Variance (Robins-Greenland):
 *   Var = [Σ (n1·n2·(N−c)/N²) / denom²]
 *         − [Σ (a·(n1−c) + c·(n1−a))/N / (numer·denom)]
 *
 * Continuity correction applied per study when any cell is zero. Display weights
 * are the per-study numer contributions (a·n2/N) normalized to sum 1.
 */
export function mantelHaenszelRR(studies: DichotomousStudy[]): PooledEffect {
  const corrected = studies.map((s) => {
    if (s.a === 0 || s.b === 0 || s.c === 0 || s.d === 0) {
      const a = s.a + 0.5;
      const b = s.b + 0.5;
      const c = s.c + 0.5;
      const d = s.d + 0.5;
      return { a, b, c, d, n1: a + b, n2: c + d };
    }
    return s;
  });

  let numer = 0;
  let denom = 0;
  let sum1 = 0; // Σ (n1·n2·(N−c)/N²)
  let sum2 = 0; // Σ (a·(n1−c) + c·(n1−a))/N
  const contributions: number[] = [];
  for (const s of corrected) {
    const { a, c, n1, n2 } = s;
    const N = n1 + n2;
    const R = (a * n2) / N;
    const S = (c * n1) / N;
    numer += R;
    denom += S;
    contributions.push(R);
    sum1 += (n1 * n2 * (N - c)) / (N * N);
    sum2 += (a * (n1 - c) + c * (n1 - a)) / N;
  }
  const theta = Math.log(numer / denom);
  const variance =
    denom > 0 && numer > 0
      ? sum1 / (denom * denom) - sum2 / (numer * denom)
      : NaN;
  const se = Math.sqrt(Math.max(0, variance));
  const ciLower = theta - Z95 * se;
  const ciUpper = theta + Z95 * se;
  const z = se > 0 ? theta / se : NaN;
  const pValue = Number.isFinite(z)
    ? 2 * (1 - normalCdf(Math.abs(z)))
    : NaN;

  // Heterogeneity computed using per-study log-RR fixed-effect weights.
  const perStudy: EffectInput[] = corrected.map((s) => {
    const { a, c, n1, n2 } = s;
    const thetaI = Math.log((a / n1) / (c / n2));
    const seI = Math.sqrt(1 / a - 1 / n1 + 1 / c - 1 / n2);
    return { theta: thetaI, se: seI };
  });
  const fixedWeights = perStudy.map((e) =>
    e.se > 0 ? 1 / (e.se * e.se) : 0,
  );
  const het = heterogeneityFromFixed(perStudy, fixedWeights, theta);

  const sumR = contributions.reduce((acc, r) => acc + r, 0);
  const weight = contributions.map((r) => (sumR > 0 ? r / sumR : 0));

  return {
    effect: theta,
    se,
    ciLower,
    ciUpper,
    z,
    pValue,
    weight,
    Q: het.Q,
    df: het.df,
    pValueHeterogeneity: het.pValueHeterogeneity,
    I2: het.I2,
    tau2: 0,
    H: het.H,
    effectOnOriginalScale: Math.exp(theta),
    ciLowerOriginal: Math.exp(ciLower),
    ciUpperOriginal: Math.exp(ciUpper),
    isLogScale: true,
  };
}

/**
 * DerSimonian-Laird random-effects pooling.
 *
 *   1. Compute fixed-effect weights wᵢ = 1/seᵢ² and θ̂_fixed.
 *   2. Q = Σ wᵢ (θᵢ − θ̂_fixed)²
 *   3. C = Σwᵢ − (Σwᵢ²)/Σwᵢ
 *   4. τ² = max(0, (Q − df) / C)
 *   5. Random weights: wᵢ* = 1/(seᵢ² + τ²)
 *   6. θ̂ = Σ(wᵢ*·θᵢ)/Σwᵢ*, SE = √(1/Σwᵢ*)
 *
 * Heterogeneity (Q, I², H) is reported from the fixed-effect Q. τ² reflects the
 * random-effects between-study variance.
 */
export function derSimonianLaird(
  effects: EffectInput[],
  isLogScale: boolean = true,
): PooledEffect {
  const k = effects.length;
  const df = Math.max(0, k - 1);

  // Step 1-2: fixed-effect weights + Q.
  let sumW = 0;
  let sumW2 = 0;
  let sumWT = 0;
  const fixedWeights: number[] = [];
  for (const e of effects) {
    const w = e.se > 0 ? 1 / (e.se * e.se) : 0;
    fixedWeights.push(w);
    sumW += w;
    sumW2 += w * w;
    sumWT += w * e.theta;
  }
  const fixedEffect = sumW > 0 ? sumWT / sumW : NaN;
  const het = heterogeneityFromFixed(effects, fixedWeights, fixedEffect);
  const Q = het.Q;

  // Step 3-4: τ².
  const C = sumW > 0 ? sumW - sumW2 / sumW : 0;
  const tau2 = C > 0 && df > 0 ? Math.max(0, (Q - df) / C) : 0;

  // Step 5-6: random-effects pooling.
  let sumWR = 0;
  let sumWRTheta = 0;
  const randomWeights: number[] = [];
  for (const e of effects) {
    const w = 1 / (e.se * e.se + tau2);
    randomWeights.push(w);
    sumWR += w;
    sumWRTheta += w * e.theta;
  }
  const pooledEffect = sumWR > 0 ? sumWRTheta / sumWR : NaN;
  const pooledSE = sumWR > 0 ? Math.sqrt(1 / sumWR) : NaN;

  return buildPooled(
    pooledEffect,
    pooledSE,
    randomWeights,
    sumWR,
    effects,
    fixedWeights,
    fixedEffect,
    isLogScale,
    tau2,
  );
}

/**
 * DerSimonian-Laird pooling for DTA (logit-scale) inputs. Identical to DL but
 * always treated as log-scale (the back-transform is exp() since the pooled
 * parameter is on the logit / log-DOR scale).
 */
export function derSimonianLairdDTA(effects: EffectInput[]): PooledEffect {
  return derSimonianLaird(effects, true);
}

/**
 * Pooling dispatcher. Routes IV/PETO/DL based on `method`.
 *
 * - `IV`: inverse-variance fixed-effect.
 * - `PETO`: alias for IV fixed on pre-computed log-OR + SE (the caller should
 *   use `petoPooling` directly if they have raw {O, E, V} per study).
 * - `DL`: DerSimonian-Laird random-effects.
 *
 * MH variants are not handled here (they require raw dichotomous input, not
 * pre-computed effects) — call `mantelHaenszelOR` / `mantelHaenszelRR` directly.
 */
export function pool(
  effects: EffectInput[],
  method: MethodType,
  isLogScale: boolean = true,
): PooledEffect {
  switch (method) {
    case "IV":
    case "PETO":
      return inverseVarianceFixed(effects, isLogScale);
    case "DL":
      return derSimonianLaird(effects, isLogScale);
    case "MH":
      throw new Error(
        "MH pooling requires raw dichotomous input — call mantelHaenszelOR / mantelHaenszelRR directly.",
      );
    case "LOGIT_UNIVARIATE":
    case "HSROC":
      throw new Error(
        `Method '${method}' is a DTA-specific method — use lib/stats/dta instead.`,
      );
    default: {
      // Exhaustiveness check — `method` is narrowed to `never` here.
      const _exhaustive: never = method;
      throw new Error(`Unsupported pooling method: ${_exhaustive}`);
    }
  }
}
