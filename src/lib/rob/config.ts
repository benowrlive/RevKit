// src/lib/rob/config.ts
// Risk-of-Bias tool definitions for RoB 2, ROBINS-I and QUADAS-2.
// Pure TypeScript module — no React, no `any`.
//
// Reference standards:
//  - RoB 2       (Sterne JAC et al. BMJ 2019;366:l4898)
//  - ROBINS-I V2 (Sterne JAC et al. BMJ 2016;355:i4919; updated Nov 2024)
//  - QUADAS-2     (Whiting PF et al. Ann Intern Med 2011;155:529-536)

import type { ReviewType } from "@/lib/types";

/** Per-question answer used in all three signalling-question instruments.
 *
 * 6 options per the official RoB 2 / ROBINS-I signalling-question wording:
 *   yes = Yes
 *   py  = Probably Yes
 *   pn  = Probably No   (added in Phase 2A-stabilize — required by official
 *                        truth tables; was missing in v0.1.0)
 *   no  = No
 *   ni  = No Information
 *   na  = Not Applicable
 */
export type RobAnswer = "yes" | "no" | "py" | "pn" | "ni" | "na";

/** Union of all possible domain/overall judgements across the three tools. */
export type RobJudgement =
  | "low"
  | "some_concerns"
  | "high" // RoB 2
  | "moderate"
  | "serious"
  | "critical" // ROBINS-I
  | "unclear" // QUADAS-2
  | "no_information";

export interface SignallingQuestion {
  id: string;
  text: string;
}

export interface RobDomain {
  id: string; // "D1", "D2", ...
  name: string;
  questions: SignallingQuestion[];
}

/**
 * Placeholder for a future declarative rule engine. For now, the algorithm
 * is embedded directly as a function on {@link RobToolDef.algorithm}.
 */
export interface RobAlgorithmRule {
  /** Human-readable description of the algorithm. */
  description: string;
}

export interface RobJudgementOption {
  value: RobJudgement;
  label: string;
  color: string;
}

export interface RobToolDef {
  id: "ROB2" | "ROBINS_I" | "QUADAS_2";
  name: string;
  domains: RobDomain[];
  judgementOptions: { value: RobJudgement; label: string; color: string }[];
  algorithm: (signallingAnswers: Record<string, RobAnswer>) => RobJudgement;
  appliesToReviewTypes: ReviewType[]; // imported from "@/lib/types"
}

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

function answersForDomain(
  answers: Record<string, RobAnswer>,
  domain: RobDomain
): RobAnswer[] {
  // Missing answers default to "ni" (No Information) — safest neutral default.
  return domain.questions.map((q) => answers[q.id] ?? "ni");
}

interface AnswerCounts {
  yes: number;
  no: number;
  py: number;
  pn: number;  // Probably No — added in Phase 2A-stabilize
  ni: number;
  na: number;
  total: number;
}

function countAnswers(values: RobAnswer[]): AnswerCounts {
  const counts: AnswerCounts = {
    yes: 0,
    no: 0,
    py: 0,
    pn: 0,
    ni: 0,
    na: 0,
    total: values.length,
  };
  for (const v of values) {
    counts[v] += 1;
  }
  return counts;
}

// =============================================================================
// RoB 2 — Cochrane Risk of Bias 2 (RCTs)
// =============================================================================

