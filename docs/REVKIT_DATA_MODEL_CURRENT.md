# REVKIT — DATA MODEL (CURRENT)

> **Phase 2A deliverable per Master Repair Prompt §3:**
> > "Before modifying Prisma: map the existing data model. Produce: `docs/REVKIT_DATA_MODEL_CURRENT.md`. Then compare it with the target conceptual model."
>
> **Scope:** Verbatim map of every model in `prisma/schema.prisma` at commit `88c129d`, plus the TypeScript domain types in `src/lib/types.ts` and the runtime usage patterns. No schema changes are proposed in this document — that is the job of subsequent phases (2B–2N). This document is descriptive, not prescriptive.

---

## 1. Target conceptual model (per prompt §3)

```
REVIEW
  ↓
PROTOCOL
  ↓
SEARCH
  ↓
REFERENCE
  ↓
REPORT
  ↓
STUDY
  ↓
ARM
  ↓
OUTCOME
  ↓
TIMEPOINT
  ↓
EXTRACTED DATA
  ↓
RISK OF BIAS
  ↓
ANALYSIS
  ↓
EVIDENCE
  ↓
REPORT (output)
```

The prompt is explicit (§3): "Do not force this exact schema if the current architecture already provides equivalent semantics. The goal is semantic correctness, not schema conformity."

---

## 2. Current data model — entity inventory

The current Prisma schema declares **11 models**: 9 domain models + 2 team/profile models.

### 2.1 Domain models

| # | Model | File:line | Purpose | Target equivalent | Semantic match? |
|---|---|---|---|---|---|
| 1 | `Review` | `prisma/schema.prisma:13` | Top-level review container | REVIEW | ✅ |
| 2 | `Comparison` | `prisma/schema.prisma:30` | Group of outcomes | (Cochrane concept) | ⚠️ Extra |
| 3 | `Outcome` | `prisma/schema.prisma:39` | Outcome definition + analysis config (conflated) | OUTCOME + ANALYSIS | ❌ Conflated |
| 4 | `Subgroup` | `prisma/schema.prisma:55` | Subgroup within an outcome | (subset of OUTCOME/ANALYSIS) | ⚠️ Partial |
| 5 | `DataPoint` | `prisma/schema.prisma:64` | Per-study extracted values (2-arm assumption) | EXTRACTED DATA | ⚠️ Partial |
| 6 | `Study` | `prisma/schema.prisma:93` | Underlying research entity + extraction metadata (conflated) | STUDY + (parts of) EXTRACTION | ❌ Conflated |
| 7 | `Reference` | `prisma/schema.prisma:115` | Bibliographic record + screening decision (conflated) | REFERENCE + REPORT + SCREENING | ❌ Conflated |
| 8 | `RobAssessment` | `prisma/schema.prisma:131` | RoB judgement per study | RISK OF BIAS | ⚠️ Partial |
| 9 | `PrismaFlow` | `prisma/schema.prisma:145` | 11-box PRISMA template (JSON blob) | PRISMA | ⚠️ Partial |

### 2.2 Team & profile models

| # | Model | File:line | Purpose | Notes |
|---|---|---|---|---|
| 10 | `TeamMember` | `prisma/schema.prisma:156` | Reviewer identity | Has `isCurrentUser` flag; designed for NextAuth migration |
| 11 | `UserProfile` | `prisma/schema.prisma:168` | Singleton profile | `autoBackupMinutes` exists but never read |

### 2.3 Missing target entities

