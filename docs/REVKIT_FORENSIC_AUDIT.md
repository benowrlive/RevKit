# REVKIT — FORENSIC AUDIT

> **Purpose:** Pre-flight audit required by the Phase 2 Master Repair Prompt §0. Source of truth for what has been **verified** as broken, incomplete, or missing in the RevKit codebase at commit `88c129d` (HEAD of `main`).
>
> **Method:** Three parallel subagent audits (stats engine; persistence/export; components/DX) plus a Phase 2-specific gap pass against the Phase 2 Master Repair Prompt's 14 phases (2A–2N) and 53 numbered sections.
>
> **Companion docs:** `docs/REVKIT_GAP_MATRIX.md` (requirement × state matrix), `docs/REVKIT_DATA_MODEL_CURRENT.md` (Phase 2A output).

---

## 0. Forensic verdict

| Dimension | Verdict | Headline |
|---|---|---|
| Statistical engine | ⚠️ Mostly correct, 1 outright bug | RD wrongly applies continuity correction; MH RR variance needs R-verification; HSROC is simplified, not full bivariate — labeled correctly |
| Data model | ❌ Conflated concepts | `Reference` does double-duty as both bibliographic record AND report; `Outcome` conflates outcome definition with analysis config; no Arm, Timepoint, Protocol, Search, Analysis-snapshot, or Evidence entities |
| Screening workflow | ⚠️ Single-reviewer only | No conflict detection, no second-reviewer role, no resolution workflow, no audit trail |
| Extraction | ❌ No provenance | Extracted numbers have no source report / page / table / figure / reviewer / date; no DIRECTLY_REPORTED vs CALCULATED vs ESTIMATED classification |
| Analysis versioning | ❌ Non-existent | Analysis = current outcome config + current data points; no snapshot, no version history, no stale detection, no sensitivity-analysis branching |
| Risk of bias | ❌ Algorithms fail spec | RoB 2 + ROBINS-I use count heuristics, not official per-domain truth tables (fails BMJ 2019;366:l4898 fidelity) |
| PRISMA | ⚠️ Disconnected | Counts are auto-derived heuristically but not validated against review state; no integrity warnings |
| Evidence / GRADE | ❌ Not implemented | Spec §35 demands GRADE Summary of Findings; absent entirely |
| Reporting | ❌ Half-built | Word export is HTML-as-`.doc`; CSV is single concatenated file, not ZIP; no stale-check before export |
| Portability | ❌ No `.revkit` files | All persistence via SQLite/REST; users cannot save/open/share portable review files |
| Integrity center | ❌ Not implemented | Spec §36 demands `/integrity` workspace surfacing duplicate studies, missing extraction, stale analyses, PRISMA mismatches, etc. |
| Tests / CI | ❌ None | No `tests/`, no `.github/workflows/`, `ignoreBuildErrors: true` |
| Persistence safety | 🚨 Critical bug | `PUT /api/reviews` uses unscoped `deleteMany({})` — wipes outcomes/subgroups/data points/RoB across ALL reviews on every save |

---

## 1. Phase 2A — Data integrity and domain model

**Status:** ❌ Major gaps

### 1.1 Current data model (Prisma)

The current schema has 9 domain models + 2 team/profile models:

| Model | Purpose | Spec equivalent |
|---|---|---|
| `Review` | Top-level review container | REVIEW ✓ |
| `Comparison` | Group of outcomes (e.g. "Aspirin vs placebo") | (no direct equivalent — Cochrane uses "Comparison" similarly) |
| `Outcome` | Outcome definition **+ analysis config (conflated)** | OUTCOME + ANALYSIS (conflated ❌) |
| `Subgroup` | Subgroup within an outcome | (subset of OUTCOME) |
| `DataPoint` | Per-study extracted values | EXTRACTED DATA ✓ (but missing provenance) |
| `Study` | Underlying research entity | STUDY ✓ (but conflated with REPORT ❌) |
| `Reference` | Bibliographic record **+ screening decision (conflated)** | REFERENCE + REPORT (conflated ❌) |
| `RobAssessment` | RoB judgement per study | RISK OF BIAS ✓ (but no reviewer/disagreement/history) |
| `PrismaFlow` | 11-box PRISMA template | PRISMA ✓ (but disconnected from review state) |

