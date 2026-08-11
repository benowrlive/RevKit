# REVKIT — GAP MATRIX

> **Purpose:** Requirement × current-state matrix required by the Phase 2 Master Repair Prompt §0. Each row is a single requirement from the prompt's §3–§53; columns show the current implementation state, the gap, the evidence (file:line), and the Phase 2X that owns the fix.
>
> **Source of truth for "what is verified as broken, incomplete, or missing":** `docs/REVKIT_FORENSIC_AUDIT.md`.
>
> **Legend:**
> - **State:** ✅ OK · ⚠️ Partial / deviated · ❌ Missing · 🚨 Critical bug
> - **Severity:** P0 release-blocker · P1 high · P2 medium · P3 low
> - **Phase:** 2A–2N per the prompt's implementation order (§2)

---

## Matrix 1 — Data model & identity (Phase 2A, 2B)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §3 | REVIEW entity | ✅ `Review` model | — | `prisma/schema.prisma:13` | — | 2A |
| §3 | PROTOCOL entity | ❌ Missing | No Protocol model | `prisma/schema.prisma` | P1 | 2A |
| §3 | SEARCH entity | ❌ Missing | No Search model | `prisma/schema.prisma` | P1 | 2A |
| §3 | REFERENCE entity (bibliographic only) | ⚠️ Conflated | Carries screening decision + rawRis + stage | `prisma/schema.prisma:115–129` | P1 | 2B |
| §3 | REPORT entity | ❌ Missing | No Report model | `prisma/schema.prisma` | P1 | 2B |
| §3 | STUDY entity (underlying research) | ⚠️ Conflated | Carries extraction-level fields | `prisma/schema.prisma:93–113` | P1 | 2B |
| §3 | ARM entity | ❌ Missing | 2-arm assumption baked into DataPoint | `prisma/schema.prisma:64–91` | P1 | 2E |
| §3 | OUTCOME entity (definition only) | ⚠️ Conflated | Carries effectMeasure/method/model | `prisma/schema.prisma:39–53` | P1 | 2E |
| §3 | TIMEPOINT entity | ❌ Missing | `Outcome.timeFrame: String?` is free-text | `prisma/schema.prisma:48` | P1 | 2E |
| §3 | EXTRACTED DATA with provenance | ❌ Missing provenance | No sourceReport/page/table/figure/reviewer/date | `prisma/schema.prisma:64–91` | P1 | 2D |
| §3 | RISK OF BIAS entity | ⚠️ Partial | No reviewerId, no disagreement, no history | `prisma/schema.prisma:131–143` | P1 | 2H |
| §3 | ANALYSIS entity (snapshot + version) | ❌ Missing | No Analysis model | `prisma/schema.prisma` | P1 | 2F |
| §3 | EVIDENCE entity (GRADE) | ❌ Missing | No Evidence model | `prisma/schema.prisma` | P1 | 2I |
| §4 | REFERENCE ≠ REPORT ≠ STUDY | ❌ Not implemented | Reference and Study separate but Report missing | `prisma/schema.prisma:93–129` | P1 | 2B |
| §4 | Link multiple reports to one study | ❌ Not implemented | No UI for study families | `components/revkit/studies-page.tsx` | P1 | 2B |
| §4 | Duplicate-study warnings | ❌ Not implemented | No detection | `lib/project/state.ts:477–482` | P1 | 2B |
| §5 | Identity resolution: DOI dedup | ❌ Wrong key | Uses title+year | `state.ts:477–482` | P1 | 2B |
| §5 | Identity resolution: PMID dedup | ❌ Missing | PMID not in dedup key | `state.ts:477–482` | P1 | 2B |
| §5 | "POSSIBLE SAME STUDY" detection | ❌ Missing | — | — | P1 | 2B |
| §5 | MERGE/LINK/CREATE NEW/REVIEW LATER actions | ❌ Missing | Only "promote reference to study" | `references-page.tsx` | P1 | 2B |

---