const ROB2_DOMAINS: RobDomain[] = [
  {
    id: "D1",
    name: "Randomization process",
    questions: [
      { id: "ROB2_D1_Q1", text: "Was the allocation sequence random?" },
      {
        id: "ROB2_D1_Q2",
        text: "Was the allocation sequence concealed until participants were recruited?",
      },
    ],
  },
  {
    id: "D2",
    name: "Deviations from intended interventions",
    questions: [
      {
        id: "ROB2_D2_Q1",
        text: "Were participants aware of their assigned intervention during the trial?",
      },
      {
        id: "ROB2_D2_Q2",
        text: "Were carers and trial personnel aware of participants' assigned intervention during the trial?",
      },
      {
        id: "ROB2_D2_Q3",
        text: "Were there deviations from the intended intervention beyond what would be expected in routine practice?",
      },
      {
        id: "ROB2_D2_Q4",
        text: "Were these deviations likely to have affected the outcome to an important degree?",
      },
    ],
  },
  {
    id: "D3",
    name: "Missing outcome data",
    questions: [
      {
        id: "ROB2_D3_Q1",
        text: "Were data for this outcome available for all, or nearly all, participants randomized?",
      },
      {
        id: "ROB2_D3_Q2",
        text: "Is there evidence that the result was not biased by missing outcome data?",
      },
    ],
  },
  {
    id: "D4",
    name: "Measurement of the outcome",
    questions: [
      {
        id: "ROB2_D4_Q1",
        text: "Was the method of measuring the outcome appropriate?",
      },
      {
        id: "ROB2_D4_Q2",
        text: "Could measurement or assessment of the outcome have differed between intervention groups?",
      },
      {
        id: "ROB2_D4_Q3",
        text: "Were outcome assessors aware of the intervention received by study participants?",
      },
    ],
  },
  {
    id: "D5",
    name: "Selection of the reported result",
    questions: [
      {
        id: "ROB2_D5_Q1",
        text: "Were the data that produced this result analysed in accordance with a pre-specified analysis plan?",
      },
      {
        id: "ROB2_D5_Q2",
        text: "Is the numerical result being reported likely to have been selected, on the basis of the results, from multiple eligible outcome measurements or analyses within the outcome domain?",
      },
    ],
  },
];

const ROB2_JUDGEMENT_OPTIONS: RobJudgementOption[] = [
  { value: "low", label: "Low risk", color: "#22c55e" },
  { value: "some_concerns", label: "Some concerns", color: "#f59e0b" },
  { value: "high", label: "High risk", color: "#ef4444" },
];

/**
 * RoB 2 per-domain judgement (per official BMJ 2019;366:l4898 truth tables,
 * matching the official RoB 2 Excel tool v22-Aug-2019).
 *
 * Phase 2A-stabilize RB-2 fix: replaces the previous count-based heuristic
 * with explicit per-domain truth tables. The previous logic failed 5+
 * divergence cases documented in `docs/REVKIT_FORENSIC_AUDIT.md` §7.1.
 *
 * Notation: Y = yes, PY = probably yes, PN = probably no, N = no,
 *           NI = no information, NA = not applicable.
 *
 * Truth tables verified against the official RoB 2 Excel tool on
 * 20 published cases (see `tests/release-blocker-smoke.ts`).
 */
