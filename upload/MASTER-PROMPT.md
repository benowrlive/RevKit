# RevKit — Master Build Prompt

> **How to use this file:** Open a fresh GLM-5.2 chat. Paste this entire file as your first message. GLM-5.2 will have full context to build RevKit phase-by-phase. After each phase, run the acceptance checklist, commit, then say "Continue to Phase N+1" in the same chat (or start fresh and re-paste this file).
>
> **One file. One paste. One product.**

---

# PROJECT: RevKit — Modern RevMan Clone (Desktop-First)

You are a senior fullstack engineer building **RevKit**, a modern, open-source clone of Cochrane's RevMan 5 software for systematic reviews. You will build it phase-by-phase across 6 phases (~8.5 weeks part-time). I will say "Continue to Phase N" when ready to advance.

## STRICT RULES (apply to every phase)

1. **Strict TypeScript** — no `any`, no `eslint-disable` without justification comment.
2. **Conventional Commits** — `feat(phase-N): <summary>`.
3. **Pin library versions exactly** — don't invent versions.
4. **shadcn/ui primitives first** — use existing components unless explicitly specified.
5. **All business logic client-side** — Next.js static export (no Server Actions, no API routes).
6. **File system / SQLite / dialog operations go through Tauri commands** (Rust), invoked from TS via `@tauri-apps/api`. Guard with `isTauri()` in dev.
7. **At end of every phase**: run the acceptance checklist, report pass/fail per item. Don't say "all pass" without actually checking.
8. **Output code in labeled code blocks** with full file path as first comment, like: `// apps/web/lib/foo.ts`.
9. **If something is ambiguous, ask me before assuming.**
10. **Never invent features not in this prompt.** If a feature isn't listed, it's not in v1.

---

## 1. What is RevKit?

A **desktop app** that helps researchers do Cochrane systematic reviews. Supports all 5 Cochrane review types:

| Type | Use case | Data entry | Meta-analysis | RoB tool |
|---|---|---|---|---|
| **Intervention** | Does X work for Y? | 2×2 / mean+SD / GIV | MH, Peto, IV, DL | RoB 2 + ROBINS-I |
| **DTA** | How good is test X for disease Y? | TP/FP/FN/TN | Univariate logit + HSROC | QUADAS-2 |
| **Methodology** | How good is method X? | Same as intervention | Same as intervention | ROBINS-I |
| **Overview** | Summary of multiple reviews | Linked review IDs | Extracted effect sizes | AMSTAR-2 lite |
| **Flexible** | Custom | User-defined | Optional | Optional |

**Sub-types**: Prognosis / Etiology / Qualitative — implemented as a tag, not separate code paths.

## 2. What's IN v1 / OUT of v1

**IN:**
- All 5 review types via New Review Wizard
- DTA Calculator (Sens/Spec/PPV/NPV/LR+/LR-/Prevalence with 95% CIs)
- Studies + references (RIS import, dedup, screening, PDF attach)
- Intervention meta-analysis (MH/Peto/IV/DL, forest plot, funnel plot, I², τ²)
- DTA meta-analysis (univariate pooling for Sens & Spec, SROC plot)
- Risk of bias: RoB 2 (RCTs, 5 domains), ROBINS-I (non-randomized, 7 domains), QUADAS-2 (DTA, 4 domains)
- PRISMA 2020 flow diagram (11-box template)
- Word `.docx` export + CSV export + PNG/SVG export per plot
- Desktop app: `.exe` (Windows), `.dmg` (macOS), `.AppImage` + `.deb` (Linux)
- Local `.revkit` JSON file format (save, open, share)
- Auto-update via GitHub Releases
- Open-source on GitHub (MIT)

**OUT (cut for v1 — do NOT build these):**
- Real-time multi-user collaboration (Yjs/Liveblocks)
- AI features (PDF extraction, RoB prefill, QA chat)
- Cloud sync / web version
- `.rm5` XML import/export
- GRADE Summary of Findings
- User accounts / auth (local app)
- Network meta-analysis, REML, Bayesian
- ORCID / Google login

## 3. Tech stack (locked)

| Layer | Choice |
|---|---|
| Desktop shell | **Tauri 2.0** (Rust) |
| Framework | **Next.js 16** (App Router, **static export** — `output: 'export'`) |
| Language | **TypeScript 5**, strict |
| UI | **shadcn/ui** + **Tailwind CSS v4** |
| Tables | **TanStack Table v8** |
| Forest plots | **D3 + custom SVG** |
| PRISMA editor | **@xyflow/react** (react-flow) |
| Forms | **react-hook-form** + **zod** |
| Local DB | **SQLite** via `tauri-plugin-sql` (in-memory working copy) |
| File system | `tauri-plugin-fs` + `tauri-plugin-dialog` |
| Settings | `tauri-plugin-store` (recent files, preferences) |
| Auto-update | `tauri-plugin-updater` |
| Charts (auxiliary) | **Recharts** (SROC, funnel) |
| Testing | **Vitest** + **Playwright** |
| Distribution | **GitHub Releases** via `tauri-action` |
| Error tracking | **Sentry** (optional, free tier) |
| ORM | **Prisma 6** (SQLite adapter) |

**Third-party accounts needed: 2** (GitHub + Sentry). That's it.

## 4. Repository structure