## Matrix 2 — Screening workflow (Phase 2C)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §7 | Two-stage screening | ⚠️ Partial | `stage` is `string \| null` | `types.ts:157` | P1 | 2C |
| §7 | Title/abstract: reviewer + decision + date + note + reason + blinding | ❌ Missing | No ScreeningDecision entity | `prisma/schema.prisma:115–129` | P1 | 2C |
| §7 | Full text stage | ❌ Missing | — | — | P1 | 2C |
| §7 | CONFLICT entity | ❌ Missing | Single-reviewer only | — | P1 | 2C |
| §7 | Audit trail | ❌ Missing | — | — | P1 | 2C |
| §8 | Fast screening work queue | ❌ Missing | Table, not queue | `references-page.tsx` | P1 | 2C |
| §8 | Keyboard navigation | ❌ Missing | — | — | P2 | 2C |
| §8 | Progress tracker | ⚠️ Partial | Filter dropdown shows counts | `references-page.tsx` | P2 | 2C |
| §8 | Conflict status filter | ❌ Missing | — | — | P2 | 2C |

---

## Matrix 3 — Extraction & provenance (Phase 2D, 2E)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §9 | STUDY → REPORT → ARM → OUTCOME → TIMEPOINT → DATA chain | ❌ Missing | Flat Study → DataPoint | `studies-page.tsx`, `data-grid.tsx` | P1 | 2D |
| §10 | Study-level fields | ⚠️ Partial | Only design/picos/notes | `prisma/schema.prisma:93–113` | P1 | 2D |
| §11 | Arm-level fields | ❌ Missing | No Arm entity | `prisma/schema.prisma:64–91` | P1 | 2E |
| §11 | Arbitrary numbers of arms | ❌ Missing | 2-arm hard-coded | `prisma/schema.prisma:64–91` | P1 | 2E |
| §12 | Outcome-level fields | ⚠️ Partial | Only name/unit/timeFrame | `prisma/schema.prisma:39–53` | P1 | 2E |
| §13 | Timepoint entity | ❌ Missing | Free-text | `prisma/schema.prisma:48` | P1 | 2E |
| §13 | Prevent pooling incompatible timepoints | ❌ Missing | — | — | P1 | 2E |
| §14 | Dichotomous | ✅ Implemented | — | `prisma/schema.prisma:69–72` | — | 2D |
| §14 | Continuous | ✅ Implemented | — | `prisma/schema.prisma:73–78` | — | 2D |
| §14 | Generic inverse variance | ✅ Implemented | — | `prisma/schema.prisma:81–82` | — | 2D |
| §14 | OE_V | ✅ Implemented | — | `prisma/schema.prisma:79–80` | — | 2D |
| §14 | DTA 2x2 | ✅ Implemented | — | `prisma/schema.prisma:83–86` | — | 2D |
| §14 | Time-to-event (HR/log HR/SE) | ❌ Missing | — | `types.ts:26–31` | P1 | 2D |
| §14 | Other reported (median/IQR/range/p/CI) | ❌ Missing | — | — | P1 | 2D |
| §15 | Data provenance | ❌ Missing | No provenance fields | `prisma/schema.prisma:64–91` | P1 | 2D |
| §15 | Value classification | ❌ Missing | — | — | P1 | 2D |
| §16 | Calculation provenance | ❌ Missing | — | — | P1 | 2D |
| §16 | Never overwrite original reported values | ⚠️ Partial | Overwrites in place | `data-grid.tsx` | P1 | 2D |
| §17 | Explicit missingness states | ❌ Missing | Nullable fields | `prisma/schema.prisma:69–86` | P1 | 2D |
| §18 | Multi-arm trial support | ❌ Missing | 2-arm assumption | `pooling.ts:60–69` | P1 | 2E |

---