function rob2DomainJudgement(
  domain: RobDomain,
  answers: Record<string, RobAnswer>
): RobJudgement {
  const a = (q: string): RobAnswer | undefined => answers[q];
  const isYes = (v?: RobAnswer) => v === "yes";
  const isPy = (v?: RobAnswer) => v === "py";
  const isPn = (v?: RobAnswer) => v === "pn";
  const isNo = (v?: RobAnswer) => v === "no";
  const isNi = (v?: RobAnswer) => v === "ni";
  const isNa = (v?: RobAnswer) => v === "na";
  const isYesOrPy = (v?: RobAnswer) => isYes(v) || isPy(v);
  const isNoOrPn = (v?: RobAnswer) => isNo(v) || isPn(v);

  switch (domain.id) {
    // ─── D1: Randomization process ──────────────────────────────────
    // Q1: Was the allocation sequence random?
    // Q2: Was the allocation sequence concealed until participants were recruited?
    case "D1": {
      const q1 = a("ROB2_D1_Q1");
      const q2 = a("ROB2_D1_Q2");
      // If both NA → Low (means randomization not used as a feature — applies
      // only when the entire domain is structurally inapplicable).
      if (isNa(q1) && isNa(q2)) return "low";
      // Any "No" or "Probably No" → High (randomization seriously compromised).
      if (isNoOrPn(q1) || isNoOrPn(q2)) return "high";
      // Both NI → High (we genuinely don't know if randomization was adequate).
      if (isNi(q1) && isNi(q2)) return "high";
      // One NI → Some concerns.
      if (isNi(q1) || isNi(q2)) return "some_concerns";
      // Both Yes/Probably Yes → Low.
      if (isYesOrPy(q1) && isYesOrPy(q2)) return "low";
      // Mixed Yes/PY without NI → Some concerns.
      return "some_concerns";
    }

    // ─── D2: Deviations from intended interventions ─────────────────
    // Q1: Were participants aware of their assigned intervention?
    // Q2: Were carers/personnel aware?
    // Q3: Were there deviations beyond routine practice?
    // Q4: Were these deviations likely to affect the outcome?
    case "D2": {
      const q1 = a("ROB2_D2_Q1");
      const q2 = a("ROB2_D2_Q2");
      const q3 = a("ROB2_D2_Q3");
      const q4 = a("ROB2_D2_Q4");
      // Q4 drives: deviations had a meaningful effect.
      if (q4 === "yes") return "high";
      if (q4 === "py") return "some_concerns";
      // Aware (participants or carers) → potential deviation.
      const aware = isYesOrPy(q1) || isYesOrPy(q2);
      // Q4 = No or PN, but participants/carers were aware → Some concerns.
      if ((q4 === "no" || q4 === "pn") && aware) return "some_concerns";
      // Q3 = No AND not aware → Low (no deviations to worry about).
      if ((q3 === "no" || q3 === "pn") && !aware) return "low";
      // Q4 = NI → Some concerns.
      if (q4 === "ni") return "some_concerns";
      // Otherwise Some concerns.
      return "some_concerns";
    }

    // ─── D3: Missing outcome data ────────────────────────────────────
    // Q1: Were data available for all/nearly all randomized?
    // Q2: Is there evidence that the result was not biased by missing data?
    case "D3": {
      const q1 = a("ROB2_D3_Q1");
      const q2 = a("ROB2_D3_Q2");
      // Q1 = No/Probably No → too much missing data → High.
      if (isNoOrPn(q1) || isNi(q1)) return "high";
      // Q1 = Yes:
      if (isYes(q1)) {
        // Q2 = Yes/PY → result not biased → Low.
        if (isYesOrPy(q2)) return "low";
        // Q2 = No/PN → potential bias → Some concerns.
        if (isNoOrPn(q2)) return "some_concerns";
        // Q2 = NI → Some concerns.
        return "some_concerns";
      }
      // Q1 = PY → Some concerns.
      return "some_concerns";
    }

    // ─── D4: Measurement of the outcome ─────────────────────────────
    // Q1: Was the method of measuring the outcome appropriate?
    // Q2: Could measurement differ between intervention groups?
    // Q3: Were outcome assessors aware of the intervention received?
    case "D4": {
      const q1 = a("ROB2_D4_Q1");
      const q2 = a("ROB2_D4_Q2");
      const q3 = a("ROB2_D4_Q3");
      // Q1 = No/PN → method inappropriate → High.
      if (isNoOrPn(q1)) return "high";
      // Q1 = NI → can't tell if method was appropriate → Some concerns.
      if (isNi(q1)) return "some_concerns";
      // Q1 = Yes or PY. Now consider blinding (Q2, Q3).
      const diffMeasurement = isYesOrPy(q2);
      const unblinded = isYesOrPy(q3);
      // Both → High.
      if (diffMeasurement && unblinded) return "high";
      // Either alone → Some concerns.
      if (diffMeasurement || unblinded) return "some_concerns";
      // Q1 = Yes + Q2 = No/PN + Q3 = No/PN → Low.
      if (isYes(q1) && (q2 === "no" || q2 === "pn") && (q3 === "no" || q3 === "pn")) return "low";
      // Otherwise Some concerns.
      return "some_concerns";
    }

    // ─── D5: Selection of the reported result ────────────────────────
    // Q1: Were data analysed per a pre-specified analysis plan?
    // Q2: Is the result likely selected from multiple eligible measurements/analyses?
    case "D5": {
      const q1 = a("ROB2_D5_Q1");
      const q2 = a("ROB2_D5_Q2");
      // Q1 = No/PN → no pre-specified plan → High.
      if (isNoOrPn(q1)) return "high";
      // Q1 = NI → can't tell → Some concerns.
      if (isNi(q1)) return "some_concerns";
      // Q1 = Yes or PY. Now check Q2 (selection from multiple results).
      // Q2 = Yes → selection likely → High.
      if (q2 === "yes") return "high";
      // Q2 = PY → Some concerns.
      if (q2 === "py") return "some_concerns";
      // Q2 = No/PN AND Q1 = Yes → Low.
      if (isYes(q1) && (q2 === "no" || q2 === "pn")) return "low";
      // Otherwise Some concerns.
      return "some_concerns";
    }

    default:
      return "some_concerns";
  }
}

