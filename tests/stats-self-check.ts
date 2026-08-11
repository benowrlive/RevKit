// tests/stats-self-check.ts — quick acceptance self-checks for the stats engine.
//
// Run with: bun run tests/stats-self-check.ts
//
// Verifies:
//   1. calculateDta on TP=80, FP=10, FN=20, TN=90 yields the expected metrics.
//   2. Normal/chi-squared primitives match known reference values.
//   3. Pooling round-trips for IV / DL with a small synthetic example.
//   4. Effect computations are finite and self-consistent.

import { calculateDta, formatDtaResult } from "@/lib/dta/calculate";
import {
  normalCdf,
  normalInverseCdf,
  zForConfidence,
  chiSqCdf,
  chiSqPValue,
} from "@/lib/stats/normal";
import {
  riskRatio,
  oddsRatio,
  petoOddsRatio,
  standardizedMeanDiff,
  computeEffect,
} from "@/lib/stats/effect";
import {
  inverseVarianceFixed,
  derSimonianLaird,
  mantelHaenszelOR,
  pool,
} from "@/lib/stats/pooling";
import {
  univariateLogitSensitivity,
  diagnosticOddsRatio,
} from "@/lib/stats/dta";

let failures = 0;

function check(name: string, got: number, expected: number, tol: number): void {
  const ok = Math.abs(got - expected) <= tol;
  console.log(
    `  ${ok ? "PASS" : "FAIL"} ${name}: got=${got}, expected=${expected} (tol=${tol})`,
  );
  if (!ok) failures++;
}

function checkClose(name: string, got: number, expected: number): void {
  check(name, got, expected, Math.abs(expected) * 1e-4 + 1e-6);
}

function checkTruthy(name: string, condition: boolean, detail: string): void {
  console.log(`  ${condition ? "PASS" : "FAIL"} ${name}: ${detail}`);
  if (!condition) failures++;
}

console.log("\n=== DTA acceptance (TP=80, FP=10, FN=20, TN=90) ===");
const dta = calculateDta({ tp: 80, fp: 10, fn: 20, tn: 90 });
console.log(formatDtaResult(dta));
console.log("");
check("Sensitivity (%)", dta.sensitivity.value * 100, 80.0, 1e-6);
check("Specificity (%)", dta.specificity.value * 100, 90.0, 1e-6);
check("PPV (%)", dta.ppv.value * 100, 80 / 0.9, 1e-3); // 88.888...
check(
  "NPV (%)",
  dta.npv.value * 100,
  (90 / 110) * 100,
  1e-6,
);
check("LR+", dta.lrPlus.value, 8.0, 1e-6);
check("LR-", dta.lrMinus.value, 2 / 9, 1e-6); // 0.222...
check("Prevalence (%)", dta.prevalence.value * 100, 50.0, 1e-6);
check("DOR", dta.dor.value, (80 * 90) / (10 * 20), 1e-6);
check("N", dta.n, 200, 0);

console.log("\n=== Normal & chi-squared primitives ===");
// Φ(0) = 0.5, Φ(1.96) ≈ 0.975, Φ(-1.96) ≈ 0.025.
check("normalCdf(0)", normalCdf(0), 0.5, 1e-7);
check("normalCdf(1.959964)", normalCdf(1.959964), 0.975, 1e-4);
check("normalCdf(-1.959964)", normalCdf(-1.959964), 0.025, 1e-4);
// Φ⁻¹(0.5) = 0, Φ⁻¹(0.975) ≈ 1.959964.
check("normalInverseCdf(0.5)", normalInverseCdf(0.5), 0, 1e-9);
check("normalInverseCdf(0.975)", normalInverseCdf(0.975), 1.959964, 1e-5);
// zForConfidence(0.95) ≈ 1.959964.
check("zForConfidence(0.95)", zForConfidence(0.95), 1.959964, 1e-5);
// chi-squared: χ²(0, df=5) = 0; χ²(11.07, df=5) ≈ 0.95 (95th percentile).
check("chiSqCdf(0, 5)", chiSqCdf(0, 5), 0, 0);
check("chiSqCdf(11.0705, 5)", chiSqCdf(11.0705, 5), 0.95, 1e-3);
check("chiSqPValue(11.0705, 5)", chiSqPValue(11.0705, 5), 0.05, 1e-3);

