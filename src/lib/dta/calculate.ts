// src/lib/dta/calculate.ts — single-study DTA calculator.
//
// Computes the canonical 2x2-table diagnostic accuracy metrics with appropriate
// 95% confidence intervals (Wilson for proportions, log-based for ratios).
// Zero cells trigger a 0.5 continuity correction used ONLY for the variance
// calculations; the reported point estimates (`value`) use the raw cell counts
// (this matches RevMan / Cochrane DTA reporting conventions).
//
// All metrics gracefully degrade to NaN when their denominator is zero (e.g. a
// study with TP + FN = 0 has no sensitivity — there were no diseased cases).

import { zForConfidence } from "@/lib/stats/normal";

/** DTA 2x2 table input. */
export interface DtaInput {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

/** A point estimate with its 95% CI. */
export interface DtaMetric {
  value: number;
  ciLower: number;
  ciUpper: number;
}

/** Full DTA result for a single 2x2 table. */
export interface DtaResult {
  /** Sensitivity TP/(TP+FN) — Wilson CI. NaN if TP+FN = 0. */
  sensitivity: DtaMetric;
  /** Specificity TN/(TN+FP) — Wilson CI. NaN if TN+FP = 0. */
  specificity: DtaMetric;
  /** PPV TP/(TP+FP) — Wilson CI. NaN if TP+FP = 0. */
  ppv: DtaMetric;
  /** NPV TN/(TN+FN) — Wilson CI. NaN if TN+FN = 0. */
  npv: DtaMetric;
  /** LR+ sens/(1−spec) — log-based CI. */
  lrPlus: DtaMetric;
  /** LR− (1−sens)/spec — log-based CI. */
  lrMinus: DtaMetric;
  /** Prevalence (TP+FN)/N — Wilson CI. */
  prevalence: DtaMetric;
  /** Diagnostic Odds Ratio (TP·TN)/(FP·FN) — log-based CI. */
  dor: DtaMetric;
  /** Grand total N = TP+FP+FN+TN. */
  n: number;
}

// 95% z multiplier (matches zForConfidence(0.95) ≈ 1.959963984540054).
const Z95 = zForConfidence(0.95);

const NAN_METRIC: DtaMetric = { value: NaN, ciLower: NaN, ciUpper: NaN };

/**
 * Wilson score interval for a proportion p with n observations.
 *
 *   denom = 1 + z²/n
 *   center = (p + z²/(2n)) / denom
 *   margin = z · √(p(1−p)/n + z²/(4n²)) / denom
 *
 * Returns NaN if n ≤ 0. Clamped to [0, 1].
 */
function wilson(p: number, n: number): DtaMetric {
  if (n <= 0 || !Number.isFinite(p)) return NAN_METRIC;
  const z = Z95;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    value: p,
    ciLower: Math.max(0, center - margin),
    ciUpper: Math.min(1, center + margin),
  };
}

/**
 * Log-based CI for a positive-valued ratio.
 * SE is computed by the caller (using the appropriate variance formula).
 * Returns NaN if value ≤ 0 or non-finite.
 */
function logCi(value: number, se: number): DtaMetric {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(se)) {
    return { value, ciLower: NaN, ciUpper: NaN };
  }
  const theta = Math.log(value);
  const ciLower = Math.exp(theta - Z95 * se);
  const ciUpper = Math.exp(theta + Z95 * se);
  return { value, ciLower, ciUpper };
}

/**
 * Compute all DTA metrics for a single 2x2 table.
 *
 * Continuity correction (0.5 to all four cells) is applied when any cell is
 * zero, and is used ONLY for variance/SE calculations. The reported `value`
 * uses raw cell counts (RevMan convention).
 */