### 1.2 Missing entities (per Phase 2 prompt §3)

| Target entity | Status | Impact |
|---|---|---|
| PROTOCOL | ❌ Missing | Cannot distinguish PLANNED vs ACTUAL outcomes/subgroups/analyses (§34) |
| SEARCH | ❌ Missing | Cannot track search strategies per database (§33); PRISMA "Records from databases/registers" count is heuristic |
| REPORT | ❌ Missing (conflated into `Reference`) | One study with 4 publications is treated as 4 separate references; risk of double-counting in meta-analysis (§4) |
| ARM | ❌ Missing (conflated into `DataPoint.events1/total1/events2/total2`) | Multi-arm trials unsupported (§11, §18); shared comparator will be double-counted |
| TIMEPOINT | ❌ Missing (conflated into `Outcome.timeFrame: String?`) | Multiple timepoints per outcome unsupported (§13); incompatible timepoints can be pooled |
| ANALYSIS (snapshot) | ❌ Missing (conflated into `Outcome.method/model/effectMeasure`) | No versioning (§19, §20, §21); no stale detection (§22); no reproducibility (§23) |
| EVIDENCE (GRADE) | ❌ Missing | Spec §35 demands GRADE Summary of Findings |

### 1.3 Conflation issues (semantic correctness)

1. **`Reference` = REFERENCE + REPORT + screening decision.** Should be split: bibliographic metadata stays on `Reference`; document-level metadata (publication type, primary-vs-followup, study link) goes on `Report`; screening decisions go on a `ScreeningDecision` entity.
2. **`Study` = STUDY + extraction-level metadata.** `Study.design`, `Study.picos`, `Study.indexTest`, `Study.referenceStandard`, `Study.notes` belong on a `StudyExtraction` entity.
3. **`Outcome` = OUTCOME definition + ANALYSIS config.** `Outcome.effectMeasure`, `Outcome.method`, `Outcome.model` are analysis-time decisions, not outcome-definition properties.
4. **`DataPoint` = EXTRACTED DATA + per-cell values.** The 2×2 dichotomous cell layout bakes in a 2-arm assumption.

### 1.4 Data safety

- **`PUT /api/reviews` (route.ts:249–253)** uses unscoped `deleteMany({})`. Release blocker.
- No `db.$transaction` wrapping the delete+create.
- No backup-on-save. No `.bak` file. No migration backup.
- `autoBackupMinutes` profile setting exists but no code reads it.

---

## 2. Phase 2B — Reference → Report → Study identity

**Status:** ❌ Not implemented

### 2.1 Reference / Report / Study distinction (§4)

No `Report` entity. `Reference.stage` and `Reference.decision` carry screening state — these are report-level concerns, not bibliographic. `Study.authors`/`Study.year`/`Study.doi` duplicate bibliographic metadata that already exists on `Reference`.

**Concrete failure mode:** A study published in 2019 (primary), 2021 (follow-up), 2022 (subgroup analysis), and 2023 (safety report) would today be entered as 4 separate references and 4 separate studies. The meta-analysis would pool the same underlying study 4 times.

### 2.2 Study identity resolution (§5)

- **Dedup on import** is `title.toLowerCase().trim() + "|" + year` (`state.ts:477–482`). Spec §5 demands DOI + PMID + title + authors + year + journal + registration number.
- **No "POSSIBLE SAME STUDY" detection.**
- **No MERGE REFERENCES / LINK TO EXISTING STUDY / CREATE NEW STUDY / REVIEW LATER actions** (§5).

---

## 3. Phase 2C — Screening and reviewer workflow

**Status:** ❌ Single-reviewer only

