// src/components/forest-plot/pooling.ts — shared pooling + per-study effect
// builders used by ForestPlot and FunnelPlot. Pure TS, no React, no DOM.
//
// Routing rules (per Task 5-a spec):
//  - MH + dichotomous OR → `mantelHaenszelOR`.
//  - MH + dichotomous RR → `mantelHaenszelRR`.
//  - MH + other effect measures (e.g. RD) → fall back to IV fixed (or DL when
//    the model is random).
//  - PETO + dichotomous PETO_OR → `petoPooling` on reconstructed {O,E,V}.
//  - PETO + OE_V data → IV fixed of per-study (theta=oE/v, se=1/sqrt(v))
//    effects (mathematically identical to Peto pooling since IV weight = V).
//  - IV → `inverseVarianceFixed`.
//  - DL → `derSimonianLaird`.
//  - When `outcome.model === "random"` and method is IV or MH, override to DL
//    on the per-study effects.

import {
  computeEffect,
  inverseVarianceFixed,
  derSimonianLaird,
  mantelHaenszelOR,
  mantelHaenszelRR,
  petoPooling,
  oeV,
  genericEffect,
  type Effect,
  type EffectInput,
  type PooledEffect,
  type DichotomousStudy,
  type PetoStudy,
} from "@/lib/stats";
import type { Outcome, DataPoint } from "@/lib/types";

/** Per-study Effect records plus (when applicable) the raw 2x2 layout for MH pooling. */
export interface PerStudyResult {
  effects: Effect[];
  dichStudies: (DichotomousStudy | null)[];
  validDp: DataPoint[];
}

/**
 * Build per-study `Effect` records for a non-DTA outcome. Returns the Effect
 * list, the raw DichotomousStudy array (when applicable — null entries for
 * non-dichotomous rows), and the list of data points that contributed.
 *
 * Continuity correction for dichotomous 2x2 cells is applied automatically
 * inside `computeEffect` (via `withContinuityCorrection` in lib/stats/effect).
 */
export function buildPerStudyEffects(
  outcome: Outcome,
  dataPoints: DataPoint[],
): PerStudyResult {
  const effects: Effect[] = [];
  const dichStudies: (DichotomousStudy | null)[] = [];
  const validDp: DataPoint[] = [];
  for (const dp of dataPoints) {
    let eff: Effect | null = null;
    let dich: DichotomousStudy | null = null;
    if (outcome.dataType === "DICHOTOMOUS") {
      const events1 = dp.events1 ?? 0;
      const total1 = dp.total1 ?? 0;
      const events2 = dp.events2 ?? 0;
      const total2 = dp.total2 ?? 0;
      if (total1 <= 0 || total2 <= 0) continue;
      const a = events1;
      const b = total1 - events1;
      const c = events2;
      const d = total2 - events2;
      dich = { a, b, c, d, n1: total1, n2: total2 };
      eff = computeEffect("DICHOTOMOUS", outcome.effectMeasure, dich);
    } else if (outcome.dataType === "CONTINUOUS") {
      const mean1 = dp.mean1 ?? NaN;
      const sd1 = dp.sd1 ?? NaN;
      const n1 = dp.n1 ?? 0;
      const mean2 = dp.mean2 ?? NaN;
      const sd2 = dp.sd2 ?? NaN;
      const n2 = dp.n2 ?? 0;
      if (!Number.isFinite(mean1) || !Number.isFinite(mean2) || n1 <= 0 || n2 <= 0) {
        continue;
      }
      eff = computeEffect("CONTINUOUS", outcome.effectMeasure, {
        mean1, sd1, n1, mean2, sd2, n2,
      });
    } else if (outcome.dataType === "OE_V") {
      const oE = dp.oE ?? NaN;
      const v = dp.v ?? NaN;
      if (!Number.isFinite(oE) || !Number.isFinite(v) || v <= 0) continue;
      eff = oeV({ oE, v });
    } else if (outcome.dataType === "GIV") {
      const effect = dp.effect ?? NaN;
      const se = dp.se ?? NaN;
      if (!Number.isFinite(effect) || !Number.isFinite(se) || se <= 0) continue;
      eff = genericEffect({ effect, se });
    } else {
      // DTA_2x2 — not handled here (use DtaForestPlot / SrocPlot).
      continue;
    }
    if (!eff || !Number.isFinite(eff.theta) || !Number.isFinite(eff.se)) continue;
    effects.push(eff);
    dichStudies.push(dich);
    validDp.push(dp);
  }
  return { effects, dichStudies, validDp };
}

/** True when the pooled effect is on the log scale (ratio measures, OE_V). */
export function outcomeIsLogScale(outcome: Outcome): boolean {
  return (
    outcome.dataType === "OE_V" ||
    outcome.effectMeasure === "OR" ||
    outcome.effectMeasure === "RR" ||
    outcome.effectMeasure === "PETO_OR"
  );
}

/**
 * Pool per-study effects per the spec routing. Returns null when there are no
 * valid effects.
 */
export function poolOutcomeEffects(
  outcome: Outcome,
  effects: Effect[],
  dichStudies: (DichotomousStudy | null)[],
): PooledEffect | null {
  if (effects.length === 0) return null;
  const isLogScale = outcomeIsLogScale(outcome);
  const effectInputs: EffectInput[] = effects.map((e) => ({ theta: e.theta, se: e.se }));
  const wantsRandom = outcome.model === "random";

  if (outcome.method === "MH") {
    const validDich = dichStudies.filter((d): d is DichotomousStudy => d !== null);
    if (validDich.length === effects.length) {
      if (outcome.effectMeasure === "OR") return mantelHaenszelOR(validDich);
      if (outcome.effectMeasure === "RR") return mantelHaenszelRR(validDich);
    }
    if (wantsRandom) return derSimonianLaird(effectInputs, isLogScale);
    return inverseVarianceFixed(effectInputs, isLogScale);
  }

  if (outcome.method === "PETO") {
    if (outcome.dataType === "OE_V") {
      return inverseVarianceFixed(effectInputs, true);
    }
    if (outcome.effectMeasure === "PETO_OR") {
      const validDich = dichStudies.filter((d): d is DichotomousStudy => d !== null);
      if (validDich.length === effects.length) {
        const petoInputs: PetoStudy[] = validDich.map((s) => {
          const N = s.n1 + s.n2;
          const O = s.a;
          const E = (s.n1 * (s.a + s.c)) / N;
          const V = (s.n1 * s.n2 * (s.a + s.c) * (s.b + s.d)) / (N * N * (N - 1));
          return { O, E, V };
        });
        return petoPooling(petoInputs);
      }
    }
    if (wantsRandom) return derSimonianLaird(effectInputs, isLogScale);
    return inverseVarianceFixed(effectInputs, isLogScale);
  }

  if (outcome.method === "DL" || wantsRandom) {
    return derSimonianLaird(effectInputs, isLogScale);
  }

  return inverseVarianceFixed(effectInputs, isLogScale);
}

/** Effect-measure display label. */
export function effectMeasureLabel(outcome: Outcome): string {
  switch (outcome.effectMeasure) {
    case "OR": return "Odds Ratio";
    case "RR": return "Risk Ratio";
    case "RD": return "Risk Difference";
    case "PETO_OR": return "Peto Odds Ratio";
    case "MD": return "Mean Difference";
    case "SMD": return "Std. Mean Difference";
    default: return outcome.effectMeasure;
  }
}