export function calculateDta(input: DtaInput): DtaResult {
  const { tp, fp, fn, tn } = input;
  const n = tp + fp + fn + tn;

  const sensDenom = tp + fn; // diseased
  const specDenom = tn + fp; // non-diseased
  const ppvDenom = tp + fp; // test positives
  const npvDenom = tn + fn; // test negatives

  // Continuity-corrected cells for variance calculations.
  const cc =
    tp === 0 || fp === 0 || fn === 0 || tn === 0
      ? { tp: tp + 0.5, fp: fp + 0.5, fn: fn + 0.5, tn: tn + 0.5 }
      : { tp, fp, fn, tn };

  // --- Proportion-based metrics (Wilson CI) ---
  const sensitivity =
    sensDenom > 0 ? wilson(tp / sensDenom, sensDenom) : NAN_METRIC;

  const specificity =
    specDenom > 0 ? wilson(tn / specDenom, specDenom) : NAN_METRIC;

  const ppv = ppvDenom > 0 ? wilson(tp / ppvDenom, ppvDenom) : NAN_METRIC;

  const npv = npvDenom > 0 ? wilson(tn / npvDenom, npvDenom) : NAN_METRIC;

  const prevalence =
    n > 0 ? wilson((tp + fn) / n, n) : NAN_METRIC;

  // --- LR+ = sens / (1 − spec) = (TP/(TP+FN)) / (FP/(FP+TN)) ---
  // Log-scale SE = √(1/TP − 1/(TP+FN) + 1/FP − 1/(FP+TN)).
  let lrPlus: DtaMetric;
  if (sensDenom > 0 && specDenom > 0) {
    const lrPlusValue = tp / sensDenom / (fp / specDenom);
    const lrPlusSe = Math.sqrt(
      1 / cc.tp - 1 / (cc.tp + cc.fn) + 1 / cc.fp - 1 / (cc.fp + cc.tn),
    );
    lrPlus = logCi(lrPlusValue, lrPlusSe);
  } else {
    lrPlus = NAN_METRIC;
  }

  // --- LR− = (1 − sens) / spec = (FN/(TP+FN)) / (TN/(FP+TN)) ---
  // Log-scale SE = √(1/FN − 1/(TP+FN) + 1/TN − 1/(FP+TN)).
  let lrMinus: DtaMetric;
  if (sensDenom > 0 && specDenom > 0) {
    const lrMinusValue = fn / sensDenom / (tn / specDenom);
    const lrMinusSe = Math.sqrt(
      1 / cc.fn - 1 / (cc.tp + cc.fn) + 1 / cc.tn - 1 / (cc.fp + cc.tn),
    );
    lrMinus = logCi(lrMinusValue, lrMinusSe);
  } else {
    lrMinus = NAN_METRIC;
  }

  // --- DOR = (TP·TN) / (FP·FN) ---
  // Log-scale SE = √(1/TP + 1/FP + 1/FN + 1/TN).
  //
  // Phase 2A-stabilize RB-5 fix: return NAN_METRIC when fp=0 or fn=0.
  // The previous implementation had dead code that assigned `dor` twice
  // (the first assignment was overwritten by a CC-substituted value).
  // Per `docs/REVKIT_FORENSIC_AUDIT.md` §6.1 / Matrix 5 RB-5: when fp=0
  // OR fn=0, the DOR is mathematically infinite (log(∞) = ∞), and the
  // SE formula divides by zero. We return NaN rather than a misleading
  // CC-substituted value.
  let dor: DtaMetric;
  if (fp > 0 && fn > 0) {
    const dorValue = (tp * tn) / (fp * fn);
    const dorSe = Math.sqrt(
      1 / cc.tp + 1 / cc.fp + 1 / cc.fn + 1 / cc.tn,
    );
    dor = logCi(dorValue, dorSe);
  } else {
    dor = NAN_METRIC;
  }

  return {
    sensitivity,
    specificity,
    ppv,
    npv,
    lrPlus,
    lrMinus,
    prevalence,
    dor,
    n,
  };
}

/** Format a numeric value as a percentage with one decimal. */
function fmtPct(x: number): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "N/A";
}

/** Format a numeric value with two decimals. */
function fmtNum(x: number): string {
  return Number.isFinite(x) ? x.toFixed(2) : "N/A";
}

/** Format a CI pair using the supplied value formatter. */
function fmtMetric(
  label: string,
  m: DtaMetric,
  fmt: (x: number) => string,
): string {
  return `${label}: ${fmt(m.value)} (95% CI ${fmt(m.ciLower)}–${fmt(m.ciUpper)})`;
}

/**
 * Pretty-print a DtaResult for clipboard / text export.
 *
 * Proportions (sensitivity, specificity, PPV, NPV, prevalence) are formatted as
 * percentages. Ratios (LR+, LR−, DOR) are formatted as plain numbers.
 *
 * Note: when the original table contained zero cells, the reported `value`
 * reflects raw counts while CIs are computed using 0.5 continuity correction
 * (per RevMan convention).
 */
export function formatDtaResult(r: DtaResult): string {
  const lines: string[] = [
    fmtMetric("Sensitivity", r.sensitivity, fmtPct),
    fmtMetric("Specificity", r.specificity, fmtPct),
    fmtMetric("PPV", r.ppv, fmtPct),
    fmtMetric("NPV", r.npv, fmtPct),
    fmtMetric("LR+", r.lrPlus, fmtNum),
    fmtMetric("LR-", r.lrMinus, fmtNum),
    fmtMetric("Prevalence", r.prevalence, fmtPct),
    fmtMetric("DOR", r.dor, fmtNum),
    `N: ${r.n}`,
  ];
  return lines.join("\n");
}
