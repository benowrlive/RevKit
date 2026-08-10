// src/lib/stats/dta.ts — DTA-specific pooling methods.
//
// Each function takes a list of DTA studies (2x2 tables: tp, fp, fn, tn) and
// returns either a univariate pooled estimate (logit sensitivity / specificity
// / DOR) or an HSROC curve fit.
//
// Continuity correction (0.5 to all four cells) is applied per study when any
// cell is zero. For univariate pooling, studies are pooled on the logit (or log)
// scale via inverse-variance fixed-effect or DerSimonian-Laird random-effects.

import {
  inverseVarianceFixed,
  derSimonianLaird,
  type PooledEffect,
  type EffectInput,
} from "./pooling";

/** DTA 2x2 study input. */
export interface DtaStudy {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

/** Common heterogeneity stats shared across univariate DTA results. */
export interface Heterogeneity {
  /** Cochran's Q. */
  Q: number;
  /** Degrees of freedom (k − 1). */
  df: number;
  /** Upper-tail χ² p-value for heterogeneity. */
  pValue: number;
  /** I² (0..1, never negative). */
  I2: number;
  /** Between-study variance τ². */
  tau2: number;
  /** H statistic. */
  H: number;
}

/** Pooled sensitivity on the logit scale. */
export interface UnivariateSensitivity {
  pooled: {
    /** Back-transformed sensitivity (0..1). */
    sens: number;
    /** CI lower bound for sensitivity (0..1). */
    ciLower: number;
    /** CI upper bound for sensitivity (0..1). */
    ciUpper: number;
    /** Logit-scale pooled estimate. */
    logitSens: number;
    /** SE of the logit-scale estimate. */
    se: number;
  };
  heterogeneity: Heterogeneity;
}

/** Pooled specificity on the logit scale. */
export interface UnivariateSpecificity {
  pooled: {
    /** Back-transformed specificity (0..1). */
    spec: number;
    ciLower: number;
    ciUpper: number;
    logitSpec: number;
    se: number;
  };
  heterogeneity: Heterogeneity;
}

/** Pooled diagnostic odds ratio. */
export interface UnivariateDor {
  pooled: {
    /** Back-transformed DOR. */
    dor: number;
    ciLower: number;
    ciUpper: number;
    /** Log-scale (log DOR) pooled estimate. */
    logDor: number;
    se: number;
  };
  heterogeneity: Heterogeneity;
}

/** HSROC curve fit. */
export interface HsrocResult {
  /** Intercept α. */
  alpha: number;
  /** Slope β. */
  beta: number;
  /** Threshold parameter λ = α / (1 − β) (or α/2 if β ≈ 1). */
  threshold: number;
  /** Slope of the SROC curve (= β). */
  slope: number;
  /** Summary operating point. */
  summaryPoint: { sens: number; spec: number };
}

/** Apply 0.5 continuity correction if any DTA cell is zero. */
function withDtaCc(s: DtaStudy): DtaStudy {
  if (s.tp === 0 || s.fp === 0 || s.fn === 0 || s.tn === 0) {
    return { tp: s.tp + 0.5, fp: s.fp + 0.5, fn: s.fn + 0.5, tn: s.tn + 0.5 };
  }
  return s;
}

/** Logistic back-transform: 1 / (1 + e^-x). */
function invLogit(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function heterogeneityFromPooled(p: PooledEffect): Heterogeneity {
  return {
    Q: p.Q,
    df: p.df,
    pValue: p.pValueHeterogeneity,
    I2: p.I2,
    tau2: p.tau2,
    H: p.H,
  };
}

/**
 * Univariate logit-sensitivity pooling.
 *
 * Per-study: logit_sens = log(TP/FN); SE = √(1/TP + 1/FN).
 * Add 0.5 continuity correction when any cell is zero.
 * Pool via IV (fixed) or DL (random). Back-transform via logistic.
 */
export function univariateLogitSensitivity(
  dtaStudies: DtaStudy[],
  random: boolean = false,
): UnivariateSensitivity {
  const effects: EffectInput[] = dtaStudies.map((s) => {
    const cc = withDtaCc(s);
    const theta = Math.log(cc.tp / cc.fn);
    const se = Math.sqrt(1 / cc.tp + 1 / cc.fn);
    return { theta, se };
  });
  const pooled = random
    ? derSimonianLaird(effects, true)
    : inverseVarianceFixed(effects, true);
  return {
    pooled: {
      sens: invLogit(pooled.effect),
      ciLower: invLogit(pooled.ciLower),
      ciUpper: invLogit(pooled.ciUpper),
      logitSens: pooled.effect,
      se: pooled.se,
    },
    heterogeneity: heterogeneityFromPooled(pooled),
  };
}

/**
 * Univariate logit-specificity pooling.
 *
 * Per-study: logit_spec = log(TN/FP); SE = √(1/TN + 1/FP).
 */
export function univariateLogitSpecificity(
  dtaStudies: DtaStudy[],
  random: boolean = false,
): UnivariateSpecificity {
  const effects: EffectInput[] = dtaStudies.map((s) => {
    const cc = withDtaCc(s);
    const theta = Math.log(cc.tn / cc.fp);
    const se = Math.sqrt(1 / cc.tn + 1 / cc.fp);
    return { theta, se };
  });
  const pooled = random
    ? derSimonianLaird(effects, true)
    : inverseVarianceFixed(effects, true);
  return {
    pooled: {
      spec: invLogit(pooled.effect),
      ciLower: invLogit(pooled.ciLower),
      ciUpper: invLogit(pooled.ciUpper),
      logitSpec: pooled.effect,
      se: pooled.se,
    },
    heterogeneity: heterogeneityFromPooled(pooled),
  };
}

/**
 * Pooled diagnostic odds ratio.
 *
 * Per-study: DOR = (TP·TN)/(FP·FN); log(DOR); SE = √(1/TP + 1/FP + 1/FN + 1/TN).
 */
export function diagnosticOddsRatio(
  dtaStudies: DtaStudy[],
  random: boolean = false,
): UnivariateDor {
  const effects: EffectInput[] = dtaStudies.map((s) => {
    const cc = withDtaCc(s);
    const theta = Math.log((cc.tp * cc.tn) / (cc.fp * cc.fn));
    const se = Math.sqrt(1 / cc.tp + 1 / cc.fp + 1 / cc.fn + 1 / cc.tn);
    return { theta, se };
  });
  const pooled = random
    ? derSimonianLaird(effects, true)
    : inverseVarianceFixed(effects, true);
  return {
    pooled: {
      dor: Math.exp(pooled.effect),
      ciLower: Math.exp(pooled.ciLower),
      ciUpper: Math.exp(pooled.ciUpper),
      logDor: pooled.effect,
      se: pooled.se,
    },
    heterogeneity: heterogeneityFromPooled(pooled),
  };
}

/**
 * Simplified HSROC fit.
 *
 * Weighted least squares regression of logit(TPR) = α + β · logit(FPR).
 * Weights = inverse variance of logit(TPR) = 1 / (1/TP + 1/FN).
 *
 * - If |β − 1| < 0.5, treat the SROC as symmetric and report the summary point
 *   at sens = spec = 1/(1 + e^(−α/2)).
 * - Otherwise the curve is asymmetric. The summary point is reported at the
 *   operating point where logit(FPR) = 0 (i.e. spec = 0.5), giving
 *   sens = 1/(1 + e^(−α)) — a conventional anchor when no preferred threshold
 *   is supplied.
 *
 * The threshold parameter λ = α / (1 − β) when β ≠ 1, otherwise α / 2.
 */
export function hsroc(dtaStudies: DtaStudy[]): HsrocResult {
  const points = dtaStudies.map((s) => {
    const cc = withDtaCc(s);
    return {
      y: Math.log(cc.tp / cc.fn), // logit(TPR) = logit(sens)
      x: Math.log(cc.fp / cc.tn), // logit(FPR) = logit(1 − spec)
      w: 1 / (1 / cc.tp + 1 / cc.fn), // inverse variance of logit sens
    };
  });

  // Weighted least squares: minimise Σ wᵢ (yᵢ − α − β·xᵢ)².
  let sw = 0;
  let swx = 0;
  let swy = 0;
  let swxx = 0;
  let swxy = 0;
  for (const p of points) {
    const w = Number.isFinite(p.w) && p.w > 0 ? p.w : 0;
    sw += w;
    swx += w * p.x;
    swy += w * p.y;
    swxx += w * p.x * p.x;
    swxy += w * p.x * p.y;
  }
  const denom = sw * swxx - swx * swx;
  const beta = Math.abs(denom) > 1e-12 ? (sw * swxy - swx * swy) / denom : 1;
  const alpha = sw > 0 ? (swy - beta * swx) / sw : 0;
  const threshold =
    Math.abs(1 - beta) > 1e-9 ? alpha / (1 - beta) : alpha / 2;
  const slope = beta;

  let summaryPoint: { sens: number; spec: number };
  if (Math.abs(beta - 1) < 0.5) {
    // Symmetric SROC.
    const p = invLogit(alpha / 2);
    summaryPoint = { sens: p, spec: p };
  } else {
    // Asymmetric — anchor at logit(FPR) = 0, i.e. spec = 0.5.
    summaryPoint = { sens: invLogit(alpha), spec: 0.5 };
  }

  return { alpha, beta, threshold, slope, summaryPoint };
}