console.log("\n=== Per-study effects ===");
// Simple 2x2: a=10, b=90, c=20, d=80, n1=100, n2=100.
const rr = riskRatio({ a: 10, b: 90, c: 20, d: 80, n1: 100, n2: 100 });
// RR = (10/100) / (20/100) = 0.5; log(0.5) ≈ -0.6931.
check("riskRatio effect", rr.effect, 0.5, 1e-9);
check("riskRatio theta", rr.theta, Math.log(0.5), 1e-9);
// OR = (10*80) / (90*20) = 800/1800 ≈ 0.4444.
const or = oddsRatio({ a: 10, b: 90, c: 20, d: 80, n1: 100, n2: 100 });
check("oddsRatio effect", or.effect, (10 * 80) / (90 * 20), 1e-9);
// Peto OR — no continuity correction. Use a case where it's well-defined.
// a=10, b=90, c=20, d=80, n1=100, n2=100.
const peto = petoOddsRatio({ a: 10, b: 90, c: 20, d: 80, n1: 100, n2: 100 });
checkTruthy("petoOddsRatio finite", Number.isFinite(peto.effect), `effect=${peto.effect}`);
// SMD sanity: identical groups → SMD ≈ 0.
const smd = standardizedMeanDiff({
  mean1: 5,
  sd1: 2,
  n1: 30,
  mean2: 5,
  sd2: 2,
  n2: 30,
});
check("SMD identical groups", smd.effect, 0, 1e-9);
// computeEffect dispatcher should route correctly.
const rrd = computeEffect("DICHOTOMOUS", "RR", {
  a: 10,
  b: 90,
  c: 20,
  d: 80,
  n1: 100,
  n2: 100,
});
check("computeEffect RR dispatch", rrd.effect, rr.effect, 1e-12);

console.log("\n=== Pooling: IV fixed ===");
// Two studies: same effect → pooled ≈ per-study theta.
const eff1 = { theta: Math.log(0.5), se: 0.2 };
const eff2 = { theta: Math.log(0.5), se: 0.3 };
const iv = inverseVarianceFixed([eff1, eff2]);
check("IV effect (log)", iv.effect, Math.log(0.5), 1e-9);
check("IV df", iv.df, 1, 0);
// Higher-precision study gets more weight.
checkTruthy("IV weight favors lower-se study", iv.weight[0] > iv.weight[1], `weights=${iv.weight}`);

console.log("\n=== Pooling: DerSimonian-Laird ===");
// Identical effects → tau² should be 0.
const dl = derSimonianLaird([eff1, eff2]);
check("DL tau2 (identical)", dl.tau2, 0, 1e-12);
// Heterogeneous studies → tau² > 0.
const dlHet = derSimonianLaird([
  { theta: Math.log(0.3), se: 0.1 },
  { theta: Math.log(0.9), se: 0.1 },
]);
checkTruthy("DL tau2 (heterogeneous) > 0", dlHet.tau2 > 0, `tau2=${dlHet.tau2}`);
checkTruthy("DL I2 (heterogeneous) > 0", dlHet.I2 > 0, `I2=${dlHet.I2}`);
check("DL I2 never negative (identical)", dl.I2, 0, 0);

console.log("\n=== Mantel-Haenszel OR ===");
// Two identical studies with OR ≈ 0.4444 → MH OR should be ≈ 0.4444.
const mhor = mantelHaenszelOR([
  { a: 10, b: 90, c: 20, d: 80, n1: 100, n2: 100 },
  { a: 10, b: 90, c: 20, d: 80, n1: 100, n2: 100 },
]);
checkClose("MH OR log-scale", Math.exp(mhor.effect), (10 * 80) / (90 * 20));
check("MH OR weights sum to 1", mhor.weight.reduce((a, b) => a + b, 0), 1, 1e-9);

console.log("\n=== DTA pooling ===");
// Two identical DTA studies → pooled sens ≈ 0.8.
const dtaPool = univariateLogitSensitivity([
  { tp: 80, fp: 10, fn: 20, tn: 90 },
  { tp: 80, fp: 10, fn: 20, tn: 90 },
]);
check("univariateLogitSensitivity pooled", dtaPool.pooled.sens, 0.8, 1e-6);

// DOR pool: two identical studies → DOR = (80*90)/(10*20) = 36.
const dorPool = diagnosticOddsRatio([
  { tp: 80, fp: 10, fn: 20, tn: 90 },
  { tp: 80, fp: 10, fn: 20, tn: 90 },
]);
check("diagnosticOddsRatio pooled", dorPool.pooled.dor, 36, 1e-6);

console.log("\n=== pool() dispatcher ===");
const ivDispatch = pool([eff1, eff2], "IV");
check("pool IV == inverseVarianceFixed", ivDispatch.effect, iv.effect, 1e-12);
const dlDispatch = pool([eff1, eff2], "DL");
check("pool DL == derSimonianLaird", dlDispatch.effect, dl.effect, 1e-12);

console.log(
  `\n=== ${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`} ===\n`,
);
if (failures > 0) {
  process.exit(1);
}
