// src/lib/project/serialize.ts — .revkit JSON serialization (zod-validated)

import { z } from "zod";
import type { Review, ReviewFile } from "@/lib/types";

const APP_VERSION = "0.1.0";
const FORMAT_VERSION = "1.0.0";

const RobJudgementSchema = z.enum([
  "low",
  "some_concerns",
  "high",
  "moderate",
  "serious",
  "critical",
  "no_information",
  "unclear",
]);

const RobAnswerSchema = z.enum(["yes", "no", "py", "ni", "na"]);

const DataPointSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  subgroupId: z.string().nullable(),
  studyId: z.string(),
  events1: z.number().int().nullable().optional(),
  total1: z.number().int().nullable().optional(),
  events2: z.number().int().nullable().optional(),
  total2: z.number().int().nullable().optional(),
  mean1: z.number().nullable().optional(),
  sd1: z.number().nullable().optional(),
  n1: z.number().int().nullable().optional(),
  mean2: z.number().nullable().optional(),
  sd2: z.number().nullable().optional(),
  n2: z.number().int().nullable().optional(),
  oE: z.number().nullable().optional(),
  v: z.number().nullable().optional(),
  effect: z.number().nullable().optional(),
  se: z.number().nullable().optional(),
  tp: z.number().int().nullable().optional(),
  fp: z.number().int().nullable().optional(),
  fn: z.number().int().nullable().optional(),
  tn: z.number().int().nullable().optional(),
  order: z.number().int(),
});

const SubgroupSchema = z.object({
  id: z.string(),
  outcomeId: z.string(),
  name: z.string(),
  order: z.number().int(),
  dataPoints: z.array(DataPointSchema),
});

const OutcomeSchema = z.object({
  id: z.string(),
  comparisonId: z.string(),
  name: z.string(),
  dataType: z.string(),
  effectMeasure: z.string(),
  method: z.string(),
  model: z.enum(["fixed", "random"]),
  unit: z.string().nullable().optional(),
  timeFrame: z.string().nullable().optional(),
  order: z.number().int(),
  subgroups: z.array(SubgroupSchema),
  dataPoints: z.array(DataPointSchema),
});

const ComparisonSchema = z.object({
  id: z.string(),
  reviewId: z.string(),
  name: z.string(),
  order: z.number().int(),
  outcomes: z.array(OutcomeSchema),
});

const StudySchema = z.object({
  id: z.string(),
  reviewId: z.string(),
  label: z.string(),
  year: z.number().int().nullable().optional(),
  authors: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  pdfPath: z.string().nullable().optional(),
  status: z.string(),
  excludeReason: z.string().nullable().optional(),
  design: z.string().nullable().optional(),
  picos: z.string().nullable().optional(),
  indexTest: z.string().nullable().optional(),
  referenceStandard: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ReferenceSchema = z.object({
  id: z.string(),
  reviewId: z.string(),
  title: z.string(),
  authors: z.string(),
  year: z.number().int().nullable().optional(),
  journal: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  pmid: z.string().nullable().optional(),
  rawRis: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  decision: z.string().nullable().optional(),
  excludeReason: z.string().nullable().optional(),
});

const RobAssessmentSchema = z.object({
  id: z.string(),
  studyId: z.string(),
  tool: z.enum(["ROB2", "ROBINS_I", "QUADAS_2"]),
  domainJudgements: z.record(z.string(), RobJudgementSchema),
  signallingAnswers: z.record(z.string(), RobAnswerSchema),
  overallJudgement: RobJudgementSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PrismaFlowBoxSchema = z.object({
  id: z.string(),
  label: z.string(),
  count: z.number().int(),
  autoCount: z.boolean().optional(),
});

const PrismaFlowSchema = z.object({
  reviewId: z.string(),
  boxes: z.array(PrismaFlowBoxSchema),
});

const ReviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  researchQuestion: z.string().nullable().optional(),
  type: z.string(),
  subType: z.string().nullable().optional(),
  status: z.string(),
  phase: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  comparisons: z.array(ComparisonSchema),
  studies: z.array(StudySchema),
  references: z.array(ReferenceSchema),
  robAssessments: z.array(RobAssessmentSchema),
  prismaFlow: PrismaFlowSchema.nullable().optional(),
});

const ReviewFileSchema = z.object({
  format: z.literal("revkit-1"),
  formatVersion: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  appVersion: z.string(),
  review: ReviewSchema,
});

export function serializeReview(review: Review): string {
  const now = new Date().toISOString();
  const file: ReviewFile = {
    format: "revkit-1",
    formatVersion: FORMAT_VERSION,
    createdAt: review.createdAt,
    updatedAt: now,
    appVersion: APP_VERSION,
    review,
  };
  return JSON.stringify(file, null, 2);
}

export function parseReview(json: string): Review {
  const raw = JSON.parse(json);
  const parsed = ReviewFileSchema.parse(raw);
  return parsed.review as Review;
}

export function validateFormat(json: string): { valid: boolean; formatVersion?: string; error?: string } {
  try {
    const raw = JSON.parse(json);
    const parsed = ReviewFileSchema.safeParse(raw);
    if (!parsed.success) {
      return { valid: false, error: parsed.error.message };
    }
    return { valid: true, formatVersion: parsed.data.formatVersion };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export function createEmptyReview(
  partial: Pick<Review, "title" | "type" | "subType" | "researchQuestion">
): Review {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `r_${Date.now()}`;
  const now = new Date().toISOString();
  return {
    id,
    title: partial.title,
    researchQuestion: partial.researchQuestion ?? null,
    type: partial.type,
    subType: partial.subType ?? null,
    status: "draft",
    phase: "scoping",
    createdAt: now,
    updatedAt: now,
    comparisons: [],
    studies: [],
    references: [],
    robAssessments: [],
    prismaFlow: null,
  };
}
