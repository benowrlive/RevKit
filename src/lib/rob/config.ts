// src/lib/rob/config.ts
// Risk-of-Bias tool definitions for RoB 2, ROBINS-I and QUADAS-2.
// Pure TypeScript module — no React, no `any`.
//
// Reference standards:
//  - RoB 2       (Sterne JAC et al. BMJ 2019;366:l4898)
//  - ROBINS-I V2 (Sterne JAC et al. BMJ 2016;355:i4919; updated Nov 2024)
//  - QUADAS-2     (Whiting PF et al. Ann Intern Med 2011;155:529-536)

import type { ReviewType } from "@/lib/types";

/** Per-question answer used in all three signalling-question instruments. */
export type RobAnswer = "yes" | "no" | "py" | "ni" | "na";
// yes = Yes, no = No, py = Probably Yes, ni = No Information, na = Not Applicable

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
  ni: number;
  na: number;
  total: number;
}

function countAnswers(values: RobAnswer[]): AnswerCounts {
  const counts: AnswerCounts = {
    yes: 0,
    no: 0,
    py: 0,
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

function rob2DomainJudgement(
  domain: RobDomain,
  answers: Record<string, RobAnswer>
): RobJudgement {
  const values = answersForDomain(answers, domain);
  const counts = countAnswers(values);

  // D1: High if any "no" OR "ni".  D2-D5: High if any "no".
  if (domain.id === "D1") {
    if (counts.no > 0 || counts.ni > 0) return "high";
  } else {
    if (counts.no > 0) return "high";
  }

  // Low if all answers are "yes" / "py" / "na".
  const allLowAnswers = values.every(
    (v) => v === "yes" || v === "py" || v === "na"
  );
  if (allLowAnswers) return "low";

  // Otherwise Some concerns.
  return "some_concerns";
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

function robinsDomainJudgement(
  domain: RobDomain,
  answers: Record<string, RobAnswer>
): RobJudgement {
  const values = answersForDomain(answers, domain);
  const counts = countAnswers(values);

  // No information: every question "ni".
  if (values.every((v) => v === "ni")) return "no_information";
  // Critical: multiple "no" answers in the domain.
  if (counts.no >= 2) return "critical";
  // Serious: any single "no" or any "ni".
  if (counts.no >= 1 || counts.ni >= 1) return "serious";
  // Moderate: at least one "py" (and no "no"/"ni").
  if (counts.py >= 1) return "moderate";
  // Low: all answers in {yes, na}.
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
