// src/lib/prisma-flow/template.ts
// PRISMA 2020 flow diagram template — 11 boxes covering Identification,
// Screening, Eligibility and Included stages. Pure TypeScript, no React.

import type { PrismaFlow, Review } from "@/lib/types";

export interface PrismaFlowBoxDef {
  id: string;
  label: string;
  description: string;
  stage: "identification" | "screening" | "eligibility" | "included";
}

/**
 * PRISMA 2020 11-box flow diagram template (Page MJ et al. BMJ 2021;372:n71).
 * Order follows top-to-bottom, left-to-right reading of the diagram.
 */
export const PRISMA_TEMPLATE: PrismaFlowBoxDef[] = [
  // ----- Identification -----
  {
    id: "id_db",
    label: "Records from databases/registers (n=)",
    stage: "identification",
    description: "Records identified from databases/registers",
  },
  {
    id: "id_other",
    label: "Records from other sources (n=)",
    stage: "identification",
    description: "Records identified from other sources",
  },
  {
    id: "id_dedup",
    label: "Records removed — duplicates (n=)",
    stage: "identification",
    description: "Duplicate records removed before screening",
  },
  {
    id: "id_autoexcl",
    label: "Records removed — auto-ineligible (n=)",
    stage: "identification",
    description: "Records removed before screening by automation tools",
  },
  // ----- Screening -----
  {
    id: "scr_screened",
    label: "Records screened (n=)",
    stage: "screening",
    description: "Records screened",
  },
  {
    id: "scr_excluded",
    label: "Records excluded (n=)",
    stage: "screening",
    description: "Records excluded after title/abstract screening",
  },
  // ----- Eligibility -----
  {
    id: "elig_sought",
    label: "Reports sought for retrieval (n=)",
    stage: "eligibility",
    description: "Full-text reports sought for retrieval",
  },
  {
    id: "elig_notretrieved",
    label: "Reports not retrieved (n=)",
    stage: "eligibility",
    description: "Full-text reports not retrieved",
  },
  {
    id: "elig_assessed",
    label: "Reports assessed for eligibility (n=)",
    stage: "eligibility",
    description: "Full-text reports assessed for eligibility",
  },
  {
    id: "elig_excluded",
    label: "Reports excluded with reasons (n=)",
    stage: "eligibility",
    description: "Full-text reports excluded with reasons",
  },
  // ----- Included -----
  {
    id: "inc_review",
    label: "Studies included in review (n=)",
    stage: "included",
    description: "Studies included in the review",
  },
];

/** Ordered list of box ids — useful for rendering tables/CSV exports. */
export const PRISMA_BOX_IDS: string[] = PRISMA_TEMPLATE.map((b) => b.id);

/** Lookup a box definition by id. */
export function getPrismaBoxDef(id: string): PrismaFlowBoxDef | undefined {
  return PRISMA_TEMPLATE.find((b) => b.id === id);
}

/**
 * Build an empty PRISMA flow for a review. All counts start at 0 with
 * `autoCount: true`, meaning the UI will recompute counts from the review
 * state until the user overrides them.
 *
 * `reviewId` defaults to `""` so that the spec call `createEmptyPrismaFlow()`
 * still works; callers should pass the real review id when known.
 */
export function createEmptyPrismaFlow(reviewId: string = ""): PrismaFlow {
  return {
    reviewId,
    boxes: PRISMA_TEMPLATE.map((def) => ({
      id: def.id,
      label: def.label,
      count: 0,
      autoCount: true,
    })),
  };
}

/**
 * Heuristic mapping from a Review's reference/study state to PRISMA box counts.
 *
 * Heuristics (per task spec):
 *  - id_db:           total references imported (treat all as from databases)
 *  - id_other:        0
 *  - id_dedup:        references whose excludeReason mentions "duplicate"
 *  - id_autoexcl:     0
 *  - scr_screened:    id_db - id_dedup
 *  - scr_excluded:    decision === "EXCLUDE" AND stage === "title_abstract"
 *  - elig_sought:     decision in ["INCLUDE", "MAYBE"] after title/abstract
 *  - elig_notretrieved: 0
 *  - elig_assessed:   same as elig_sought
 *  - elig_excluded:   decision === "EXCLUDE" AND stage === "full_text"
 *  - inc_review:      studies count
 */
export function computePrismaCountsFromReview(
  review: Review
): Record<string, number> {
  const refs = review.references;

  const id_db = refs.length;
  const id_other = 0;
  const id_dedup = refs.filter((r) => {
    const reason = (r.excludeReason ?? "").toLowerCase();
    return reason.includes("duplicate");
  }).length;
  const id_autoexcl = 0;

  const scr_screened = Math.max(0, id_db - id_dedup);

  const scr_excluded = refs.filter(
    (r) => r.decision === "EXCLUDE" && r.stage === "title_abstract"
  ).length;

  // References that survived title/abstract screening — i.e. anything that
  // was not excluded there. We approximate by counting INCLUDE/MAYBE decisions
  // (which by definition survived screening).
  const elig_sought = refs.filter(
    (r) => r.decision === "INCLUDE" || r.decision === "MAYBE"
  ).length;

  const elig_notretrieved = 0;
  const elig_assessed = elig_sought;

  const elig_excluded = refs.filter(
    (r) => r.decision === "EXCLUDE" && r.stage === "full_text"
  ).length;

  const inc_review = review.studies.length;

  return {
    id_db,
    id_other,
    id_dedup,
    id_autoexcl,
    scr_screened,
    scr_excluded,
    elig_sought,
    elig_notretrieved,
    elig_assessed,
    elig_excluded,
    inc_review,
  };
}