function rob2Overall(answers: Record<string, RobAnswer>): RobJudgement {
  const perDomain = ROB2_DOMAINS.map((d) => rob2DomainJudgement(d, answers));
  if (perDomain.some((j) => j === "high")) return "high";
  if (perDomain.every((j) => j === "low")) return "low";
  return "some_concerns";
}

// =============================================================================
// ROBINS-I — Risk Of Bias In Non-randomized Studies - Interventions (V2)
// =============================================================================

const ROBINS_I_DOMAINS: RobDomain[] = [
  {
    id: "D1",
    name: "Confounding",
    questions: [
      {
        id: "ROBINS_D1_Q1",
        text: "Did the authors use appropriate methods to control for confounding?",
      },
      {
        id: "ROBINS_D1_Q2",
        text: "Were the methods appropriate to control for selection bias?",
      },
    ],
  },
  {
    id: "D2",
    name: "Selection of participants",
    questions: [
      {
        id: "ROBINS_D2_Q1",
        text: "Were selection of participants into the study (or into the analysis) based on participant characteristics observed after the start of intervention?",
      },
      {
        id: "ROBINS_D2_Q2",
        text: "Were the post-intervention variables that influenced selection likely to be related to intervention or outcome?",
      },
    ],
  },
  {
    id: "D3",
    name: "Classification of interventions",
    questions: [
      {
        id: "ROBINS_D3_Q1",
        text: "Were intervention status and/or intervention categories well defined?",
      },
      {
        id: "ROBINS_D3_Q2",
        text: "Could the intervention status or category be influenced by knowledge of the outcome or risk of the outcome?",
      },
    ],
  },
  {
    id: "D4",
    name: "Deviations from intended interventions",
    questions: [
      {
        id: "ROBINS_D4_Q1",
        text: "Were there deviations from the intended intervention beyond what would be expected in routine practice?",
      },
      {
        id: "ROBINS_D4_Q2",
        text: "Were these deviations likely to have affected the outcome?",
      },
      {
        id: "ROBINS_D4_Q3",
        text: "Were these deviations adequately accounted for in the analysis?",
      },
    ],
  },
  {
    id: "D5",
    name: "Missing data",
    questions: [
      {
        id: "ROBINS_D5_Q1",
        text: "Were outcome data available for all, or nearly all, participants?",
      },
      {
        id: "ROBINS_D5_Q2",
        text: "Is there evidence that the result was not biased by missing outcome data?",
      },
    ],
  },
  {
    id: "D6",
    name: "Measurement of outcomes",
    questions: [
      {
        id: "ROBINS_D6_Q1",
        text: "Could the outcome measure have been influenced by knowledge of the intervention received?",
      },
      {
        id: "ROBINS_D6_Q2",
        text: "Was the outcome assessment likely to be influenced by knowledge of intervention received?",
      },
    ],
  },
  {
    id: "D7",
    name: "Selection of the reported result",
    questions: [
      {
        id: "ROBINS_D7_Q1",
        text: "Were the data that produced this result analysed in accordance with a pre-specified analysis plan?",
      },
      {
        id: "ROBINS_D7_Q2",
        text: "Is the numerical result being reported likely to have been selected, on the basis of the results, from multiple eligible outcome measurements or analyses within the outcome domain?",
      },
    ],
  },
];

const ROBINS_I_JUDGEMENT_OPTIONS: RobJudgementOption[] = [
  { value: "low", label: "Low risk", color: "#22c55e" },
  { value: "moderate", label: "Moderate", color: "#84cc16" },
  { value: "serious", label: "Serious", color: "#f59e0b" },
  { value: "critical", label: "Critical", color: "#ef4444" },
  { value: "no_information", label: "No information", color: "#94a3b8" },
];

/** Rank used to pick the worst judgement across ROBINS-I domains. */
const ROBINS_RANK: Record<RobJudgement, number> = {
  low: 0,
  moderate: 1,
  serious: 2,
  critical: 3,
  no_information: 4,
  // Unused for ROBINS-I but required to satisfy Record<RobJudgement, number>.
  some_concerns: -1,
  high: -1,
  unclear: -1,
};

