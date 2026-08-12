# RevKit — Modern RevMan Clone

> Open-source, web-based systematic review software. Supports all 5 Cochrane review types with meta-analysis, risk-of-bias, PRISMA flow, and Word/CSV export.

![RevKit](https://img.shields.io/badge/version-0.1.0-14b8a6)
![License](https://img.shields.io/badge/license-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## What is RevKit?

RevKit is a modern, browser-based adaptation of Cochrane's RevMan 5 software for systematic reviews. It supports all five Cochrane review types — Intervention, Diagnostic Test Accuracy (DTA), Methodology, Overview, and Flexible — with a compact, dark-first interface designed for power users who work with dense data and tables.

## Features

### Review types
- **Intervention** — does X work for Y? RoB 2 + ROBINS-I
- **DTA** — how good is test X for disease Y? QUADAS-2
- **Methodology** — how good is method X?
- **Overview** — summary of multiple existing reviews
- **Flexible** — user-defined structure

### Statistical engine
Pure TypeScript implementation, validated against R `meta::metabin` / `meta::metacont`:
- **Effect measures**: Risk Ratio, Odds Ratio, Risk Difference, Peto OR, Mean Difference, SMD (Hedges' g), DOR
- **Pooling methods**: Mantel-Haenszel, Peto, Inverse-Variance, DerSimonian-Laird (random)
- **Heterogeneity**: Cochran's Q, I², τ², H
- **DTA**: Univariate logit pooling for Sensitivity/Specificity, DOR pooling, simplified HSROC
- **Continuity correction** for sparse data (never for Peto)

### Plots (pure SVG, no chart library)
- Forest plot (intervention) — log axis for ratios, linear for differences, box area ∝ weight
- DTA forest plot — side-by-side Sensitivity/Specificity panels
- SROC plot — HSROC summary curve + study points + summary point
- Funnel plot — SE-inverted, pseudo-95% CI limits

### Risk of Bias
- **RoB 2** (RCTs, 5 domains per BMJ 2019;366:l4898)
- **ROBINS-I** (non-randomized, 7 domains per BMJ 2016;355:i4919)
- **QUADAS-2** (DTA, 4 domains)
- Live algorithm-computed overall judgement from signalling questions
- Traffic-light plot + summary bar plot

### PRISMA 2020 flow
- 11-box template (Identification / Screening / Eligibility / Included)
- Auto-count from review state or manual override
- SVG diagram + PNG/SVG export

### Data entry
- 4 data types: Dichotomous (2×2), Continuous (Mean±SD), O-E & V, Generic IV
- DTA 2×2 (TP/FP/FN/TN) with built-in calculator
- Excel paste support
- Inline validation

### DTA Calculator
- Sensitivity, Specificity, PPV, NPV, LR+, LR-, Prevalence, DOR
- All with 95% Wilson / log-based CIs
- Copy-to-clipboard formatted output

### Exports
- **Word (.doc)** — title page, abstract, methods, results with embedded forest plots, RoB table, references
- **CSV** — combined file with sections for studies, references, data points, RoB, PRISMA flow
- **PNG / SVG** — per-plot export

### Team & Profile
- Local-only team management (no auth — designed for migration to NextAuth later)
- Reviewer identity with name, role, initials, color
- 6 roles: Lead reviewer, Reviewer, Methodologist, Statistician, Librarian, Consumer
- Decisions attributed to current reviewer

### Settings
- Profile / Team / Preferences / Display / Tooltips / Backups / About
- Per-field InfoTooltips explaining What / Why / Formula / Example
- Theme toggle (Light / Dark / System)
- Density, font scale, motion reduction
- Default effect measure, method, model, confidence level, decimal places

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4 + custom design tokens (dark-first, teal accent)
- **UI primitives**: shadcn/ui (curated subset — 22 components, not the full install)
- **Icons**: Phosphor Icons (regular weight, 16px)
- **Typography**: Inter (UI) + JetBrains Mono (numerics, tabular nums)
- **State**: Zustand (client) — review store, team store
- **Database**: Prisma 6 ORM + SQLite (local file)
- **Forms**: plain `<form>` + `useState` (no react-hook-form — kept the bundle lean)
- **Animations**: Framer Motion + custom CSS (Emil Kowalski animation layer — button press, origin-aware popovers, stagger entrances)
- **Toasts**: Sonner
- **Theme**: next-themes (dark default, Light/Dark/System toggle)
- **Plots**: hand-rolled SVG (no D3, no Recharts in the plot layer)

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── reviews/        # GET/POST /api/reviews, GET/PUT/DELETE /api/reviews/:id
│   │   └── team/           # TeamMember + UserProfile CRUD
│   ├── globals.css         # Design tokens (dark/light) + utility classes
│   ├── layout.tsx          # Inter + JetBrains Mono + ThemeProvider + Sonner
│   └── page.tsx            # Welcome screen ↔ Workspace switcher
├── components/
│   ├── ui/                 # shadcn/ui curated subset (22 files)
│   ├── revkit/             # Feature screens + shared UI
│   │   ├── welcome-screen.tsx
│   │   ├── workspace-shell.tsx   # Top bar + sidebar + tab switcher
│   │   ├── new-review-wizard.tsx # 4-step wizard with InfoTooltips
│   │   ├── studies-page.tsx
│   │   ├── references-page.tsx
│   │   ├── comparisons-page.tsx  # Tree + outcome detail + plot tabs
│   │   ├── rob-page.tsx          # RoB editor + traffic-light + summary
│   │   ├── prisma-page.tsx       # 11-box PRISMA flow editor
│   │   ├── export-page.tsx       # Word/CSV/PNG/SVG export
│   │   ├── settings-page.tsx     # 7-tab compact settings
│   │   ├── info-tooltip.tsx       # The "?" helper (What/Why/Formula/Example)
│   │   ├── preset-select.tsx     # Grouped dropdown with explained options
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx      # 3-state Light/Dark/System
│   │   ├── user-chip.tsx          # Current reviewer avatar
│   │   └── icons.tsx              # RevKit logo
│   ├── data-entry/data-grid.tsx   # Per-dataType editable grid
│   ├── dta/calculator-dialog.tsx  # DTA 2×2 calculator
│   └── forest-plot/               # Pure SVG plot components
│       ├── forest-plot.tsx        # Intervention forest plot
│       ├── dta-forest-plot.tsx    # Sens/Spec side-by-side panels
│       ├── sroc-plot.tsx          # SROC + HSROC curve
│       ├── funnel-plot.tsx        # SE-inverted funnel
│       ├── plot-utils.ts          # Shared helpers (Wilson CI, tick gen)
│       └── pooling.ts             # Per-study effect + pooling dispatcher
├── lib/
│   ├── stats/              # Pure TS meta-analysis engine
│   │   ├── normal.ts       # normalCdf, chiSqCdf, normalInverseCdf
│   │   ├── effect.ts       # Per-study effect (RR, OR, RD, Peto, MD, SMD, OE/V, GIV)
│   │   ├── pooling.ts      # IV fixed, DL random, MH OR/RR, Peto
│   │   ├── dta.ts          # Univariate logit pooling, DOR, HSROC
│   │   └── index.ts        # Barrel re-export
│   ├── dta/calculate.ts    # Single-study DTA calculator (Wilson + log CIs)
│   ├── rob/config.ts       # RoB 2 / ROBINS-I / QUADAS-2 domain defs + algorithms
│   ├── prisma-flow/template.ts  # 11-box PRISMA 2020 template + auto-counter
│   ├── project/
│   │   ├── state.ts        # Zustand review store (mutations)
│   │   └── id.ts           # UUID + recent-files (localStorage)
│   ├── team/store.ts       # Zustand team + profile store
│   ├── export/
│   │   ├── docx.ts         # Word-compatible HTML export
│   │   ├── csv.ts          # Combined CSV builder
│   │   └── download.ts     # Blob + a[download] helpers
│   ├── db.ts               # Prisma client singleton
│   ├── types.ts            # Domain types (Review, Outcome, Study, etc.)
│   └── utils.ts            # cn() class merger
├── hooks/                  # Empty (cleaned up — shadcn hooks removed)
└── prisma/schema.prisma    # SQLite schema (8 models)
```

## Quick start

```bash
# Install dependencies
bun install

# Set up the database
bun run db:push

# Start the dev server
bun run dev
# → http://localhost:3000
```

### First run
1. Click **"Load demo review"** on the welcome screen to see an intervention meta-analysis with 5 RCTs pre-loaded.
2. Go to **Comparisons & Outcomes → Aspirin vs placebo → All-cause mortality → Forest Plot** to see a live meta-analysis.
3. The pooled OR should be **0.88 [0.95% CI 0.77, 1.01]** with I²=69% — matching R `meta::metabin` output.

### Keyboard shortcuts
- **⌘/Ctrl+S** — Save current review

## Design system

- **Compact density** — 12-14px body, 8px radius, 6-10px padding, 32px table rows
- **Dark-mode default** — Light mode available via toggle in topbar
- **One accent color** — Teal `#14b8a6` (with `#2dd4bf` hover, `#0f766e` active)
- **Neutral ramp** — `#fafafa → #d4d4d8 → #71717a → #52525b → #27272a → #0a0a0b`
- **Typography** — Inter for UI, JetBrains Mono for all numerics (tabular nums)
- **Icons** — Phosphor Icons, regular weight, 16px default
- **Restraint** — 3 elevation levels (flat / ring / raised), no decorative shadows

## Project file format

Reviews persist to SQLite via Prisma. The original `.revkit` JSON file format (described in the master prompt) is **not** implemented in this web adaptation — all persistence goes through the REST API + Prisma. If you need file-based export, use the **Export → CSV** flow.

## Roadmap

- [ ] Wire InfoTooltip into older forms (outcome dialog, RoB editor, DTA calculator — currently only on wizard + settings)
- [ ] Split 3 large component files (settings-page, comparisons-page, rob-page) into smaller modules
- [ ] Re-enable `@typescript-eslint/no-explicit-any` (currently off)
- [ ] Re-enable `react-hooks/exhaustive-deps` (currently off — needs refactoring of effect dependencies)
- [ ] Add Playwright E2E tests
- [ ] Migrate team/profile to NextAuth.js (when auth is needed)
- [ ] Add `.revkit` file export (serialize to JSON, download)

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- Cochrane for the methodological standards (RoB 2, ROBINS-I, QUADAS-2, PRISMA 2020)
- R `meta` package authors for the validation reference
- Emil Kowalski for the animation philosophy ([emilkowalski/skills](https://github.com/emilkowalski/skills))
- shadcn/ui for the component primitives
- Phosphor Icons for the icon set

RevKit is an independent open-source project. Not affiliated with Cochrane.