| Target entity | Status | Impact if not added |
|---|---|---|
| PROTOCOL | ❌ Missing | Cannot distinguish PLANNED vs ACTUAL |
| SEARCH | ❌ Missing | PRISMA counts have no provenance |
| REPORT | ❌ Missing | One study with 4 publications = 4 references; double-counting risk |
| ARM | ❌ Missing | Multi-arm trials unsupported; shared comparator double-counted |
| TIMEPOINT | ❌ Missing | Incompatible timepoints can be pooled |
| ANALYSIS (snapshot) | ❌ Missing | No versioning; no stale detection; no reproducibility |
| EVIDENCE (GRADE) | ❌ Missing | No Summary of Findings table |
| SCREENING DECISION | ❌ Missing | No reviewer + date + note + conflict per decision |
| EXTRACTION (round) | ❌ Missing | No dual-reviewer extraction; no extraction history |
| AUDIT TRAIL entry | ❌ Missing | No WHO/WHAT/WHEN/BEFORE/AFTER |

---

## 3. Current data model — verbatim field map

### 3.1 `Review` (prisma/schema.prisma:13–28)

```prisma
model Review {
  id                String           @id
  title             String
  researchQuestion  String?
  type              String           // INTERVENTION | DTA | METHODOLOGY | OVERVIEW | FLEXIBLE
  subType           String?
  status            String           @default("draft")
  phase             String           @default("scoping")
  createdAt         String           // ISO 8601
  updatedAt         String
  comparisons       Comparison[]
  studies           Study[]
  references        Reference[]
  robAssessments    RobAssessment[]
  prismaFlow        PrismaFlow?
}
```

**Observations:**
- `type` and `subType` are typed as plain `String` in Prisma; the TS layer narrows to unions.
- No `appVersion`, `lastSavedBy`, `protocolId`, or `searchId` fields.
- `id` is a plain `String @id` with no default — callers must mint IDs via `newId()` in `lib/project/id.ts`.

---

### 3.2 `Comparison` (prisma/schema.prisma:30–37)

```prisma
model Comparison {
  id        String    @id
  reviewId  String
  name      String
  order     Int
  review    Review    @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  outcomes  Outcome[]
}
```

**Observations:**
- Cochrane concept — groups outcomes by intervention comparison.
- No `intervention` / `comparator` fields — just a free-text `name`.

---

### 3.3 `Outcome` (prisma/schema.prisma:39–53) — **conflated with ANALYSIS config**

```prisma
model Outcome {
  id            String      @id
  comparisonId  String
  name          String
  dataType      String      // DICHOTOMOUS | CONTINUOUS | OE_V | GIV | DTA_2x2
  effectMeasure String
  method        String      // MH | PETO | IV | DL | LOGIT_UNIVARIATE | HSROC
  model         String      @default("fixed")
  unit          String?
  timeFrame     String?
  order         Int
  comparison    Comparison  @relation(fields: [comparisonId], references: [id], onDelete: Cascade)
  subgroups     Subgroup[]
  dataPoints    DataPoint[]
}
```

**Conflation issue:** `name`, `dataType`, `unit`, `timeFrame` are outcome-definition. `effectMeasure`, `method`, `model` are analysis-config. Spec §3 separates OUTCOME from ANALYSIS.

**Missing outcome-definition fields** (per spec §12): `definition`, `measurementInstrument`, `outcomeType`, `directionOfBenefit`, `priority`, `notes`.

**Missing analysis-config fields** (per spec §20): `confidenceLevel`, `zeroEventMethod`, `continuityCorrection`, `subgroupSettings`, `sensitivitySettings`, `inclusionFilters`, `statisticalEngineVersion`.

---

### 3.4 `Subgroup` (prisma/schema.prisma:55–62)

```prisma
model Subgroup {
  id          String      @id
  outcomeId   String
  name        String
  order       Int
  outcome     Outcome     @relation(fields: [outcomeId], references: [id], onDelete: Cascade)
  dataPoints  DataPoint[]
}
```

---

### 3.5 `DataPoint` (prisma/schema.prisma:64–91) — **2-arm assumption + no provenance**

