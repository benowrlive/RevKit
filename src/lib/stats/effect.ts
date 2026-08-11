// src/lib/stats/effect.ts — per-study effect estimates.
//
// Each function takes a single study record in the appropriate shape and returns
// an Effect with:
//   theta    — log-scale estimate (log RR, log OR, log DOR…) or raw difference
//   se       — standard error of theta
//   effect   — back-transformed estimate on the original measurement scale
//   ciLower  — 95% CI lower bound on the original scale
//   ciUpper  — 95% CI upper bound on the original scale
//
// Anti-patterns enforced here:
//  - Continuity correction (+0.5 to all four dichotomous cells) is applied
//    ONLY when at least one cell is zero, and NEVER for Peto.
//  - Math.log(0) is avoided by correcting first.
//  - CI bounds for ratio measures are computed on the log scale, then exp()'d.

import { zForConfidence } from "./normal";
import type { DataType, EffectMeasure } from "@/lib/types";

/** Per-study effect output. */
export interface Effect {
  /** Log-scale estimate (ratios) or raw difference. */
  theta: number;
  /** Standard error of theta. */
  se: number;
  /** Estimate on the original measurement scale (RR, OR, MD, SMD…). */
  effect: number;
  /** 95% CI lower bound on the original scale. */
  ciLower: number;
  /** 95% CI upper bound on the original scale. */
  ciUpper: number;
}

// 95% z multiplier (≈1.959963984540054).
const Z95 = zForConfidence(0.95);

/** Dichotomous 2x2 study layout. a/b are intervention arm, c/d comparator. */
export interface DichotomousStudy {
  a: number; // events in group 1
  b: number; // non-events in group 1 (= n1 - a)
  c: number; // events in group 2
  d: number; // non-events in group 2 (= n2 - c)
  n1: number; // group 1 total
  n2: number; // group 2 total
}

/** Continuous outcome study (two-arm). */
export interface ContinuousStudy {
  mean1: number;
  sd1: number;
  n1: number;
  mean2: number;
  sd2: number;
  n2: number;
}

/** O-E & V (Peto-style input) study. */
export interface OeVStudy {
  oE: number;
  v: number;
}

/** Generic inverse-variance (GIV) study — already in log-or-difference scale. */
export interface GivStudy {
  effect: number;
  se: number;
}

/** Union of all per-study input shapes accepted by computeEffect. */
export type StudyInput = DichotomousStudy | ContinuousStudy | OeVStudy | GivStudy;

/**
 * Apply 0.5 continuity correction to a dichotomous study if any cell is zero.
 * Returns the corrected copy (totals recomputed as a+b, c+d). NEVER used for Peto.
 */
function withContinuityCorrection(s: DichotomousStudy): DichotomousStudy {
  if (s.a === 0 || s.b === 0 || s.c === 0 || s.d === 0) {
    const a = s.a + 0.5;
    const b = s.b + 0.5;
    const c = s.c + 0.5;
    const d = s.d + 0.5;
    return { a, b, c, d, n1: a + b, n2: c + d };
  }
  return s;
}

/**
 * Risk Ratio: RR = (a/n1) / (c/n2).
 * SE(log RR) = √(1/a − 1/n1 + 1/c − 1/n2) (Katz).
 */
export function riskRatio(study: DichotomousStudy): Effect {
  const s = withContinuityCorrection(study);
  const rr = (s.a / s.n1) / (s.c / s.n2);
  const theta = Math.log(rr);
  const se = Math.sqrt(1 / s.a - 1 / s.n1 + 1 / s.c - 1 / s.n2);
  return {
    theta,
    se,
    effect: rr,
    ciLower: Math.exp(theta - Z95 * se),
    ciUpper: Math.exp(theta + Z95 * se),
  };
}

/**
 * Odds Ratio: OR = (a·d) / (b·c).
 * SE(log OR) = √(1/a + 1/b + 1/c + 1/d) (Woolf).
 */
export function oddsRatio(study: DichotomousStudy): Effect {
  const s = withContinuityCorrection(study);
  const or = (s.a * s.d) / (s.b * s.c);
  const theta = Math.log(or);
  const se = Math.sqrt(1 / s.a + 1 / s.b + 1 / s.c + 1 / s.d);
  return {
    theta,
    se,
    effect: or,
    ciLower: Math.exp(theta - Z95 * se),
    ciUpper: Math.exp(theta + Z95 * se),
  };
}

/**
 * Risk Difference: RD = a/n1 − c/n2.
 * SE = √(a·(n1−a)/n1³ + c·(n2−c)/n2³).
 *
 * Phase 2A-stabilize RB-4 fix: REMOVED `withContinuityCorrection` call.
 * RD is a difference, not a ratio — it doesn't take logs and doesn't need
 * continuity correction. The previous code wrongly applied CC (verified bug
 * per `docs/REVKIT_FORENSIC_AUDIT.md` §6.1 / Matrix 5 RB-4).
 */