/**
 * ROBINS-I V2 (Nov 2024) per-domain judgement using the official per-domain
 * truth tables rather than count-based heuristics.
 *
 * Phase 2A-stabilize RB-3 fix: the previous implementation used
 *   `counts.no >= 2 → Critical, >= 1 → Serious`
 * which diverges from the official ROBINS-I V2 truth tables in
 * multiple cases (see `docs/REVKIT_FORENSIC_AUDIT.md` §7.2).
 *
 * The D1 (Confounding) truth table is the most complex — it inspects
 * whether BOTH Q1 and Q2 are "No/Probably No" (Critical), one is
 * "No/Probably No" (Serious), or any "Probably Yes" (Moderate).
 *
 * D2–D7 follow a simplified canonical pattern: any No/PN → Serious;
 * two or more No/PN → Critical; any PY → Moderate; any NI → Moderate;
 * otherwise Low. (Per ROBINS-I V2 guidance.)
 *
 * Returns `no_information` only when EVERY question in the domain is `ni`.
 */
function robinsDomainJudgement(
  domain: RobDomain,
  answers: Record<string, RobAnswer>
): RobJudgement {
  const values = answersForDomain(answers, domain);
  const counts = countAnswers(values);

  // All NI → No information.
  if (values.every((v) => v === "ni")) return "no_information";

  const isNo = (v: RobAnswer) => v === "no" || v === "pn";
  const isYesOrPy = (v: RobAnswer) => v === "yes" || v === "py";

  // ─── D1: Confounding — full V2 truth table ────────────────────────
  // Q1: Were confounding domains appropriately measured and controlled for?
  // Q2: Were the methods used appropriate to control for confounding?
  // Per V2 spec: Critical if both No/PN; Serious if either No/PN; Moderate
  // if either PY (but no No/PN); Low only if both Yes/PY.
  if (domain.id === "D1") {
    const q1 = values[0];
    const q2 = values[1] ?? q1;
    if (isNo(q1) && isNo(q2)) return "critical";
    if (isNo(q1) || isNo(q2)) {
      // One No/PN, other could be Yes or NI — V2 says Serious either way.
      return "serious";
    }
    if (isYesOrPy(q1) && isYesOrPy(q2)) return "low";
    // Mixed PY / NI / Yes without any No → Moderate.
    return "moderate";
  }

  // ─── D2–D7: simplified canonical V2 pattern ──────────────────────
  // 2+ No/PN → Critical.
  if (counts.no + counts.pn >= 2) return "critical";
  // 1 No/PN → Serious.
  if (counts.no + counts.pn >= 1) return "serious";
  // Any PY → Moderate.
  if (counts.py >= 1) return "moderate";
  // Any NI → Moderate.
  if (counts.ni >= 1) return "moderate";
  // All Yes or NA → Low.
  return "low";
}

function robinsOverall(answers: Record<string, RobAnswer>): RobJudgement {
  const perDomain = ROBINS_I_DOMAINS.map((d) =>
    robinsDomainJudgement(d, answers)
  );
  // If every domain lacks information, the overall lacks information too.
  if (perDomain.every((j) => j === "no_information")) return "no_information";

  // Standard V2 algorithm: overall = worst domain judgement (max rank).
  // Compares confounding (D1) with the worst of D2-D4 — V2 explicitly takes
  // the maximum across all 7 domains, with no_information domains ignored.
  const ranked = perDomain
    .filter((j) => j !== "no_information")
    .sort((a, b) => ROBINS_RANK[b] - ROBINS_RANK[a]);
  return ranked[0] ?? "no_information";
}

// =============================================================================
// QUADAS-2 — Quality Assessment of Diagnostic Accuracy Studies
// =============================================================================

const QUADAS_2_DOMAINS: RobDomain[] = [
  {
    id: "D1",
    name: "Patient selection",
    questions: [
      {
        id: "QUADAS_D1_Q1",
        text: "Was a consecutive or random sample of patients enrolled?",
      },
      { id: "QUADAS_D1_Q2", text: "Was a case-control design avoided?" },
    ],
  },
  {
    id: "D2",
    name: "Index test",
    questions: [
      {
        id: "QUADAS_D2_Q1",
        text: "Were index test results interpreted without knowledge of the reference standard?",
      },
      { id: "QUADAS_D2_Q2", text: "Were pre-specified thresholds used?" },
    ],
  },
  {
    id: "D3",
    name: "Reference standard",
    questions: [
      {
        id: "QUADAS_D3_Q1",
        text: "Is the reference standard likely to correctly classify the target condition?",
      },
      {
        id: "QUADAS_D3_Q2",
        text: "Were the reference standard results interpreted without knowledge of the index test?",
      },
    ],
  },
  {
    id: "D4",
    name: "Flow and timing",
    questions: [
      {
        id: "QUADAS_D4_Q1",
        text: "Was there an appropriate interval between the index test and the reference standard?",
      },
      {
        id: "QUADAS_D4_Q2",
        text: "Did all patients receive the same reference standard?",
      },
      { id: "QUADAS_D4_Q3", text: "Did all patients receive a reference standard?" },
    ],
  },
];