```prisma
model DataPoint {
  id          String    @id
  outcomeId   String
  subgroupId  String?
  studyId     String
  events1     Int?
  total1      Int?
  events2     Int?
  total2      Int?
  mean1       Float?
  sd1         Float?
  n1          Int?
  mean2       Float?
  sd2         Float?
  n2          Int?
  oE          Float?
  v           Float?
  effect      Float?
  se          Float?
  tp          Int?
  fp          Int?
  fn          Int?
  tn          Int?
  order       Int
  outcome     Outcome   @relation(fields: [outcomeId], references: [id], onDelete: Cascade)
  subgroup    Subgroup? @relation(fields: [subgroupId], references: [id], onDelete: SetNull)
  study       Study     @relation(fields: [studyId], references: [id], onDelete: Cascade)
}
```

**2-arm assumption:** `events1/total1/events2/total2` hard-codes 2 arms.

**No provenance fields** (spec §15).

**No value classification** (spec §15).

**No missingness states** (spec §17).

**Missing data types** (spec §14): no time-to-event; no median/IQR/range/p/CI.

---

### 3.6 `Study` (prisma/schema.prisma:93–113) — **conflated with extraction metadata**

```prisma
model Study {
  id                String           @id
  reviewId          String
  label             String
  year              Int?
  authors           String?
  doi               String?
  pdfPath           String?
  status            String           @default("screening")
  excludeReason     String?
  design            String?
  picos             String?          // JSON string
  indexTest         String?
  referenceStandard String?
  notes             String?
  createdAt         String
  updatedAt         String
  review            Review           @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  dataPoints        DataPoint[]
  robAssessments    RobAssessment[]
}
```

**Conflation issue:** `label`, `year`, `authors`, `doi` are bibliographic — belong on `Reference`. `design`, `picos`, `indexTest`, `referenceStandard`, `notes` are extraction-level.

**Missing fields** (spec §10): country, setting, recruitmentPeriod, sampleSize, population, eligibility, funding, conflicts, registration, baselineCharacteristics, followUp.

**No link to `Reference`/`Report`.**

---

### 3.7 `Reference` (prisma/schema.prisma:115–129) — **conflated with REPORT + SCREENING**

```prisma
model Reference {
  id              String   @id
  reviewId        String
  title           String
  authors         String
  year            Int?
  journal         String?
  doi             String?
  pmid            String?
  rawRis          String?
  stage           String?
  decision        String?
  excludeReason   String?
  review          Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
}
```

**Conflation issue:** Bibliographic fields + screening fields. Spec demands a REPORT entity for the publication document.

**Deduplication:** `lib/project/state.ts:477–482` deduplicates by `title+year`. Spec §5 demands DOI + PMID + title + authors + year + journal + registration number.

**`rawRis: String?`** stores the entire original RIS chunk per record — wasteful.

---

### 3.8 `RobAssessment` (prisma/schema.prisma:131–143) — **single-reviewer, no history**

```prisma
model RobAssessment {
  id                String   @id
  studyId           String
  tool              String   // ROB2 | ROBINS_I | QUADAS_2
  domainJudgements  String   // JSON string
  signallingAnswers String   // JSON string
  overallJudgement  String?
  createdAt         String
  updatedAt         String
  study             Study    @relation(fields: [studyId], references: [id], onDelete: Cascade)
  review            Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  reviewId          String
}
```

**Single-reviewer:** No `reviewerId`. No second-reviewer role, no disagreement detection, no resolution workflow (spec §31).

**No history:** Overwriting destroys previous judgement.

**No `overrideReason` field.**

**Algorithm fidelity:** See FORENSIC_AUDIT §7 — RoB 2 + ROBINS-I use count heuristics, not per-domain truth tables.

---

### 3.9 `PrismaFlow` (prisma/schema.prisma:145–150) — **disconnected from review state**

```prisma
model PrismaFlow {
  id        String  @id
  reviewId  String  @unique
  boxes     String  // JSON string of 11-box template
  review    Review  @relation(fields: [reviewId], references: [id], onDelete: Cascade)
}
```

**Disconnected:** The 11 box counts are stored as a JSON blob. No FK relationship to `Reference` or `Study` tables.

**No integrity validation** (spec §32).

---

