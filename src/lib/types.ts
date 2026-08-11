// src/lib/types.ts — RevKit domain types
// Adapted from master prompt §6 (`.revkit` file format) and §8 (Prisma schema).

export type ReviewType =
  | "INTERVENTION"
  | "DTA"
  | "METHODOLOGY"
  | "OVERVIEW"
  | "FLEXIBLE";

export type ReviewSubType =
  | "PROGNOSIS"
  | "ETIOLOGY"
  | "QUALITATIVE"
  | null;

export type ReviewStatus = "draft" | "in_progress" | "completed" | "archived";
export type ReviewPhase =
  | "scoping"
  | "screening"
  | "extraction"
  | "analysis"
  | "writing"
  | "complete";

export type DataType =
  | "DICHOTOMOUS"
  | "CONTINUOUS"
  | "OE_V"
  | "GIV"
  | "DTA_2x2";

export type EffectMeasure =
  | "RR"
  | "OR"
  | "RD"
  | "PETO_OR"
  | "MD"
  | "SMD"
  | "DOR"
  | "SENSITIVITY"
  | "SPECIFICITY";

export type MethodType =
  | "MH"
  | "PETO"
  | "IV"
  | "DL"
  | "LOGIT_UNIVARIATE"
  | "HSROC";

export type ModelType = "fixed" | "random";

export type RobTool = "ROB2" | "ROBINS_I" | "QUADAS_2";

export type RobJudgement =
  | "low"
  | "some_concerns"
  | "high"
  | "moderate"
  | "serious"
  | "critical"
  | "no_information"
  | "unclear";

export interface DataPoint {
  id: string;
  outcomeId: string;
  subgroupId: string | null;
  studyId: string;
  // Dichotomous
  events1?: number | null;
  total1?: number | null;
  events2?: number | null;
  total2?: number | null;
  // Continuous
  mean1?: number | null;
  sd1?: number | null;
  n1?: number | null;
  mean2?: number | null;
  sd2?: number | null;
  n2?: number | null;
  // OE_V
  oE?: number | null;
  v?: number | null;
  // GIV
  effect?: number | null;
  se?: number | null;
  // DTA 2x2
  tp?: number | null;
  fp?: number | null;
  fn?: number | null;
  tn?: number | null;
  order: number;
}

export interface Subgroup {
  id: string;
  outcomeId: string;
  name: string;
  order: number;
  dataPoints: DataPoint[];
}

export interface Outcome {
  id: string;
  comparisonId: string;
  name: string;
  dataType: DataType;
  effectMeasure: EffectMeasure;
  method: MethodType;
  model: ModelType;
  unit?: string | null;
  timeFrame?: string | null;
  order: number;
  subgroups: Subgroup[];
  dataPoints: DataPoint[];
}

export interface Comparison {
  id: string;
  reviewId: string;
  name: string;
  order: number;
  outcomes: Outcome[];
}

export interface Study {
  id: string;
  reviewId: string;
  label: string;
  year?: number | null;
  authors?: string | null;
  doi?: string | null;
  pdfPath?: string | null;
  status: string;
  excludeReason?: string | null;
  design?: string | null;
  picos?: string | null; // JSON string
  indexTest?: string | null;
  referenceStandard?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reference {
  id: string;
  reviewId: string;
  title: string;
  authors: string;
  year?: number | null;
  journal?: string | null;
  doi?: string | null;
  pmid?: string | null;
  rawRis?: string | null;
  stage?: string | null;
  decision?: string | null; // INCLUDE | EXCLUDE | MAYBE | null
  excludeReason?: string | null;
}

export interface RobAssessment {
  id: string;
  studyId: string;
  tool: RobTool;
  domainJudgements: Record<string, RobJudgement>;
  signallingAnswers: Record<string, "yes" | "no" | "py" | "pn" | "ni" | "na">;
  overallJudgement?: RobJudgement | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrismaFlowBox {
  id: string;
  label: string;
  count: number;
  autoCount?: boolean;
}

export interface PrismaFlow {
  reviewId: string;
  boxes: PrismaFlowBox[];
}

export interface Review {
  id: string;
  title: string;
  researchQuestion?: string | null;
  type: ReviewType;
  subType?: ReviewSubType | null;
  status: ReviewStatus;
  phase: ReviewPhase;
  createdAt: string;
  updatedAt: string;
  comparisons: Comparison[];
  studies: Study[];
  references: Reference[];
  robAssessments: RobAssessment[];
  prismaFlow?: PrismaFlow | null;
}

export interface ReviewFile {
  format: "revkit-1";
  formatVersion: "1.0.0";
  createdAt: string;
  updatedAt: string;
  appVersion: string;
  review: Review;
}

export const REVIEW_TYPES: {
  value: ReviewType;
  label: string;
  description: string;
  usesRob2: boolean;
  usesRobinsI: boolean;
  usesQuadas2: boolean;
  usesDta: boolean;
}[] = [
  {
    value: "INTERVENTION",
    label: "Intervention",
    description: "Does X work for Y? Compare 2+ interventions.",
    usesRob2: true,
    usesRobinsI: true,
    usesQuadas2: false,
    usesDta: false,
  },
  {
    value: "DTA",
    label: "Diagnostic Test Accuracy",
    description: "How good is test X for disease Y?",
    usesRob2: false,
    usesRobinsI: false,
    usesQuadas2: true,
    usesDta: true,
  },
  {
    value: "METHODOLOGY",
    label: "Methodology",
    description: "How good is method X?",
    usesRob2: true,
    usesRobinsI: true,
    usesQuadas2: false,
    usesDta: false,
  },
  {
    value: "OVERVIEW",
    label: "Overview of Reviews",
    description: "Summary of multiple existing reviews.",
    usesRob2: false,
    usesRobinsI: false,
    usesQuadas2: false,
    usesDta: false,
  },
  {
    value: "FLEXIBLE",
    label: "Flexible / Custom",
    description: "User-defined review structure.",
    usesRob2: true,
    usesRobinsI: true,
    usesQuadas2: true,
    usesDta: false,
  },
];

export const REVIEW_SUBTYPES: { value: Exclude<ReviewSubType, null>; label: string }[] = [
  { value: "PROGNOSIS", label: "Prognosis" },
  { value: "ETIOLOGY", label: "Etiology" },
  { value: "QUALITATIVE", label: "Qualitative" },
];

export const REVIEW_PHASES: { value: ReviewPhase; label: string }[] = [
  { value: "scoping", label: "Scoping" },
  { value: "screening", label: "Screening" },
  { value: "extraction", label: "Data Extraction" },
  { value: "analysis", label: "Analysis" },
  { value: "writing", label: "Writing" },
  { value: "complete", label: "Complete" },
];

export const EXCLUDE_REASONS = [
  "Wrong population",
  "Wrong intervention",
  "Wrong comparator",
  "Wrong outcome",
  "Wrong study design",
  "Not RCT",
  "Duplicate",
  "Withdrawn",
  "Insufficient data",
  "Conference abstract only",
];

export const STUDY_DESIGNS = [
  "RCT — parallel",
  "RCT — crossover",
  "RCT — cluster",
  "Quasi-RCT",
  "Cohort — prospective",
  "Cohort — retrospective",
  "Case-control",
  "Cross-sectional",
  "Case series",
  "DTA — cohort",
  "DTA — case-control",
  "Other",
];