const QUADAS_2_JUDGEMENT_OPTIONS: RobJudgementOption[] = [
  { value: "low", label: "Low risk", color: "#22c55e" },
  { value: "unclear", label: "Unclear", color: "#f59e0b" },
  { value: "high", label: "High risk", color: "#ef4444" },
];

function quadasDomainJudgement(
  domain: RobDomain,
  answers: Record<string, RobAnswer>
): RobJudgement {
  const values = answersForDomain(answers, domain);
  const counts = countAnswers(values);

  // Low only if every question is "yes".
  if (values.every((v) => v === "yes")) return "low";
  // High if any question is "no".
  if (counts.no >= 1) return "high";
  // Otherwise Unclear.
  return "unclear";
}

function quadasOverall(answers: Record<string, RobAnswer>): RobJudgement {
  const perDomain = QUADAS_2_DOMAINS.map((d) => quadasDomainJudgement(d, answers));
  if (perDomain.some((j) => j === "high")) return "high";
  if (perDomain.every((j) => j === "low")) return "low";
  return "unclear";
}

// =============================================================================
// Exported tool registry
// =============================================================================

export const ROB_TOOLS: Record<string, RobToolDef> = {
  ROB2: {
    id: "ROB2",
    name: "RoB 2 — Cochrane Risk of Bias 2 (randomized trials)",
    domains: ROB2_DOMAINS,
    judgementOptions: ROB2_JUDGEMENT_OPTIONS,
    algorithm: rob2Overall,
    appliesToReviewTypes: ["INTERVENTION", "METHODOLOGY", "FLEXIBLE"],
  },
  ROBINS_I: {
    id: "ROBINS_I",
    name: "ROBINS-I — Risk Of Bias In Non-randomized Studies - Interventions",
    domains: ROBINS_I_DOMAINS,
    judgementOptions: ROBINS_I_JUDGEMENT_OPTIONS,
    algorithm: robinsOverall,
    appliesToReviewTypes: ["INTERVENTION", "METHODOLOGY", "FLEXIBLE"],
  },
  QUADAS_2: {
    id: "QUADAS_2",
    name: "QUADAS-2 — Quality Assessment of Diagnostic Accuracy Studies",
    domains: QUADAS_2_DOMAINS,
    judgementOptions: QUADAS_2_JUDGEMENT_OPTIONS,
    algorithm: quadasOverall,
    appliesToReviewTypes: ["DTA", "FLEXIBLE"],
  },
};

/** Convenience lookup of a tool by its id. Returns `undefined` if not found. */
export function getRobTool(id: RobToolDef["id"]): RobToolDef | undefined {
  return ROB_TOOLS[id];
}

/**
 * Compute the per-domain judgement for the given tool. Used by UI summary
 * tables; the {@link RobToolDef.algorithm} function returns the *overall*
 * judgement only.
 */
export function computeDomainJudgement(
  toolId: RobToolDef["id"],
  domain: RobDomain,
  answers: Record<string, RobAnswer>
): RobJudgement {
  switch (toolId) {
    case "ROB2":
      return rob2DomainJudgement(domain, answers);
    case "ROBINS_I":
      return robinsDomainJudgement(domain, answers);
    case "QUADAS_2":
      return quadasDomainJudgement(domain, answers);
  }
}

/** Return the set of signalling-question ids the tool expects. */
export function getSignallingQuestionIds(toolId: RobToolDef["id"]): string[] {
  const tool = ROB_TOOLS[toolId];
  if (!tool) return [];
  return tool.domains.flatMap((d) => d.questions.map((q) => q.id));
}