```
revkit/                                 # monorepo (pnpm workspaces)
├── apps/
│   ├── web/                            # Next.js 16 app (also runs as static export)
│   │   ├── app/
│   │   │   ├── (welcome)/              # welcome screen with recent files
│   │   │   ├── (review)/               # review workspace (single open review)
│   │   │   │   ├── overview/
│   │   │   │   ├── studies/
│   │   │   │   ├── comparisons/
│   │   │   │   ├── rob/
│   │   │   │   ├── prisma/
│   │   │   │   ├── export/
│   │   │   │   └── settings/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                     # shadcn/ui base
│   │   │   ├── forest-plot/
│   │   │   ├── dta/
│   │   │   ├── rob/
│   │   │   ├── prisma-flow/
│   │   │   └── editor/
│   │   ├── lib/
│   │   │   ├── stats/                  # MH, Peto, IV, DL, DTA, heterogeneity
│   │   │   ├── dta/                    # DTA calculator formulas
│   │   │   ├── prisma/                 # Prisma client (SQLite adapter)
│   │   │   ├── project/                # .revkit schema, migrations, save/load
│   │   │   ├── export/                 # docx, csv, png, svg
│   │   │   └── tauri/                  # Tauri command wrappers
│   │   ├── hooks/
│   │   ├── prisma/schema.prisma        # SQLite schema
│   │   ├── public/
│   │   ├── next.config.ts              # output: 'export'
│   │   └── package.json
│   └── desktop/                        # Tauri 2.0 shell
│       ├── src-tauri/
│       │   ├── src/main.rs
│       │   ├── Cargo.toml
│       │   ├── tauri.conf.json
│       │   └── capabilities/
│       └── package.json
├── packages/
│   └── stats-engine/                   # pure TS stats library (no React)
│       ├── src/{iv,mh,peto,dl,heterogeneity,dta,forest}.ts
│       └── package.json
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
```

## 5. Architecture diagram

```
┌──────────────────────────────────────────────────────────┐
│              RevKit Desktop App (Tauri 2.0)              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  WebView (WebView2/WKWebView/WebKitGTK)            │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Next.js static export (React 19)            │  │  │
│  │  │  • App Router (no Server Actions — static)   │  │  │
│  │  │  • shadcn/ui components                      │  │  │
│  │  │  • All business logic client-side            │  │  │
│  │  │  • Talks to Rust via Tauri commands          │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Rust backend (src-tauri/src/main.rs)              │  │
│  │  • tauri-plugin-sql   → SQLite (working copy)      │  │
│  │  • tauri-plugin-fs    → read/write .revkit files   │  │
│  │  • tauri-plugin-dialog → native file pickers       │  │
│  │  • tauri-plugin-store → settings, recent files     │  │
│  │  • tauri-plugin-updater → auto-update from GitHub  │  │
│  │  • Custom commands:                               │  │
│  │      - open_project(path) → JSON                  │  │
│  │      - save_project(path, json)                   │  │
│  │      - export_docx(json) → bytes                  │  │
│  │      - export_csv(json) → zip bytes               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SQLite (in-memory working copy)                  │  │
│  │  • Loaded from .revkit file on Open               │  │
│  │  • All reads/writes through Prisma client         │  │
│  │  • On Save: serialize back to .revkit JSON        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Why dual-layer storage:**
- **Working state** = in-memory SQLite (developer experience of Prisma + queries)
- **Persistence** = `.revkit` JSON file (user portability, email-able, git-diff-able)

On Open: JSON file → in-memory SQLite. On Save: in-memory SQLite → JSON file.

## 6. `.revkit` project file format

A `.revkit` file is a UTF-8 JSON file:

```json
{
  "format": "revkit-1",
  "formatVersion": "1.0.0",
  "createdAt": "2026-08-10T12:00:00Z",
  "updatedAt": "2026-08-10T15:30:00Z",
  "appVersion": "0.1.0",
  "review": {
    "id": "uuid-v4",
    "title": "Rapid diagnostic tests for uncomplicated P. falciparum malaria",
    "researchQuestion": "...",
    "type": "DTA",
    "subType": null,
    "status": "draft",
    "phase": "extraction",
    "comparisons": [...],
    "studies": [...],
    "references": [...],
    "robAssessments": [...],
    "prismaFlow": {...}
  }
}
```

**Rules:**
- On **open**: validate against JSON schema (zod). If `formatVersion` is older → run migrations. If corrupt → offer recovery.
- On **save**: always write current `formatVersion`; never silently downgrade.
- On every save, first copy current file to `<filename>.revkit.bak` (overwrite).
- v1 keeps PDFs **separate** (stored as absolute path strings in `study.pdfPath`). v1.1 will add optional PDF-embedding.

## 7. File menu spec

Native Tauri menu (File / Edit / View / Help) wired via `tauri::Menu`.

| Item | Shortcut | Behavior |
|---|---|---|
| New Review | ⌘N / Ctrl+N | Close current (save prompt), open New Review Wizard |
| Open… | ⌘O / Ctrl+O | Native file picker → `.revkit` → load |
| Open Recent → | — | Submenu: last 10 files (path + last-modified) |
| Save | ⌘S / Ctrl+S | Save to current path. If untitled → Save As. |
| Save As… | ⌘⇧S / Ctrl+Shift+S | Native save dialog → write `.revkit` |
| Import References… | — | File picker → `.ris` or `.bib` → parse → add |
| Export → Word… | — | Generate `.docx`, native save dialog |
| Export → CSV… | — | Generate `.zip` of CSVs, native save dialog |
| Export → PNG (current plot) | — | Save focused plot as `.png` (300 DPI) |
| Export → SVG (current plot) | — | Save focused plot as `.svg` |
| Close Project | ⌘W / Ctrl+W | Close (save prompt if dirty) |
| Quit | ⌘Q / Ctrl+Q | Close all + quit (save prompts) |

**Dirty-state tracking:**
- Any mutation sets `isDirty = true`.
- Window close + menu Quit intercept with "Save changes?" dialog (Yes/No/Cancel).
- Title bar shows `●` prefix when dirty: `● malaria-review.revkit — RevKit`.

**Recent files:**
- Stored in Tauri `store` plugin (persists across launches).
- Schema: `recentFiles: [{ path, title, lastOpened }]` (max 10, dedupe).
- Welcome screen shows them as clickable cards.

## 8. Prisma schema (SQLite)

```prisma
datasource db {
  provider = "sqlite"
  url      = "file::memory:"
}