export function riskDifference(study: DichotomousStudy): Effect {
  const { a, c, n1, n2 } = study;
  const rd = a / n1 - c / n2;
  const se = Math.sqrt(
    (a * (n1 - a)) / (n1 ** 3) +
      (c * (n2 - c)) / (n2 ** 3),
  );
  return {
    theta: rd,
    se,
    effect: rd,
    ciLower: rd - Z95 * se,
    ciUpper: rd + Z95 * se,
  };
}

/**
 * Peto odds ratio. NO continuity correction (per Cochrane handbook).
 *
 *   O = a
 *   E = n1·(a+c) / N
 *   V = n1·n2·(a+c)·(b+d) / (N²·(N−1))
 *   logOR = (O − E) / V
 *   SE    = 1 / √V
 */
export function petoOddsRatio(study: DichotomousStudy): Effect {
  const { a, b, c, d, n1, n2 } = study;
  const N = n1 + n2;
  const O = a;
  const E = (n1 * (a + c)) / N;
  const V = (n1 * n2 * (a + c) * (b + d)) / (N * N * (N - 1));
  const theta = (O - E) / V;
  const se = 1 / Math.sqrt(V);
  return {
    theta,
    se,
    effect: Math.exp(theta),
    ciLower: Math.exp(theta - Z95 * se),
    ciUpper: Math.exp(theta + Z95 * se),
  };
}

/**
 * Mean Difference: MD = mean1 − mean2; SE = √(sd1²/n1 + sd2²/n2).
 */
export function meanDifference(study: ContinuousStudy): Effect {
  const { mean1, sd1, n1, mean2, sd2, n2 } = study;
  const md = mean1 - mean2;
  const se = Math.sqrt((sd1 * sd1) / n1 + (sd2 * sd2) / n2);
  return {
    theta: md,
    se,
    effect: md,
    ciLower: md - Z95 * se,
    ciUpper: md + Z95 * se,
  };
}

/**
 * Standardized Mean Difference (Hedges' g).
 *
 *   spooled = √(((n1−1)·sd1² + (n2−1)·sd2²) / (n1+n2−2))
 *   SMD_raw = (mean1 − mean2) / spooled
 *   J       = 1 − 3/(4·(n1+n2−2) − 1)   (Hedges' small-sample correction)
 *   SMD     = J · SMD_raw
 *   SE      = √((n1+n2)/(n1·n2) + SMD²/(2·(n1+n2)))
 */
export function standardizedMeanDiff(study: ContinuousStudy): Effect {
  const { mean1, sd1, n1, mean2, sd2, n2 } = study;
  const df = n1 + n2 - 2;
  const spooled = Math.sqrt(
    ((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / df,
  );
  const smdRaw = (mean1 - mean2) / spooled;
  const J = 1 - 3 / (4 * df - 1);
  const smd = J * smdRaw;
  const se = Math.sqrt((n1 + n2) / (n1 * n2) + (smd * smd) / (2 * (n1 + n2)));
  return {
    theta: smd,
    se,
    effect: smd,
    ciLower: smd - Z95 * se,
    ciUpper: smd + Z95 * se,
  };
}

/**
 * Generic inverse-variance input: pass-through (theta = effect, se = se).
 */
export function genericEffect(study: GivStudy): Effect {
  const { effect, se } = study;
  return {
    theta: effect,
    se,
    effect,
    ciLower: effect - Z95 * se,
    ciUpper: effect + Z95 * se,
  };
}

/**
 * O-E & V input (Peto-style): theta = oE/v (log OR); SE = 1/√v.
 */
export function oeV(study: OeVStudy): Effect {
  const { oE, v } = study;
  const theta = oE / v;
  const se = 1 / Math.sqrt(v);
  return {
    theta,
    se,
    effect: Math.exp(theta),
    ciLower: Math.exp(theta - Z95 * se),
    ciUpper: Math.exp(theta + Z95 * se),
  };
}

/**
 * Dispatcher: route to the right per-study effect function given the data type
 * and effect measure.
 *
 * DTA-style measures (DOR, SENSITIVITY, SPECIFICITY) are handled by lib/dta and
 * lib/stats/dta — calling computeEffect with them throws.
 */
export function computeEffect(
  dataType: DataType,
  effectMeasure: EffectMeasure,
  study: StudyInput,
): Effect {
  switch (effectMeasure) {
    case "RR":
      return riskRatio(study as DichotomousStudy);
    case "OR":
      return oddsRatio(study as DichotomousStudy);
    case "RD":
      return riskDifference(study as DichotomousStudy);
    case "PETO_OR":
      return petoOddsRatio(study as DichotomousStudy);
    case "MD":
      return meanDifference(study as ContinuousStudy);
    case "SMD":
      return standardizedMeanDiff(study as ContinuousStudy);
    case "DOR":
    case "SENSITIVITY":
    case "SPECIFICITY":
      throw new Error(
        `Effect measure '${effectMeasure}' is a DTA metric — use lib/dta or lib/stats/dta instead.`,
      );
    default: {
      // OE_V / GIV routing based on data type.
      if (dataType === "OE_V") return oeV(study as OeVStudy);
      if (dataType === "GIV") return genericEffect(study as GivStudy);
      throw new Error(
        `Unsupported combination: dataType=${dataType}, effectMeasure=${effectMeasure}`,
      );
    }
  }
}