### 3.10 `TeamMember` (prisma/schema.prisma:156–166)

```prisma
model TeamMember {
  id          String   @id @default(cuid())
  name        String
  email       String?
  role        String   @default("reviewer")
  initials    String
  color       String   @default("#14b8a6")
  isCurrentUser Boolean @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Observations:**
- Reasonable reviewer-identity model.
- No link from `RobAssessment` or `ScreeningDecision` to `TeamMember.id`.

---

### 3.11 `UserProfile` (prisma/schema.prisma:168–188)

```prisma
model UserProfile {
  id              String   @id @default("singleton")
  currentMemberId String?
  density         String   @default("compact")
  fontScale       String   @default("medium")
  reduceMotion    Boolean  @default(false)
  tooltipsEnabled Boolean  @default(true)
  tooltipsDensity String   @default("detailed")
  defaultEffectMeasure String @default("OR")
  defaultMethod        String @default("MH")
  defaultModel         String @default("fixed")
  defaultConfidence    Float  @default(0.95)
  decimalPlaces       Int    @default(2)
  autoBackupMinutes  Int    @default(15)
  maxRecentFiles     Int    @default(20)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

**Observations:**
- Singleton pattern (`id: "singleton"`).
- `autoBackupMinutes` is **dead schema** — no code reads it.
- `defaultEffectMeasure` etc. are **global** defaults — should be per-analysis per spec §20.

---

## 4. Current data model — relationships diagram

```
                           ┌─────────────────┐
                           │   TeamMember    │  (no FK from any domain model)
                           │  isCurrentUser  │
                           └─────────────────┘
                                   │
                                   ▼ (via currentMemberId)
                           ┌─────────────────┐
                           │   UserProfile   │  (singleton)
                           └─────────────────┘

                           ┌─────────────────┐
                           │     Review      │
                           └─────────────────┘
                            │ │ │ │ │
       ┌────────────────────┘ │ │ │ └─────────────────────┐
       ▼                      ▼ ▼ ▼                       ▼
┌────────────┐         ┌──────────┐ ┌──────────┐    ┌──────────┐
│ Comparison │         │  Study   │ │Reference │    │PrismaFlow│
└────────────┘         └──────────┘ └──────────┘    └──────────┘
       │                  │ │
       ▼                  │ │
┌────────────┐            │ │
│  Outcome   │            │ │    (no FK Reference → Study)
│ (mixed)    │            │ │    (no FK Study → Reference)
└────────────┘            │ │
       │                  │ │
       ├─→ Subgroup       │ │
       │                  │ │
       └─→ DataPoint ◀────┘ │
            (2-arm only)    │
                           │
                           ▼
                    ┌──────────────┐
                    │ RobAssessment│
                    └──────────────┘
```

**Missing links:**
- `Reference` ↔ `Study`
- `Reference` ↔ `Report`
- `Study` ↔ `Arm`
- `Outcome` ↔ `Timepoint`
- `Outcome` ↔ `Analysis`
- `RobAssessment` ↔ `TeamMember`
- `PrismaFlow` ↔ `Reference` / `Study`
- No `Protocol` link from `Review`
- No `Search` link from `Review`
- No `Evidence` / `GradeAssessment` link from `Outcome`
- No `AuditTrail` entity

---

## 5. Current data model — runtime usage patterns

### 5.1 Mutations (`src/lib/project/state.ts`)

The Zustand store exposes ~30 mutation actions, all of which:
- Set `isDirty: true`.
- Use immutable spread.
- Bump `updatedAt` on the affected entity.

Notable patterns:
- `setDataPointValue` (L359–384) iterates **all comparisons × outcomes × subgroups** on every cell edit — O(N·M) per keystroke.
- `addReferences` (L466–490) dedups by `title+year`. Sets the `added` counter twice (first is dead).
- `setReview` (L91) doesn't set `dbId` — caller must remember to call `markSaved(r.id)` separately.
- `deleteStudy` (L440–464) cascades to `robAssessments` and `dataPoints` in-memory ✓.

### 5.2 Persistence (`src/app/api/reviews/route.ts`)

- `loadReviewTree` (L25–158) hydrates from 4 sequential `findMany` calls.
- `persistReviewTree` (L270–392) writes one `create()` per entity — no `createMany`, no `db.$transaction`.
- **PUT handler (L249–253) uses unscoped `deleteMany({})`** — release blocker.
- `JSON.parse` on JSON-blob fields will throw on corrupt data.

### 5.3 TypeScript types (`src/lib/types.ts`)

The TS layer is **stricter than Prisma** — narrows plain `String` columns to unions. But some fields remain loose:
- `Reference.stage: string | null`
- `Reference.decision: string | null`
- `Study.status: string`
- `Study.design: string | null`

---

## 6. Current data model — comparison with target conceptual model

| Target entity | Current equivalent | Semantic match | Gap summary |
|---|---|---|---|
| REVIEW | `Review` | ✅ | Missing `appVersion`, `lastSavedBy`, `protocolId`, `searchIds[]` |
| PROTOCOL | — | ❌ | Not modeled |
| SEARCH | — | ❌ | Not modeled |
| REFERENCE | `Reference` (bibliographic fields only) | ⚠️ | Conflated with REPORT + SCREENING |
| REPORT | — | ❌ | Not modeled |
| STUDY | `Study` (label + extraction fields) | ⚠️ | Conflated with EXTRACTION |
| ARM | — | ❌ | Not modeled |
| OUTCOME | `Outcome` (name + unit + timeFrame) | ⚠️ | Conflated with ANALYSIS |
| TIMEPOINT | — | ❌ | `Outcome.timeFrame: String?` is free-text |
| EXTRACTED DATA | `DataPoint` | ⚠️ | 2-arm assumption. No provenance. No classification. No missingness |
| RISK OF BIAS | `RobAssessment` | ⚠️ | Single-reviewer. No history. No `overrideReason` |
| ANALYSIS | `Outcome.effectMeasure/method/model` (conflated) | ❌ | No snapshot. No versioning. No stale detection |
| EVIDENCE (GRADE) | — | ❌ | Not modeled |
| REPORT (output) | — | ❌ | One-shot exports |
| SCREENING DECISION | `Reference.stage` + `Reference.decision` (conflated) | ❌ | No reviewer. No date. No conflict |
| EXTRACTION (round) | — | ❌ | No dual-reviewer extraction |
| AUDIT TRAIL | — | ❌ | No WHO/WHAT/WHEN/BEFORE/AFTER entity |

---

## 7. Semantic correctness assessment

The Phase 2 prompt (§3) says: "The goal is semantic correctness, not schema conformity." The current model is **semantically incorrect** in 4 critical ways:

### 7.1 Reference / Report / Study conflation (semantic correctness fail)

**Spec demand (§4):** "STUDY ≠ REPORT ≠ REFERENCE. The same underlying study must not accidentally enter a meta-analysis four times."

**Current reality:** `Reference` is the only entity. A study published 4 times would be entered as 4 separate references and 4 separate studies. The meta-analysis would pool the same underlying study 4 times.

### 7.2 Outcome / Analysis conflation (semantic correctness fail)

**Spec demand (§21):** "Primary / Sensitivity / Subgroup / Exploratory. Do not overwrite previous analysis states."

**Current reality:** `Outcome.effectMeasure/method/model` are mutable columns. Changing the method overwrites the previous result.

### 7.3 DataPoint 2-arm assumption (semantic correctness fail)

**Spec demand (§11):** "Support arbitrary numbers of arms."

**Current reality:** `DataPoint.events1/total1/events2/total2` hard-codes 2 arms. Multi-arm trials cannot be represented.

### 7.4 No provenance (semantic correctness fail)

**Spec demand (§15):** "Every important extracted number should be traceable."

**Current reality:** `DataPoint` has no provenance fields. A calculated SD looks identical to a reported SD.

---

## 8. Data safety assessment

Before any schema migration in subsequent phases:

### 8.1 Release blocker: `PUT /api/reviews` (api/reviews/route.ts:249–253)

Unscoped `deleteMany({})` on `dataPoint`, `subgroup`, `outcome`, `robAssessment` wipes data across **all** reviews on every save.

**Fix:** Rely on cascade deletes from `comparison.deleteMany({ where: { reviewId } })` + `study.deleteMany({ where: { reviewId } })` + `reference.deleteMany({ where: { reviewId } })` + `prismaFlow.deleteMany({ where: { reviewId } })` + `robAssessment.deleteMany({ where: { reviewId } })`. Wrap in `db.$transaction([...])`.

### 8.2 No backup-on-save

Spec §39 demands `.bak` copy before every save. Currently no `.bak` is created anywhere.

### 8.3 No migration framework

Prisma migrations exist but there is no application-level migration framework for the `.revkit` file format.

### 8.4 JSON-blob fields are fragile

`RobAssessment.domainJudgements`, `RobAssessment.signallingAnswers`, `PrismaFlow.boxes`, `Study.picos` are all `String` columns storing JSON. A corrupted JSON string will silently break loading.

---

## 9. Recommendations for Phase 2B (Reference / Report / Study distinction)

**Descriptive — not prescriptive.** Phase 2B will produce the actual schema migration.

### 9.1 Add `Report` entity (new)

```prisma
model Report {
  id              String   @id
  reviewId        String
  studyId         String?
  referenceId     String
  publicationType String   // primary | follow_up | subgroup | registry | abstract | dissertation | preprint
  isPrimary       Boolean  @default(false)
  notes           String?
  createdAt       String
  updatedAt       String
  review          Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  study           Study?   @relation(fields: [studyId], references: [id], onDelete: SetNull)
  reference       Reference @relation(fields: [referenceId], references: [id], onDelete: Cascade)
}
```

### 9.2 Strip screening fields from `Reference`

Move `stage`, `decision`, `excludeReason` to a new `ScreeningDecision` entity (Phase 2C).

### 9.3 Strip bibliographic fields from `Study`

`Study.year`, `Study.authors`, `Study.doi` duplicate `Reference`. Remove them.

### 9.4 Add `Report → Study` link

`Report.studyId: String?` (nullable until linked).

### 9.5 Add study-identity-resolution fields to `Reference`

- `registrationNumber: String?`
- `source: String?`
- `importBatch: String?`
- `notes: String?`

### 9.6 Don't touch `DataPoint` yet

The 2-arm assumption is a Phase 2E concern. Phase 2B should focus on Reference/Report/Study only.

---

## 10. Phase 2A acceptance

Per the Phase 2 Master Repair Prompt §53:

- **COMPLETED:** Map of current data model (9 domain models + 2 team/profile models). Comparison with target conceptual model (14 target entities). Identification of 4 critical conflation issues. Identification of 10 missing target entities.
- **FILES CHANGED:** None. Phase 2A is documentation-only.
- **DATABASE CHANGES:** None.
- **TESTS RUN:** None.
- **TEST RESULTS:** N/A.
- **STATISTICAL VALIDATION:** None.
- **DATA SAFETY:** No user data touched. The release-blocker PUT bug (§8.1) is documented but **not yet fixed** — that is the first task of Phase 2B.
- **KNOWN ISSUES:** See `docs/REVKIT_FORENSIC_AUDIT.md` §1–§14. The 5 release blockers (RB-1 through RB-5) must be fixed before any schema migration.
- **NEXT PHASE:** Phase 2B — Reference / Report / Study distinction. First task: fix the PUT bug (RB-1) so subsequent schema migrations don't risk cross-review data loss.

---

*End of Phase 2A data-model map. Companion to `docs/REVKIT_FORENSIC_AUDIT.md` and `docs/REVKIT_GAP_MATRIX.md`.*