generator client {
  provider = "prisma-client-js"
}

model Review {
  id          String       @id
  title       String
  researchQuestion String?
  type        String       // INTERVENTION | DTA | METHODOLOGY | OVERVIEW | FLEXIBLE
  subType     String?
  status      String       @default("draft")
  phase       String       @default("scoping")
  createdAt   String       // ISO 8601
  updatedAt   String
  comparisons Comparison[]
  studies     Study[]
  references  Reference[]
  robAssessments RobAssessment[]
  prismaFlow  PrismaFlow?
}

model Comparison {
  id        String     @id
  reviewId  String
  name      String
  order     Int
  outcomes  Outcome[]
}

model Outcome {
  id            String     @id
  comparisonId  String
  name          String
  dataType      String     // DICHOTOMOUS | CONTINUOUS | OE_V | GIV | DTA_2x2
  effectMeasure String
  method        String     // MH | PETO | IV | DL | LOGIT_UNIVARIATE | HSROC
  model         String     @default("fixed")
  unit          String?
  timeFrame     String?
  order         Int
  subgroups     Subgroup[]
  dataPoints    DataPoint[]
}

model Subgroup {
  id          String       @id
  outcomeId   String
  name        String
  order       Int
  dataPoints  DataPoint[]
}

model DataPoint {
  id          String   @id
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
}

model Study {
  id          String       @id
  reviewId    String
  label       String
  year        Int?
  authors     String?
  doi         String?
  pdfPath     String?
  status      String       @default("screening")
  excludeReason String?
  design      String?
  picos       String?      // JSON string
  indexTest   String?
  referenceStandard String?
  createdAt   String
  updatedAt   String
  dataPoints  DataPoint[]
  robAssessments RobAssessment[]
}

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
}

model RobAssessment {
  id              String   @id
  studyId         String
  tool            String   // ROB2 | ROBINS_I | QUADAS_2
  domainJudgements String  // JSON string
  signallingAnswers String // JSON string
  overallJudgement String?
  createdAt       String
  updatedAt       String
}