### 3.1 Two-stage screening (§7)

- `Reference.stage` is `string | null`. Spec demands explicit `"title_abstract" | "full_text" | null` union.
- `Reference.decision` is `string | null` — values are `"INCLUDE" | "EXCLUDE" | "MAYBE" | null`, not enforced.
- **Full-text stage is not modeled separately.**
- No `ScreeningDecision` entity recording reviewer + date + note + reason.

### 3.2 Conflict resolution (§7 CONFLICT)

**Entirely absent.** No two-reviewer screening, no disagreement detection, no `CONFLICT` entity, no resolution workflow, no audit trail.

### 3.3 Screening work queue (§8)

The references page is a table — not a fast OPEN → READ → DECIDE → NEXT queue. No keyboard navigation. No progress tracker.

---

## 4. Phase 2D — Extraction workspace

**Status:** ❌ No provenance, no arm/timepoint model

### 4.1 Study → Report → Arm → Outcome → Timepoint → Data (§9)

Current chain is `Study → DataPoint` (flat). No `Arm` entity. No `Timepoint` entity. No `Report` link.

### 4.2 Study-level extraction (§10)

Missing: country, setting, recruitment period, sample size, population, eligibility, funding, conflicts, registration, baseline characteristics, follow-up.

### 4.3 Arm-level extraction (§11)

**Not implemented.** Multi-arm trials (§18) unsupported.

### 4.4 Outcome-level extraction (§12)

Missing: definition, measurement instrument, outcome type, direction of benefit, priority.

### 4.5 Timepoint model (§13)

`Outcome.timeFrame: String?` is free-text, not structured.

### 4.6 Extraction data types (§14)

| Type | Status |
|---|---|
| Dichotomous (events/total) | ✅ |
| Continuous (mean/SD/N) | ✅ |
| Generic inverse variance (effect/SE) | ✅ |
| OE_V (oE/v) | ✅ |
| DTA 2x2 (TP/FP/FN/TN) | ✅ |
| Time-to-event (HR/log HR/SE) | ❌ Missing |
| Other reported (median/IQR/range/p/CI) | ❌ Missing |

### 4.7 Data provenance (§15)

**Entirely absent.** No `Source report` / `Page` / `Table` / `Figure` / `Quote` / `Reviewer` / `Date` fields on `DataPoint`. No DIRECTLY_REPORTED / CALCULATED / CONVERTED / ESTIMATED / IMPUTED / DERIVED classification.

### 4.8 Calculation provenance (§16)

**Not implemented.** The original reported value is overwritten in place.

### 4.9 Missing data states (§17)

`DataPoint` uses nullable `Int?` / `Float?` fields. There is no explicit NOT_REPORTED / NOT_APPLICABLE / UNKNOWN / UNABLE_TO_EXTRACT / PENDING_AUTHOR_CONTACT / ESTIMATED classification.

### 4.10 Multi-arm trials (§18)

**Not supported.** `DataPoint.events1/total1/events2/total2` is a 2-arm layout. Multi-arm trials with shared comparators will double-count the comparator arm.

---

## 5. Phase 2F — Analysis versioning + stale detection

**Status:** ❌ Non-existent

### 5.1 Analysis dataset snapshots (§19)

**Not implemented.** No snapshot of: included studies / included reports / arms / outcomes / timepoint / extracted values / analysis population / filters.

### 5.2 Analysis configuration (§20)

`Outcome.effectMeasure`, `Outcome.method`, `Outcome.model` exist, but missing: CI level, zero-event method, continuity correction, subgroup settings, sensitivity settings, inclusion filters, statistical engine version.

### 5.3 Analysis versioning (§21)

**Not implemented.** No Primary / Sensitivity / Subgroup / Exploratory classification. No version numbers. No preservation of previous analysis states.

### 5.4 Stale analysis detection (§22)

**Not implemented.** No dependency tracking: EXTRACTION → DATASET → ANALYSIS → FIGURE → EVIDENCE → REPORT.