## Matrix 4 — Analysis versioning & stale detection (Phase 2F)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §19 | Analysis dataset snapshot | ❌ Missing | No snapshot | — | P1 | 2F |
| §20 | Persist analysis config | ⚠️ Partial | Only effectMeasure/method/model | `prisma/schema.prisma:39–53` | P1 | 2F |
| §21 | Analysis versioning | ❌ Missing | No version entity | — | P1 | 2F |
| §21 | Do not overwrite previous states | ❌ Missing | — | — | P1 | 2F |
| §22 | Stale detection | ❌ Missing | No dependency tracking | — | P1 | 2F |
| §22 | Mark dependent STALE | ❌ Missing | — | — | P1 | 2F |
| §22 | User sees what became stale and why | ❌ Missing | — | — | P1 | 2F |
| §23 | Reproducible analysis | ❌ Missing | Cannot reproduce | — | P1 | 2F |
| §23 | Analysis details view | ❌ Missing | — | — | P1 | 2F |

---

## Matrix 5 — Statistical validation (Phase 2G)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §24 | Inspect every method | ⚠️ Inspected | Audit done | `lib/stats/*` | — | 2G |
| §24 | Compare against R | ❌ Not performed | — | — | P1 | 2G |
| §25 | RR | ✅ Implemented | — | `effect.ts:88–101` | — | 2G |
| §25 | OR | ✅ Implemented | — | `effect.ts:106–119` | — | 2G |
| §25 | RD | 🚨 Bug | Wrongly applies CC | `effect.ts:128` | P0 | 2G |
| §25 | Peto OR | ✅ Implemented | — | `effect.ts:151–165` | — | 2G |
| §25 | MD | ✅ Implemented | — | `effect.ts:182–194` | — | 2G |
| §25 | SMD (Hedges' g) | ✅ Implemented | — | `effect.ts:197–210` | — | 2G |
| §25 | HR | ❌ Missing | — | `types.ts:33–42` | P1 | 2G |
| §25 | GIV | ✅ Implemented | — | `effect.ts:248–258` | — | 2G |
| §25 | Sens/Spec/DOR/LR+/LR- | ✅ Implemented | DOR has dead-code bug | `dta.ts`, `calculate.ts` | — | 2G |
| §25 | DOR | ⚠️ Bug | CC value substituted for raw | `calculate.ts:158–173` | P1 | 2G |
| §26 | Zero-event handling | ⚠️ Partial | CC not configurable | `effect.ts:76–85` | P1 | 2G |
| §26 | CC method visible in config | ❌ Missing | Hard-coded | `effect.ts:76–85` | P1 | 2G |
| §27 | Heterogeneity + prediction interval | ⚠️ Partial | Prediction interval missing | `pooling.ts:88–110` | P1 | 2G |
| §28 | Test for subgroup differences | ❌ Missing | Q-between not implemented | `pooling.ts` | P1 | 2G |
| §29 | Saved sensitivity configurations | ❌ Missing | — | — | P1 | 2G |
| §30 | DTA: distinguish basic/bivariate/HSROC | ⚠️ Partial | Bivariate missing; HSROC simplified | `dta.ts:231–273` | P1 | 2G |
| §30 | Do not label simplified as full HSROC | ❌ Violation | UI presents "HSROC" | `dta-forest-plot.tsx` | P1 | 2G |

---

## Matrix 6 — Risk of bias (Phase 2H)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §31 | RoB 2 algorithm matches Excel v22-Aug-2019 | 🚨 Fails | Count heuristics | `rob/config.ts:190–219` | P0 | 2H |
| §31 | ROBINS-I V2 per-domain truth tables | 🚨 Fails | Count heuristics | `rob/config.ts:351–368` | P0 | 2H |
| §31 | QUADAS-2 | ✅ OK | — | `rob/config.ts:390–442` | — | 2H |
| §31 | Reviewer + second reviewer + disagreement + resolution | ❌ Missing | No reviewer field | `prisma/schema.prisma:131–143` | P1 | 2H |
| §31 | Preserve historical judgements | ❌ Missing | Overwriting destroys | — | P1 | 2H |
| §41 | Audit trail | ❌ Missing | No audit trail | — | P1 | 2H |

---

## Matrix 7 — PRISMA & evidence (Phase 2I)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §32 | PRISMA derives from canonical review data | ⚠️ Partial | Heuristic, disconnected | `prisma-flow/template.ts:135–183` | P1 | 2I |
| §32 | Automated validation | ❌ Missing | — | — | P1 | 2I |
| §32 | PRISMA INTEGRITY WARNING | ❌ Missing | — | — | P1 | 2I |
| §33 | Search strategy management | ❌ Missing | No Search entity | — | P1 | 2I |
| §33 | Multiple searches per review | ❌ Missing | — | — | P1 | 2I |
| §34 | Protocol vs actual distinction | ❌ Missing | No Protocol entity | — | P1 | 2I |
| §34 | PROTOCOL DEVIATION flag | ❌ Missing | — | — | P1 | 2I |
| §35 | GRADE | ❌ Missing | No GRADE entity | — | P1 | 2I |

---

## Matrix 8 — Reporting & export (Phase 2J)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §37 | Connected reporting workflow | ❌ Missing | One-shot exports | `lib/export/` | P1 | 2J |
| §37 | Generated output reflects non-stale data | ❌ Missing | No staleness check | — | P1 | 2J |
| §38 | Pre-export stale check | ❌ Missing | — | — | P1 | 2J |
| §38 | Never silently export obsolete results | ❌ Violation | Exports whatever is in memory | `export-page.tsx` | P1 | 2J |
| — | Real .docx via `docx` library | ❌ HTML-as-.doc | Not OOXML | `lib/export/docx.ts:1–9` | P1 | 2J |
| — | Embed forest plot PNGs | ❌ Missing | No embedded plots | `lib/export/docx.ts` | P1 | 2J |
| — | ZIP CSV with 6 files | ❌ Single CSV | `buildCombinedCsv` | `lib/export/csv.ts:230–295` | P1 | 2J |
| — | CSV round-trip importer | ❌ Missing | No parser | — | P1 | 2J |
| — | 300 DPI PNG export | ⚠️ ~144 DPI | `scale = 2` | `lib/export/download.ts:112` | P2 | 2J |

---

## Matrix 9 — Portability & backup (Phase 2K)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §39 | `.revkit` portable project | ❌ Missing | All persistence via SQLite/REST | `types.ts:202–209` | P1 | 2K |
| §39 | Safe migration with backup + rollback | ❌ Missing | No migration framework | — | P1 | 2K |
| §40 | Autosave | ❌ Missing | `autoBackupMinutes` never read | `prisma/schema.prisma:184` | P1 | 2K |
| §40 | Manual backup | ❌ Missing | — | — | P1 | 2K |
| §40 | Recovery | ❌ Missing | — | — | P1 | 2K |
| §40 | Crash recovery | ❌ Missing | — | — | P1 | 2K |
| §40 | Migration backup | ❌ Missing | — | — | P1 | 2K |
| §40 | Never destroy user data during upgrades | 🚨 Violated | PUT bug | `api/reviews/route.ts:249–253` | P0 | 2K |
| §42 | Living review architecture | ❌ Missing | No version history | — | P2 | 2K |

---

## Matrix 10 — Integrity Center (Phase 2L)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §36 | `/integrity` workspace | ❌ Missing | No route | — | P1 | 2L |
| §36 | CRITICAL/WARNINGS/PASSED sections | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: duplicate studies | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: duplicate reports | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: missing extraction | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: impossible counts | ⚠️ Partial | Client-side only | `data-grid.tsx:89–108` | P1 | 2L |
| §36 | Detect: missing RoB | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: analysis includes excluded study | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: stale analysis | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: incompatible timepoints | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: inconsistent outcomes | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: missing provenance | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: PRISMA mismatch | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: protocol deviation | ❌ Missing | — | — | P1 | 2L |
| §36 | Detect: missing required fields | ❌ Missing | — | — | P1 | 2L |
| §36 | Click issue → navigate to source | ❌ Missing | — | — | P2 | 2L |

---

## Matrix 11 — UX & workflow (Phase 2M)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §43 | Data tables | ✅ OK | — | — | — | 2M |
| §43 | Keyboard navigation | ⚠️ Partial | ⌘S only | `workspace-shell.tsx` | P1 | 2M |
| §43 | Compact layouts | ✅ OK | — | — | — | 2M |
| §43 | Fast transitions | ✅ OK | framer-motion | `workspace-shell.tsx` | P3 | 2M |
| §43 | Clear status | ⚠️ Partial | `<Circle>` not `●` | `workspace-shell.tsx:159–161` | P2 | 2M |
| §43 | Contextual validation | ✅ OK | `aria-invalid` | `data-grid.tsx:366` | — | 2M |
| §43 | Inline editing | ✅ OK | — | `data-grid.tsx` | — | 2M |
| §43 | Command palette | ❌ Missing | — | — | P2 | 2M |
| §43 | Search / filtering | ⚠️ Partial | References filter only | `references-page.tsx` | P2 | 2M |
| §43 | Predictable navigation | ⚠️ Partial | Tree nodes not keyboard-accessible | — | P2 | 2M |
| §44 | Extraction work queue | ❌ Missing | Repeated navigation | — | P1 | 2M |
| §45 | WHAT DATA → WHAT METHOD → WHAT RESULT | ❌ Missing | — | `comparisons-page.tsx` | P1 | 2M |
| §46 | Review progress | ⚠️ Partial | Single enum, not derived | `workspace-shell.tsx` | P1 | 2M |
| §47 | Performance: large reference sets | ❌ Missing | No virtualization | `references-page.tsx` | P1 | 2M |
| §47 | Performance: large extraction tables | ❌ Missing | No memoization | `forest-plot.tsx` | P1 | 2M |
| §47 | Performance: many studies/outcomes | ❌ Missing | O(N·M) per keystroke | `state.ts:359–384` | P1 | 2M |
| §48 | Keyboard access | ⚠️ Partial | See §43 | — | P1 | 2M |
| §48 | Focus visibility | ✅ OK | Radix Dialog | — | — | 2M |
| §48 | Screen-reader labels | ✅ OK | SVG `role="img"` | — | — | 2M |
| §48 | Adequate contrast | ✅ OK | Dark-first palette | — | — | 2M |
| §48 | Reduced motion | ⚠️ Partial | Profile toggle, no auto-detect | `settings-page.tsx` | P2 | 2M |
| §48 | Accessible tables | ✅ OK | Semantic `<table>` | — | — | 2M |
| §48 | Non-color-only status indicators | ⚠️ Partial | Some badges color alone | `rob-page.tsx` | P2 | 2M |
| §49 | Dead code identification | ⚠️ Partial | `recharts`, `framer-motion`, dead exports | `package.json` | P3 | 2M |

---

## Matrix 12 — Regression testing (Phase 2N)

| § | Requirement | Current state | Gap | Evidence | Severity | Phase |
|---|---|---|---|---|---|---|
| §50 | Fixture 1: Simple two-arm RCT | ❌ Missing | — | — | P1 | 2N |
| §50 | Fixture 2: Multi-arm RCT | ❌ Missing | Engine doesn't support multi-arm | — | P1 | 2N |
| §50 | Fixture 3: Multiple reports from one study | ❌ Missing | Model doesn't support reports | — | P1 | 2N |
| §50 | Fixture 4: Multiple timepoints | ❌ Missing | Model doesn't support timepoints | — | P1 | 2N |
| §50 | Fixture 5: Zero-event study | ❌ Missing | — | — | P1 | 2N |
| §50 | Fixture 6: Continuous outcome | ❌ Missing | — | — | P1 | 2N |
| §50 | Fixture 7: Missing SD | ❌ Missing | No missingness model | — | P1 | 2N |
| §50 | Fixture 8: DTA study | ❌ Missing | — | — | P1 | 2N |
| §50 | Fixture 9: Screening conflict | ❌ Missing | No conflict model | — | P1 | 2N |
| §50 | Fixture 10: RoB conflict | ❌ Missing | No disagreement model | — | P1 | 2N |
| §50 | Fixture 11: Excluded study after analysis | ❌ Missing | No analysis-study link | — | P1 | 2N |
| §50 | Fixture 12: Extraction modified after analysis | ❌ Missing | No staleness | — | P1 | 2N |
| §50 | Fixture 13: PRISMA inconsistency | ❌ Missing | No integrity validation | — | P1 | 2N |
| §50 | Fixture 14: Protocol deviation | ❌ Missing | No protocol model | — | P1 | 2N |
| §50 | Fixture 15: Duplicate publication | ❌ Missing | No Report/study-identity | — | P1 | 2N |
| §50 | Tests exercise complete data flow | ❌ Missing | No tests | — | P1 | 2N |
| — | Vitest installed | ❌ Missing | — | `package.json` | P1 | 2N |
| — | `"test"` script | ❌ Missing | — | `package.json` | P1 | 2N |
| — | `.github/workflows/ci.yml` | ❌ Missing | — | — | P1 | 2N |
| — | `ignoreBuildErrors: false` | ❌ True | — | `next.config.ts:7` | P1 | 2N |
| — | `noImplicitAny: true` | ❌ False | — | `tsconfig.json:13` | P1 | 2N |

---

## Matrix 13 — Release blockers (cross-phase)

| ID | Defect | Phase | Evidence |
|---|---|---|---|
| RB-1 | `PUT /api/reviews` unscoped `deleteMany({})` wipes data across all reviews | 2A-stabilize | `api/reviews/route.ts:249–253` |
| RB-2 | RoB 2 algorithm fails BMJ 2019;366:l4898 fidelity | 2H | `rob/config.ts:190–219` |
| RB-3 | ROBINS-I V2 simplified, not per-domain truth tables | 2H | `rob/config.ts:351–368` |
| RB-4 | `riskDifference` wrongly applies continuity correction | 2G | `effect.ts:128` |
| RB-5 | DOR dead code + spec violation | 2G | `calculate.ts:158–173` |

---

## Matrix 14 — Severity rollup

| Severity | Count | Phases involved |
|---|---|---|
| P0 (release blocker) | 5 | 2A-stab, 2G, 2H |
| P1 (high — must fix for v1.0) | ~95 | All phases |
| P2 (medium — should fix for v1.1) | ~25 | 2B, 2C, 2G, 2H, 2I, 2J, 2K, 2L, 2M |
| P3 (low — backlog) | ~10 | 2M, 2N |

---

## Matrix 15 — Phase dependency graph

```
2A (data model map)
  ↓
2A-stab (release blockers: PUT bug, RD/DOR bugs)
  ↓
2B (Reference/Report/Study) ──────────┐
  ↓                                    │
2C (screening + conflicts)             │
  ↓                                    │
2D (extraction + provenance)           │
  ↓                                    ↓
2E (arm/timepoint) ────→ 2G (stats validation, multi-arm)
  ↓                                    ↑
2F (analysis versioning + stale) ──────┘
  ↓
2H (RoB truth tables + disagreement) ── depends on 2C
  ↓
2I (PRISMA integrity + GRADE) ───────── depends on 2B, 2D, 2F
  ↓
2J (reporting integrity) ───────────── depends on 2F
  ↓
2K (portability + backup) ──────────── depends on 2A
  ↓
2L (Integrity Center) ──────────────── depends on all prior
  ↓
2M (UX refinement) ─────────────────── depends on 2L
  ↓
2N (regression tests) ──────────────── continuous
```

---

*End of gap matrix. Companion to `docs/REVKIT_FORENSIC_AUDIT.md` and `docs/REVKIT_DATA_MODEL_CURRENT.md`.*