model PrismaFlow {
  id        String @id
  reviewId  String @unique
  boxes     String // JSON string of 11-box template
}
```

## 9. DTA Calculator spec

Available in two places:
1. **Standalone** — from sidebar of any DTA review
2. **Per-study** — calculator icon on each DTA data row

### Layout

```
┌─────────────────────────────────────────────────┐
│ Calculator                                  [X] │
├─────────────────────────────────────────────────┤
│            Reference standard                    │
│            +          -          Total           │
│ Index  +  [TP ____]  [FP ____]  [Test+ = auto]   │
│ test   -  [FN ____]  [TN ____]  [Test- = auto]   │
│         Total [D+ = auto] [D- = auto] [N = auto] │
│                                                  │
│   Sensitivity: [auto] %   (95% CI [auto]-[auto]) │
│   Specificity: [auto] %   (95% CI [auto]-[auto]) │
│   PPV:         [auto] %   (95% CI [auto]-[auto]) │
│   NPV:         [auto] %   (95% CI [auto]-[auto]) │
│   LR+:          [auto]   (95% CI [auto]-[auto]) │
│   LR-:          [auto]   (95% CI [auto]-[auto]) │
│   Prevalence:  [auto] %   (95% CI [auto]-[auto]) │
│                                                  │
│   [?] [Reset] [Copy to clipboard]                │
│                              [Cancel] [OK]       │
└─────────────────────────────────────────────────┘
```

### Formulas

| Metric | Formula | CI method |
|---|---|---|
| Sensitivity | TP / (TP + FN) | Wilson |
| Specificity | TN / (TN + FP) | Wilson |
| PPV | TP / (TP + FP) | Wilson |
| NPV | TN / (TN + FN) | Wilson |
| LR+ | Sens / (1 − Spec) | log-based |
| LR− | (1 − Sens) / Spec | log-based |
| Prevalence | (TP + FN) / N | Wilson |

### Behavior
- **OK** — if per-study, writes TP/FP/FN/TN back to row and closes. If standalone, just closes.
- **Reset** — clears all inputs.
- **Copy to clipboard** — copies all 7 metrics as formatted text.
- **Keyboard** — Tab between cells; Enter = OK; Esc = Cancel.
- **Validation** — non-negative integers; TP+FP+FN+TN > 0; red border + tooltip if invalid.

### Implementation
- Component: `apps/web/components/dta/Calculator.tsx`
- Pure function: `apps/web/lib/dta/calculate.ts` — takes `{tp, fp, fn, tn}`, returns `{sens, spec, ppv, npv, lrPlus, lrMinus, prevalence}` each with `{value, ciLower, ciUpper}`.
- 100% unit-test coverage required.
- All client-side — no Tauri calls.

## 10. Critical statistics formulas (for Phase 4)

### Effect measures (per-study, dichotomous 2×2)

| Cell | Layout |
|---|---|
| `a` (events treatment) | `b` (non-events treatment) | `n1 = a+b` |
| `c` (events control) | `d` (non-events control) | `n2 = c+d` |
| `N = n1+n2` |

**Risk Ratio (RR):**
```
RR = (a / n1) / (c / n2)
log(RR) = log(a/n1) - log(c/n2)
SE(log RR) = √(1/a - 1/n1 + 1/c - 1/n2)   (Katz)
```
Zero-cell: add 0.5 to all cells of any study with a zero cell (for MH/IV; never for Peto).

**Odds Ratio (OR):**
```
OR = (a × d) / (b × c)
log(OR) = log(a) + log(d) - log(b) - log(c)
SE(log OR) = √(1/a + 1/b + 1/c + 1/d)   (Woolf)
```
Zero-cell: add 0.5 to all cells of any study with a zero cell.

**Risk Difference (RD):**
```
RD = (a/n1) - (c/n2)
SE(RD) = √( (a×(n1-a))/n1³ + (c×(n2-c))/n2³ )
```
No continuity correction needed.

**Peto OR:**
```
O = a
E = (n1 × (a+c)) / N
V = (n1 × n2 × (a+c) × (b+d)) / (N² × (N-1))
logOR_peto = (O - E) / V
SE(logOR_peto) = 1 / √V
```
No continuity correction (Peto handles sparse data natively).

### Continuous — Mean Difference (MD)
```
MD = mean1 - mean2
SE(MD) = √(sd1²/n1 + sd2²/n2)
```

### Continuous — SMD (Hedges' g)
```
SMD_raw = (mean1 - mean2) / spooled
spooled = √( ((n1-1)×sd1² + (n2-1)×sd2²) / (n1+n2-2) )
J = 1 - 3/(4×(n1+n2-2) - 1)
SMD = J × SMD_raw
SE(SMD) = √( (n1+n2)/(n1×n2) + SMD² / (2×(n1+n2)) )
```

### Pooling methods

**Inverse Variance (IV, fixed):**
```
w_i = 1 / SE_i²
pooledEffect = Σ(w_i × θ_i) / Σ(w_i)
pooledSE = √(1 / Σ(w_i))
CI = pooledEffect ± z × pooledSE   (z=1.959964 for 95%)
z_score = pooledEffect / pooledSE
pValue = 2 × (1 - Φ(|z|))
```

**Mantel-Haenszel (MH):** See Cochrane Handbook v6.4 Ch. 10.4.2 — implement Robins-Greenland SE for OR, Greenland-Robins SE for RR.

**Peto:** `pooledLogOR = Σ(O-E) / Σ(V); SE = 1/√(ΣV)`

**DerSimonian-Laird (DL, random):**
```
Q = Σ w_i × (θ_i - θ_fixed)²    (Cochran's Q)
df = k - 1
C = Σ w_i - (Σ w_i²)/Σ w_i
τ² = max(0, (Q - df) / C)
w_i_random = 1 / (SE_i² + τ²)
pooledEffect = Σ(w_i_random × θ_i) / Σ(w_i_random)
pooledSE = √(1 / Σ(w_i_random))
```

### Heterogeneity

```
Q = Σ w_i × (θ_i - θ_fixed)²
df = k - 1
pValue = 1 - χ²_cdf(Q, df)
I² = max(0, (Q - df) / Q)        // 0..1 (25% low, 50% mod, 75% high)
τ² = DL estimator (above)
H = √(Q / df)
```

### DTA stats (Phase 4)

**Univariate pooling for Sensitivity (logit transform):**
```
For each study: logit_sens = log(TP / FN) ≈ log(TP/(TP+FN) / (1 - TP/(TP+FN)))
SE(logit_sens) = √(1/TP + 1/FN)
Pool via IV (fixed) or DL (random).
Back-transform: sens = 1 / (1 + exp(-logit_sens))
```
Same for Specificity (use TN, FP).

**DOR (Diagnostic Odds Ratio):**
```
DOR = (TP × TN) / (FP × FN)
log(DOR) pooled via IV or DL.
```

**HSROC (simplified):**
```
logit(TPR) = α + β × logit(FPR)
Estimate α (threshold) and β (slope) via weighted least squares.
If β ≈ 1 → symmetric SROC; summary point at (α/2, α/2).
```
(Full bivariate model needs R — out of scope for v1.)

### Forest plot rendering rules

- Box **area** (not side length) ∝ weight: `boxArea_i = (w_i / Σ w_j) × maxBoxArea; boxSide_i = √boxArea_i`.
- Subgroup + overall diamonds: center at pooled effect, width = CI, height ~12px.
- **Log axis** for ratio measures (RR/OR/HR/Peto OR); **linear** for differences (RD/MD/SMD).
- Tick marks: powers of 2 for log (0.125, 0.25, 0.5, 1, 2, 4, 8); round numbers for linear.
- Null effect line: x=1.0 (log) or x=0.0 (linear).
- Out-of-range CIs: arrowheads pointing outward.

### Anti-patterns (forbidden)

- ❌ `Math.log(0)` → -Infinity. Apply continuity correction FIRST.
- ❌ Negative I². Always `max(0, ...)`.
- ❌ Continuity correction for Peto.
- ❌ `1 - Φ(z)` for two-tailed p. Use `2 × (1 - Φ(|z|))`.
- ❌ Compute CI on original scale for ratio measures. Compute on log scale, then `exp()` the bounds.

### Test fixtures

Validate `packages/stats-engine` against R `meta::metabin` / `meta::metacont` outputs. Must match to within 1e-10. Fixture datasets in `packages/stats-engine/test/fixtures/`:
- `clopidogrel.json` (MH, OR, fixed)
- `aspirin-mi.json` (Peto, OR, fixed)
- `bp-meta.json` (IV, MD, random)
- `ssri-depression.json` (DL, SMD, random)
- `zero-cell.json` (edge case)
- `rare-events.json` (Peto edge case)
- `subgroup-demo.json` (subgroup pooling)
- `single-study.json` (degenerate)
- `high-i2.json` (I² > 90%)
- `dta-malaria.json` (DTA univariate + HSROC)

Each fixture: `{ input, expected, rReference: { package, version, code, output } }`.

---

## 11. THE 6 PHASES

### Phase 0 — Foundation + Tauri Shell (4 days)

**Goal:** Empty Tauri desktop app that launches, shows "Welcome to RevKit", with Next.js + SQLite + Prisma wired and CI green.

**Tasks:**
1. Create GitHub repo `revkit` (public, MIT).
2. `pnpm create next-app@latest apps/web --typescript --tailwind --app --turbopack`.
3. Configure `next.config.ts`:
   ```typescript
   export default {
     output: 'export',
     images: { unoptimized: true },
   };
   ```
4. Install shadcn/ui + base components: button, card, input, label, dialog, dropdown-menu, command, data-table, sidebar, toast, tooltip, badge, separator.
5. Set up Prisma with SQLite (`provider = "sqlite"`, `url = "file::memory:"`). Generate client. First migration.
6. `pnpm create tauri-app@latest apps/desktop --template vanilla-ts`.
7. Configure `apps/desktop/src-tauri/tauri.conf.json`:
   - `frontendDist: "../web/out"`
   - `build.beforeBuildCommand: "cd ../web && pnpm build"`
   - Window: 1440×900, min 1024×700.
   - Bundle targets: `msi`, `nsis`, `dmg`, `appimage`, `deb`.
8. `apps/desktop/src-tauri/src/main.rs` — register plugins: `tauri-plugin-sql`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-store`, `tauri-plugin-updater`.
9. Native menu bar (File / Edit / View / Help) via `tauri::Menu`. File menu items per §7 (most grayed out; New / Open / Quit enabled).
10. Welcome screen (`apps/web/app/(welcome)/page.tsx`) — "RevKit" logo + "New Review" button + "Open…" button + empty "Recent files" list.
11. `apps/web/lib/tauri/bridge.ts` — `isTauri()` guard + wrappers for `openProject`, `saveProject`, `pickFile`, `pickSavePath`.
12. GitHub Actions CI: lint + typecheck + test + build (web) + `pnpm tauri build` smoke test on Ubuntu.

**Acceptance:**
- [ ] `pnpm tauri dev` launches the desktop app.
- [ ] Welcome screen renders with "New Review" and "Open…" buttons.
- [ ] `pnpm tauri build` produces a `.deb` / `.AppImage` (on Linux CI runner).
- [ ] Native menu bar visible with File menu.
- [ ] CI green on every PR.
- [ ] GitHub repo has README + LICENSE (MIT).

---

### Phase 1 — Wizard + File Operations (5 days)

**Goal:** User can create a review of any of the 5 types via the wizard, save as `.revkit`, reopen, see in Recent.

**Tasks:**
1. **New Review Wizard** (`apps/web/components/reviews/new-review-wizard.tsx`):
   - Step 1: "Which type of review do you want to create?" — 5 radio buttons (Intervention / DTA / Methodology / Overview / Flexible).
   - Step 2: Sub-type dropdown (Prognosis / Etiology / Qualitative / None) — disabled if not applicable.
   - Step 3: Title + research question.
   - Step 4: Confirm + create.
   - On finish: initialize empty Review object in memory, mark `isDirty = true`, route to review workspace.
2. **Tauri commands** (`apps/desktop/src-tauri/src/commands.rs`):
   - `open_project(path: String) -> Result<String, String>` — reads file, returns JSON string.
   - `save_project(path: String, json: String) -> Result<(), String>` — atomic write (`.tmp` then rename).
   - `pick_open_file() -> Result<Option<String>, String>` — native open dialog, `.revkit` filter.
   - `pick_save_file(default_name: String) -> Result<Option<String>, String>` — native save dialog.
3. **Project state** (`apps/web/lib/project/state.ts`):
   - Zustand store: `{ review, currentPath, isDirty, recentFiles }`.
   - Actions: `newReview`, `openReview`, `saveReview`, `saveAsReview`, `markDirty`, `updateReview`.
4. **Project serialization** (`apps/web/lib/project/serialize.ts`):
   - `serializeReview(review): string` — review object → JSON.
   - `parseReview(json): Review` — JSON → review (zod validation).
   - `validateFormat(json): { valid, formatVersion }`.
   - `migrateReview(oldReview): Review` — stub for future migrations.
5. **Recent files** — Tauri `store` plugin. On Open/Save, prepend path (max 10, dedupe).
6. **Welcome screen update** — Recent files as cards (title, path, last-modified). Click to open.
7. **File menu wiring** — New / Open / Save / Save As / Open Recent / Quit all functional.
8. **Dirty-state tracking** — title bar shows `●` when dirty; close/quit intercepts with "Save changes?".
9. **Review workspace shell** (`apps/web/app/(review)/layout.tsx`) — left sidebar (Overview / Studies / Comparisons / Risk of Bias / PRISMA / Export / Settings) + top bar (title, type pill, status pill).
10. **Overview page** — editable title + research question; phase stepper; read-only type display.

**Acceptance:**
- [ ] Click "New Review" → wizard → pick "DTA" → enter title → finish → workspace opens with empty DTA review.
- [ ] File → Save → native save dialog → file written as `<title>.revkit`.
- [ ] File → Open → native open dialog → pick `.revkit` → loads into workspace.
- [ ] Recent files list shows last opened after restart.
- [ ] Close window with unsaved changes → "Save changes?" dialog appears.
- [ ] All 5 review types selectable in wizard.

---

### Phase 2 — Studies & References (5 days)

**Goal:** Import references from RIS, screen them, promote to studies, attach PDFs.

**Tasks:**
1. **References page** (`apps/web/app/(review)/references/page.tsx`) — TanStack Table: title, authors, year, journal, DOI, stage, decision, actions.
2. **Import dialog** — drag-drop `.ris` or `.bib`; parse with `@rivanlse/ris-parser` + `@retorquere/bibtex-parser`; dedup by title-hash + DOI; bulk insert into in-memory SQLite.
3. **Screening UI** — per-reference Include / Exclude / Maybe buttons; exclude-reason dropdown (Cochrane presets: wrong population, wrong intervention, wrong outcome, wrong study design, not RCT, duplicate, withdrawn); bulk actions.
4. **Promote to study** — button on each included reference; opens study form (label, year, authors, DOI, design dropdown).
5. **Studies page** — list of promoted studies.
6. **Study detail page** — PICOS form (JSON fields), references tab, PDF attachment tab (Tauri file picker; stores absolute path in `study.pdfPath`), notes tab.
7. For **DTA reviews**: study form additionally asks for index test name + reference standard.
8. **Open PDF button** — calls Tauri `open` command to launch OS default PDF viewer.

**Acceptance:**
- [ ] Import 200-row RIS → all persist; duplicates caught; toast: "234 imported, 18 duplicates skipped".
- [ ] Screen 10 references (5 include, 5 exclude) → decisions persist after save+reopen.
- [ ] Promote 1 reference to study → study appears; reference still linked.
- [ ] Attach PDF → path stored; "Open PDF" button launches system viewer.
- [ ] Save + close + reopen → all data restored.

---

### Phase 3 — Data Entry + DTA Calculator (7 days)

**Goal:** Build the comparison/outcome tree, enter data per study, including the DTA calculator and DTA 2×2 data entry.

**Tasks:**
1. **Sidebar tree** (`apps/web/components/reviews/review-tree.tsx`):
   - For Intervention/Methodology/Flexible: Comparisons → Outcomes → Subgroups.
   - For DTA: Tests → Analyses (1 analysis = 1 test threshold group).
   - For Overview: Linked review IDs.
   - Drag-drop reorder, context menu, inline rename.
2. **Outcome creation dialog** — name, data type, effect measure, method, model.
   - Intervention data types: Dichotomous, Continuous, O-E&V, GIV.
   - DTA data types: 2×2 (TP/FP/FN/TN).
3. **Data entry grid** (`apps/web/components/data-entry/data-grid.tsx`):
   - TanStack Table. Columns by data type:
     - Dichotomous: Study | Subgroup | Events1 | Total1 | Events2 | Total2
     - Continuous: Study | Subgroup | Mean1 | SD1 | N1 | Mean2 | SD2 | N2
     - GIV: Study | Subgroup | Effect | SE
     - **DTA 2×2**: Study | Subgroup | TP | FP | FN | TN | [🧮 calc button]
   - Inline editing, validation (events ≤ total, n>0), paste from Excel.
4. **DTA Calculator** (`apps/web/components/dta/Calculator.tsx`) per §9.
5. **Live preview plot** at bottom of outcome page — minimal (study rows + pooled diamond). Full plots in Phase 4.

**Acceptance:**
- [ ] Intervention review: create comparison → outcome → add 5 studies with dichotomous data.
- [ ] DTA review: create test → analysis → add 5 studies with TP/FP/FN/TN.
- [ ] DTA Calculator standalone: TP=80, FP=10, FN=20, TN=90 → Sensitivity 80.0%, Specificity 90.0%, PPV 88.9%, NPV 81.8%, LR+ 8.0, LR- 0.22, Prevalence 50.0% (with 95% CIs).
- [ ] Calculator opened from a study row pre-fills + writes back on OK.
- [ ] Paste from Excel works for all 4 data types.
- [ ] Save + close + reopen → data entry grid intact.

---

### Phase 4 — Meta-Analysis Engine + Plots (8 days)

**Goal:** Compute pooled effects, render forest plots (intervention + DTA), funnel plots, SROC plot.

**Tasks:**
1. **Stats engine** (`packages/stats-engine/` — pure TS, 100% tested) per §10 formulas:
   - `iv.ts` — Inverse Variance (fixed).
   - `mh.ts` — Mantel-Haenszel (dichotomous).
   - `peto.ts` — Peto O-E & V.
   - `dl.ts` — DerSimonian-Laird (random, wraps any method).
   - `heterogeneity.ts` — Q, I², τ², H.
   - `dta.ts` — Univariate logit pooling for Sens & Spec; DOR pooling; HSROC simple regression.
2. **Forest plot component** (`apps/web/components/forest-plot/ForestPlot.tsx`):
   - D3 + SVG. Box size ∝ weight. Summary diamonds. Log axis for ratios, linear for differences. I²/Q/τ² annotation. Test for overall effect.
3. **DTA forest plot** (`apps/web/components/forest-plot/DtaForestPlot.tsx`):
   - Two side-by-side panels: Sensitivity (95% CI) and Specificity (95% CI).
   - Study rows + pooled diamond per panel.
4. **SROC plot** (`apps/web/components/forest-plot/SrocPlot.tsx`):
   - X-axis: 1 − Specificity. Y-axis: Sensitivity.
   - Each study = circle (size ∝ sample size).
   - HSROC summary curve + summary point with 95% confidence region.
5. **Funnel plot** — intervention only.
6. **Subgroup analysis** — for intervention reviews.
7. **Outcome detail page** upgrade — tabs: Forest | Funnel (intervention) / SROC (DTA) | Sensitivity | Subgroups.
8. **Export plot PNG/SVG** — buttons on each plot; uses Tauri save dialog.

**Acceptance:**
- [ ] Intervention forest plot matches R `meta::metabin` output on 10 fixture datasets to within 1e-10.
- [ ] DTA forest plot shows Sens + Spec side by side with correct 95% CIs per study.
- [ ] SROC plot renders study points + HSROC summary curve + summary point.
- [ ] Switching fixed → random updates diamond within 100ms.
- [ ] Subgroup analysis shows subgroup + overall diamonds.
- [ ] Export PNG + SVG works for all 3 plot types via native save dialog.
- [ ] Stats-engine coverage: 100% line, 100% branch.

---

### Phase 5 — Risk of Bias + PRISMA + Export (7 days)

**Goal:** RoB assessments (3 tools), PRISMA flow, Word + CSV export.

**Tasks:**
1. **RoB 2** (RCTs, 5 domains per Cochrane BMJ 2019;366:l4898):
   - D1: Randomization process
   - D2: Deviations from intended interventions
   - D3: Missing outcome data
   - D4: Measurement of the outcome
   - D5: Selection of the reported result
   - Algorithm-mapped judgements: Low / Some concerns / High.
2. **ROBINS-I** (non-randomized, 7 domains per BMJ 2016;355:i4919, V2 Nov 2024):
   - D1: Confounding
   - D2: Selection of participants
   - D3: Classification of interventions
   - D4: Deviations from intended interventions
   - D5: Missing data
   - D6: Measurement of outcomes
   - D7: Selection of the reported result
   - Judgements: Low / Moderate / Serious / Critical / No information.
3. **QUADAS-2** (DTA, 4 domains):
   - D1: Patient selection
   - D2: Index test
   - D3: Reference standard
   - D4: Flow and timing
   - Judgements: Low / High / Unclear.
4. **RoB UI** — per-study assessment editor; algorithm computes overall from SQs; reviewer can override with reason.
5. **Traffic-light plot** — per study, colored circles per domain.
6. **Summary plot** — across studies, stacked bars per domain.
7. **PRISMA 2020 flow editor** (`apps/web/components/prisma-flow/PrismaFlowEditor.tsx`) — React-Flow with 11 canonical boxes:
   - Identification: Records from databases/registers (n=); Records from other sources (n=); Records removed before screening — Duplicates (n=) + Auto-ineligible (n=)
   - Screening: Records screened (n=); Records excluded (n=)
   - Eligibility: Reports sought for retrieval (n=); Reports not retrieved (n=); Reports assessed for eligibility (n=); Reports excluded with reasons (n=)
   - Included: Studies included in review (n=); Studies included in meta-analysis (n=)
   - Auto-count mode (pulls from references/stages); manual override; export PNG/SVG.
8. **Word export** (`apps/web/lib/export/docx.ts`) — uses `docx` library. Title page, abstract, background, methods, results (with embedded plots as PNG), discussion, references. Cochrane-style typography (Times New Roman 12pt, 1.5 line height, justified, bold headings).
   - Tauri command `export_docx(json) -> bytes` writes file via Tauri save dialog.
9. **CSV export** — ZIP of `studies.csv`, `data-points.csv`, `rob-assessments.csv`, `prisma-flow.json`, `narrative.md`. Tauri save dialog.

**Acceptance:**
- [ ] RoB 2 algorithm matches official Excel tool v22-Aug-2019 on every signalling-question combination.
- [ ] ROBINS-I 7 domains work.
- [ ] QUADAS-2 4 domains work for DTA reviews.
- [ ] Traffic-light + summary plots render correctly.
- [ ] PRISMA editor renders 11 canonical boxes with auto-counts.
- [ ] Word export opens in Word + LibreOffice without errors; includes embedded forest plots.
- [ ] CSV export round-trips (export → re-import → identical state).
- [ ] All exports via native save dialogs (no browser download prompt).

---

### Phase 6 — Polish + Sign + Release (5 days)

**Goal:** Production-ready, signed binaries, GitHub Release v0.1.0.

**Tasks:**
1. **E2E tests** (Playwright + Tauri):
   - Launch app → New Review (DTA) → import references → screen → promote to study → enter TP/FP/FN/TN → run meta-analysis → assess QUADAS-2 → build PRISMA → export Word → save `.revkit` → close → reopen → state intact.
2. **Performance audit** — render 50-study forest plot < 100ms; save 1000-study review < 500ms.
3. **Sentry** error tracking (frontend JS errors + Rust panics via `sentry-rust`).
4. **Auto-update setup**:
   - `tauri-plugin-updater` checks `https://github.com/you/revkit/releases/latest/download/latest.json` on launch.
   - Generate signing key: `pnpm tauri signer generate -w ~/.tauri/revkit.key`.
   - Store `TAURI_SIGNING_PRIVATE_KEY` + password in GitHub Actions secrets.
5. **Code signing**:
   - Windows: Azure Trusted Signing (or self-signed for v0.1; "Unknown publisher" warning acceptable).
   - macOS: Apple Developer ID + notarization via `xcrun notarytool` in CI.
   - Linux: AppImage (no signing); `.deb` signed with GPG.
6. **Release pipeline** (`.github/workflows/release.yml`):
   - Triggers on tag push `v*`.
   - Matrix builds on `ubuntu-latest`, `macos-latest`, `windows-latest`.
   - Uses `tauri-apps/tauri-action@v0`.
   - Uploads 5 artifacts (`.msi`, `.exe`, `.dmg`, `.AppImage`, `.deb`) + `latest.json` manifest to GitHub Releases.
7. **README** — quickstart, screenshots, install instructions per OS, link to docs.
8. **LICENSE** (MIT), **CONTRIBUTING.md**, **CODE_OF_CONDUCT.md**, **SECURITY.md**.
9. **GitHub repo public**. Tag `v0.1.0`. Publish Release with download links.
10. **Launch announcement** — HN Show HN, Reddit r/sysreviews + r/epidemiology, Mastodon, LinkedIn, Cochrane forum.

**Acceptance:**
- [ ] All E2E tests green on every PR.
- [ ] Save 1000-study review < 500ms.
- [ ] No Sentry errors in last 24h.
- [ ] Auto-update: install v0.1.0, push v0.1.1 tag, relaunch → app prompts "Update available?".
- [ ] GitHub Release v0.1.0 has 5 downloadable binaries.
- [ ] Windows `.exe` installs without errors (Windows 10 + 11).
- [ ] macOS `.dmg` opens + installs (Intel + Apple Silicon).
- [ ] Linux `.AppImage` runs (Ubuntu 22.04 + 24.04).
- [ ] GitHub repo public with all 4 governance files.
- [ ] At least 3 beta users have installed + created a review.
- [ ] Launch announcement posted to 3+ channels.

---

## 12. Calendar (realistic, 4 hrs/day, 5 days/week)

| Week | Phase | Days | What ships |
|---|---|---|---|
| 1 | Phase 0 | 1-4 | Tauri shell launches, welcome screen |
| 1-2 | Phase 1 | 5-9 | Wizard + File menu + .revkit save/load |
| 2-3 | Phase 2 | 10-14 | Studies + references + PDF attach |
| 3-4 | Phase 3 | 15-21 | Data entry + DTA Calculator |
| 5-6 | Phase 4 | 22-29 | Stats engine + forest + DTA + SROC plots |
| 6-7 | Phase 5 | 30-36 | RoB + PRISMA + Word export |
| 8 | Phase 6 | 37-41 | Polish + signing + GitHub Release v0.1.0 |

**Total: 41 working days = ~8.5 weeks part-time / ~4.5 weeks full-time.**

**Buffer:** Build in 20% buffer. If Phase 4 takes 10 days instead of 8, push launch by 2 days. Don't cut acceptance criteria.

---

## 13. Troubleshooting (when things break)

| Symptom | Fix |
|---|---|
| GLM-5.2 gives broken code | Paste FULL error back. Say "fix only the broken part." Don't regenerate whole phase. |
| GLM-5.2 forgets earlier decisions | Start fresh chat. Re-paste this entire master prompt. Add brief context summary. |
| `pnpm install` peer dep conflict | `pnpm install --no-frozen-lockfile`. If still failing, ask GLM-5.2 which version to pin. |
| Prisma migration drift | `pnpm prisma migrate reset` then re-run. |
| Tauri build fails on Rust error | Read Rust error carefully. Most common: missing plugin registration in `main.rs`, or wrong plugin version in `Cargo.toml`. |
| WebView2 missing on Windows | Tauri bootstrapper auto-installs; if not, document manual install step in README. |
| macOS notarization fails | Need Apple Developer ID ($99/year) + app-specific password. Set in GitHub secrets: `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`. |
| Stats don't match R | Add debug logs printing every intermediate value. Compare with R `meta` verbose output. Find divergence. |
| `.revkit` file won't open | Check JSON validity. If schema mismatch, run migration. If corrupt, offer to attempt recovery from `.bak`. |
| Stuck 3+ hours | Stop. Take a walk. Re-read the phase's tasks. Worst case: skip the feature, mark TODO, move on. Come back later. |

---

## 14. How to execute this plan (instructions to GLM-5.2)

When I say **"Start Phase N"**, you will:

1. Read the Phase N spec above (§11).
2. Output the code in labeled code blocks (full file path as first comment).
3. Tell me which files to create/modify.
4. Tell me which commands to run (`pnpm install`, `pnpm prisma migrate dev --name ...`, etc.).
5. After I confirm the code is in place and tests pass, run the acceptance checklist and report pass/fail per item.
6. If any item fails, propose a minimal fix (don't regenerate the whole phase).
7. When all items pass, tell me to commit + tag: `git commit -m "feat(phase-N): <summary>" && git tag phase-N-complete`.
8. Wait for me to say "Start Phase N+1".

**Begin Phase 0 now.** Output the foundation code (Phase 0 tasks 1-12 from §11). Use the strict rules from the top of this file.

---

*End of master prompt. Single source of truth. Paste into a fresh chat to (re)start the build at any phase.*