### 5.5 Reproducible analysis (§23)

**Not possible.** Without dataset snapshots + analysis config + engine version, an analysis result cannot be recovered.

---

## 6. Phase 2G — Statistical validation

**Status:** ⚠️ Engine mostly correct, no validation against R

### 6.1 Effect measures (§25)

| Measure | Status | Notes |
|---|---|---|
| RR | ✅ Implemented | `effect.ts:88–101`. ✓ |
| OR | ✅ Implemented | `effect.ts:106–119`. ✓ |
| RD | ⚠️ Bug | `effect.ts:128` wrongly applies continuity correction. **Verified bug.** |
| Peto OR | ✅ Implemented | `effect.ts:151–165`. No CC (correct). ✓ |
| MD | ✅ Implemented | `effect.ts:182–194`. ✓ |
| SMD (Hedges' g) | ✅ Implemented | `effect.ts:197–210`. J correction correct. ✓ |
| HR (time-to-event) | ❌ Missing | Not in `EffectMeasure` union. |
| GIV | ✅ Implemented | `effect.ts:248–258`. ✓ |
| Sensitivity / Specificity | ✅ Implemented | `dta.ts:130–165`. Wilson CIs. ✓ |
| DOR | ⚠️ Bug | `calculate.ts:158–173` dead code + spec violation. |
| LR+ / LR- | ✅ Implemented | `calculate.ts:131–155`. log-based CIs. ✓ |

### 6.2 Zero-event handling (§26)

- Continuity correction (0.5 to all cells when any is zero) is applied for MH/IV — but **not configurable**.
- No CC for Peto (correct).
- **No handling for double-zero studies.**

### 6.3 Heterogeneity (§27)

Q, df, p, I², τ², H all implemented. `max(0, I²)` correct. **Missing: prediction interval.**

### 6.4 Subgroup analysis (§28)

Subgroup pooling works, but **missing**: test for subgroup differences (Q-between).

### 6.5 Sensitivity analysis (§29)

**Not implemented as a saved configuration.**

### 6.6 DTA analysis (§30)

- Univariate logit pooling for Sens/Spec ✓
- DOR pooling ✓
- HSROC is **simplified** WLS, not full bivariate. UI presents it as "HSROC" without qualification.
- **Bivariate model** not implemented.

### 6.7 Validation against R

**No reference comparisons performed.** Spec §24 demands comparison with "established R implementations and published examples."

### 6.8 Numerical stability

- `normalCdf` (normal.ts:32) uses A&S 7.1.26 polynomial — max error 7.5×10⁻⁸. Spec L592 demands 1e-10 match against R. **Cannot meet tolerance.**
- `normalInverseCdf` (normal.ts:42) uses Acklam — relative error 1.15×10⁻⁹. Same problem.

---

## 7. Phase 2H — Risk of bias + disagreement + auditability

**Status:** ❌ Algorithms fail spec; no reviewer disagreement

### 7.1 RoB 2 algorithm (§31)

`rob/config.ts:190–219` uses count-based heuristics. **Verified divergence cases vs official Excel tool v22-Aug-2019:**

| Domain | Scenario | Official | Impl |
|---|---|---|---|
| D1 | Q1.1=Yes, Q1.2=NI | Some concerns | High ❌ |
| D2 | Q2.1=Yes, Q2.2=Yes, Q2.4=NI | High | Some concerns ❌ |
| D3 | Q3.1=Yes, Q3.2=Yes | High | Some concerns ❌ |
| D4 | Q4.1=Yes, Q4.2=No, Q4.3=Yes | High | Low ❌ |
| D5 | Q5.1=Yes, Q5.2=Yes, Q5.3=Yes | High | Low ❌ |

### 7.2 ROBINS-I V2 Nov 2024 (§31)

`rob/config.ts:351–368` uses `counts.no >= 2 → Critical, >= 1 → Serious`. The V2 spec defines per-domain truth tables.

### 7.3 QUADAS-2

`rob/config.ts:390–442` is a reasonable approximation: Low iff all "yes"; High iff any "no"; else Unclear. ✓

### 7.4 Reviewer disagreement (§31)

**Not implemented.** `RobAssessment` has no `reviewerId` field.

### 7.5 Audit trail (§41)

**Not implemented.**

### 7.6 RoB override reason

`rob-page.tsx:518` — the override-reason textarea carries a comment "not persisted."

---

## 8. Phase 2I — PRISMA + evidence/GRADE

**Status:** ⚠️ PRISMA partially OK; GRADE absent

### 8.1 PRISMA 2020 (§32)

- 11-box template matches canonical layout ✓.
- Auto-count from review state ✓ (heuristic).
- **Missing: integrity validation.** No `PRISMA INTEGRITY WARNING`.
- Counts are stored as a JSON blob, disconnected from the actual `Reference` and `Study` tables.

### 8.2 Search strategy management (§33)

**Not implemented.** No `Search` entity.

### 8.3 Protocol vs actual (§34)

**Not implemented.** No PROTOCOL entity.

### 8.4 GRADE evidence (§35)

**Entirely absent.** No `Evidence` or `GradeAssessment` entity.

---

## 9. Phase 2J — Reporting + export integrity

**Status:** ❌ Half-built

### 9.1 Word export (§37, §38)

- `lib/export/docx.ts` produces HTML with Office-namespace stubs. **Not OOXML.**
- **No embedded plots.**
- **No stale check.**
- Typography: Calibri 11pt, line-height 1.45, no justification. Spec demands TNR 12pt, 1.5 line, justified.

### 9.2 CSV export (§37, §38)

- Single concatenated `.csv`. Spec §37 demands ZIP.
- `buildIndividualCsvFiles` defined but never called.
- **No `narrative.md`.**
- **No round-trip importer.**

### 9.3 Plot PNG export

- `download.ts:112` uses `scale = 2` → ~144 DPI. Spec demands 300 DPI.

---

## 10. Phase 2K — Project portability + backup + recovery

**Status:** ❌ No `.revkit` files

### 10.1 Portable project (§39)

**Not implemented.** All persistence via SQLite/REST.

### 10.2 Backup / recovery (§40)

- `autoBackupMinutes: Int @default(15)` exists but **no code reads it**.
- No manual backup UI. No crash recovery. No migration backup.

### 10.3 Audit trail (§41)

See §7.5 — entirely absent.

### 10.4 Living review architecture (§42)

**Not implemented.** No Review v1 → Update v2 → Update v3 history preservation.

---

## 11. Phase 2L — Review Integrity Center

**Status:** ❌ Not implemented

Spec §36 demands a `/integrity` workspace. None of the 13 detectors exist:

| Issue | Status |
|---|---|
| Duplicate studies | ❌ |
| Duplicate reports | ❌ |
| Missing extraction | ❌ |
| Impossible counts | ⚠️ Partial |
| Missing RoB | ❌ |
| Analysis includes excluded study | ❌ |
| Stale analysis | ❌ |
| Incompatible timepoints | ❌ |
| Inconsistent outcomes | ❌ |
| Missing provenance | ❌ |
| PRISMA mismatch | ❌ |
| Protocol deviation | ❌ |
| Missing required fields | ❌ |

---

## 12. Phase 2M — UX workflow refinement

**Status:** ⚠️ Partial

- ✅ Data tables, compact layouts, inline editing.
- ⚠️ Keyboard navigation (only ⌘S).
- ❌ Command palette.
- ❌ Extraction work queue (spec §44).
- ❌ Three-part analysis UX (spec §45).
- ⚠️ Review progress (single enum, not derived from real workflow state per spec §46).

### 12.5 Performance (§47)

- 5000-reference imports will freeze (no virtualization).
- 1000-study forest plot will lag (no memoization).
- `setDataPointValue` O(N·M) per keystroke.
- `persistReviewTree` 2000 sequential INSERTs.

### 12.6 Accessibility (§48)

- ⚠️ Keyboard access (⌘S only).
- ✅ Focus visibility, screen-reader labels, contrast.
- ⚠️ Reduced motion (profile toggle, no auto-detect).
- ⚠️ Non-color-only status indicators (some badges use color alone).

---

## 13. Phase 2N — Regression testing

**Status:** ❌ None

### 13.1 Test infrastructure

- No `tests/` directory.
- No `.github/workflows/`.
- `package.json` has no `"test"` script.
- `next.config.ts:7` has `typescript.ignoreBuildErrors: true`.
- `tsconfig.json:13` has `noImplicitAny: false`.
- The only test file ever existed (`tests/stats-self-check.ts`) was **deliberately untracked** in commit `88c129d`.

### 13.2 Required fixtures (§50)

Spec §50 demands 15 specific fixtures. **None exist.**

---

## 14. Cross-cutting findings

### 14.1 Code hygiene

- 17 eslint rules disabled, most consequentially `react-hooks/exhaustive-deps: off` and `@typescript-eslint/no-explicit-any: off`.
- 3 large files: `settings-page.tsx` (1,943 LOC), `comparisons-page.tsx` (1,395 LOC), `rob-page.tsx` (1,216 LOC).
- Dead deps: `recharts` (~80 KB), `framer-motion` (used for 1 transition).
- Two icon libraries: `lucide-react` + `@phosphor-icons/react`.
- Dead exports: `chiSqPValue` (normal.ts:184), `derSimonianLairdDTA` (pooling.ts:461).
- DRY violation: continuity-correction logic duplicated 4×.

### 14.2 Security

- No auth on any API route.
- No CSRF protection.
- `Caddyfile` has no TLS, no rate limiting, no security headers.
- No input validation on `POST/PUT /api/reviews`.

### 14.3 Reproducibility gaps

The Phase 2 prompt's Definition of Done (§52) asks: "Can I reproduce it?" For the current codebase, the answer is **no** for every meaningful question.

---

## 15. Priority ordering for Phase 2 execution

| Phase | Priority | Rationale |
|---|---|---|
| 2A (data model) | 1 | Must map current state before any schema changes |
| 2A-stabilize (PUT bug + RD/DOR bugs) | 2 | Release blockers |
| 2B (Reference/Report/Study) | 3 | Foundational |
| 2C (screening + conflicts) | 4 | Builds on 2B |
| 2D (extraction + provenance) | 5 | Builds on 2B/2C |
| 2E (arm/timepoint) | 6 | Builds on 2D |
| 2F (analysis versioning + stale) | 7 | Builds on 2D |
| 2G (stats validation) | 8 | Parallel with 2D–2F |
| 2H (RoB truth tables + disagreement) | 9 | Builds on 2C |
| 2I (PRISMA + GRADE) | 10 | Builds on 2B/2D |
| 2J (reporting integrity) | 11 | Builds on 2F |
| 2K (portability + backup) | 12 | Builds on 2A |
| 2L (Integrity Center) | 13 | Builds on all prior |
| 2M (UX refinement) | 14 | Polish layer |
| 2N (regression tests) | continuous | Incremental with each phase |

---

## 16. Out-of-scope for Phase 2 (per prompt §53)

The Phase 2 prompt explicitly forbids:
- Rebuilding RevKit from scratch.
- Replacing working modules for aesthetic reasons.
- Replacing the statistical engine without evidence of incorrectness.
- Changing scientific formulas merely to make tests pass.
- Creating fake functionality.
- Using mock data in production workflows.
- Claiming a feature works without testing.
- Claiming statistical validation without actual reference comparisons.
- Sacrificing scientific correctness for UI polish.
- Sacrificing existing user data for architectural cleanliness.

---

*End of forensic audit. Companion to `docs/REVKIT_GAP_MATRIX.md` and `docs/REVKIT_DATA_MODEL_CURRENT.md`.*
