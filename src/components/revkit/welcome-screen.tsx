"use client";

// src/components/revkit/welcome-screen.tsx
//
// Compact redesign — Linear/Vercel dark-first density with teal accent.
//
// Design principles:
//   • Compact 44px sticky top bar; max-w-5xl content column.
//   • Hero is `py-10` (NOT 80vh) — single-line H1 at 26px, 2 inline CTAs.
//   • 3-tile action row at `grid grid-cols-3 gap-3` — accent on New Review.
//   • 4-feature inline strip — no dividers, just whitespace + tiny icons.
//   • Library list — single-column compact rows (3-line: title, RQ, badges).
//   • Empty state — dashed `card-compact` with centered icon.
//   • Footer — one-line `text-xs text-meta` centered.
//
// Phosphor icons are used throughout. Note: this installed version of
// @phosphor-icons/react (v2.1.10) does NOT export the bare names
// `Activity`, `Layers`, `Settings2`, `Trash2`, `ChevronLeft`, `ChevronRight`,
// `Sparkles`, or `FlaskConical`. We use closest visual equivalents:
//   Activity → Pulse · Layers → Stack · Settings2 → Gear · Trash2 → Trash
//   Sparkles → Sparkle · FlaskConical → Flask
//   ChevronLeft/Right → CaretLeft/CaretRight (wizard only)

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  FolderOpen,
  Trash,
  FileText,
  Sparkle,
  ChartBar,
  ShieldCheck,
  Stack,
  Export,
  Microscope,
  Flask,
  Gear,
  Pulse,
} from "@phosphor-icons/react";
import { RevKitLogo } from "@/components/revkit/icons";
import { NewReviewWizard } from "@/components/revkit/new-review-wizard";
import { ThemeToggle } from "@/components/revkit/theme-toggle";
import type { ReviewType, ReviewSubType } from "@/lib/types";
import { removeRecentFile } from "@/lib/project/id";

interface Props {
  onNew: (input: { title: string; type: ReviewType; subType: ReviewSubType; researchQuestion: string }) => void;
  onOpen: (id: string) => void;
  refreshKey: number;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  INTERVENTION: Pulse,
  DTA: Microscope,
  METHODOLOGY: Flask,
  OVERVIEW: Stack,
  FLEXIBLE: Gear,
};

interface SavedReviewMeta {
  id: string;
  title: string;
  type: string;
  subType: string | null;
  status: string;
  phase: string;
  updatedAt: string;
  researchQuestion: string | null;
}

const FEATURES = [
  { icon: ChartBar, label: "Meta-analysis engine", desc: "MH · Peto · IV · DL" },
  { icon: ShieldCheck, label: "Risk of bias", desc: "RoB 2 · ROBINS-I · QUADAS-2" },
  { icon: Stack, label: "PRISMA 2020", desc: "11-box flow editor" },
  { icon: Export, label: "Exports", desc: "Word · CSV · PNG · SVG" },
] as const;

export function WelcomeScreen({ onNew, onOpen, refreshKey }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saved, setSaved] = useState<SavedReviewMeta[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    // setState calls happen inside async .then/.catch callbacks (NOT in the
    // effect body itself), so we avoid the react-hooks/set-state-in-effect
    // lint warning that fires for synchronous setState in effect bodies.
    fetch("/api/reviews", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: { reviews?: SavedReviewMeta[] }) => {
        if (cancelled) return;
        setSaved(data.reviews ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted || cancelled) return;
        setLoading(false);
        console.error("Failed to load saved reviews", err);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [refreshKey]);

  function handleDelete(id: string) {
    if (!confirm("Delete this review permanently? This cannot be undone.")) return;
    fetch(`/api/reviews/${id}`, { method: "DELETE" })
      .then(() => {
        setSaved((prev) => prev?.filter((r) => r.id !== id) ?? []);
        removeRecentFile(id);
        toast.success("Review deleted");
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast.error(`Failed to delete: ${msg}`);
      });
  }

  function scrollToLibrary() {
    document.getElementById("recent-saved")?.scrollIntoView({ behavior: "smooth" });
  }

  function loadDemo() {
    onNew({
      title: "Aspirin for secondary prevention of cardiovascular events (demo)",
      type: "INTERVENTION",
      subType: null,
      researchQuestion:
        "In adults with prior MI, does aspirin reduce all-cause mortality vs placebo?",
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Sticky top bar (44px) ───────────────────────────────────────────
         Hairline border-b, surface tinted with backdrop blur so content
         remains legible under scroll. Logo + wordmark left, ThemeToggle
         right. */}
      <header className="bg-surface backdrop-blur-xl backdrop-saturate-150 border-b border-border sticky top-0 z-10 h-11">
        <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="text-md font-semibold tracking-display">RevKit</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs uppercase tracking-[0.04em] text-meta sm:inline">
              v0.1.0 · MIT
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Hero — logo as the hero element ────────────────────────────────
         The RevKit logo says it all: "Systematic Reviews · Meta-Analysis ·
         Evidence Synthesis" + "Better Evidence. Better Decisions." No need
         for duplicate text. The logo fills the hero space, buttons below. */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl enter-pop flex flex-col items-center text-center">
          {/* Large hero logo — fills the space the eyebrow/H1/paragraph used to */}
          <RevKitLogo className="w-full max-w-md sm:max-w-lg h-auto" />
          {/* Two CTAs directly below the logo */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="group relative inline-flex h-9 items-center gap-2 rounded-[10px] px-5 text-[14px] font-semibold tracking-display transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                color: "white",
                boxShadow: "0 2px 8px color-mix(in oklab, var(--primary), transparent 60%), 0 0 0 1px color-mix(in oklab, var(--primary), transparent 80%)",
              }}
            >
              <Plus size={16} weight="bold" className="transition-transform group-hover:scale-110" />
              Create new review
            </button>
            <button
              type="button"
              onClick={loadDemo}
              className="btn-compact btn-secondary h-9 px-4 text-[14px]"
            >
              <Sparkle size={14} weight="fill" />
              Load demo
            </button>
          </div>
        </div>
      </section>

      {/* ── 3-tile action row ───────────────────────────────────────────────
         Tile 1 (New Review) carries the teal accent via bg-accent-subtle on
         the icon tile; tiles 2 and 3 walk down to neutral bg-surface-hover so
         the eye stays on the primary action. stagger-item applies the 50ms
         stepped entrance (0/40/80ms). */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-3 gap-3">
          {/* Tile 1 — New Review (accent) */}
          <div className="stagger-item bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-lg shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-accent-subtle text-accent">
              <FileText size={18} weight="duotone" />
            </div>
            <div className="space-y-1">
              <h3 className="text-md font-medium tracking-display">New review</h3>
              <p className="text-xs text-muted-fg leading-relaxed">
                Start a new systematic review with the 4-step wizard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="btn-compact btn-ghost text-accent mt-auto self-start"
            >
              Create
            </button>
          </div>

          {/* Tile 2 — Browse library (neutral) */}
          <div className="stagger-item bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-lg shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-surface-hover text-fg-2">
              <FolderOpen size={18} weight="duotone" />
            </div>
            <div className="space-y-1">
              <h3 className="text-md font-medium tracking-display">Browse library</h3>
              <p className="text-xs text-muted-fg leading-relaxed">
                Pick a review from your saved library below.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToLibrary}
              className="btn-compact btn-ghost mt-auto self-start"
            >
              Browse
            </button>
          </div>

          {/* Tile 3 — Demo (neutral) */}
          <div className="stagger-item bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-lg shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col gap-3 p-4">
            <div className="flex size-9 items-center justify-center rounded-md bg-surface-hover text-fg-2">
              <Sparkle size={18} weight="duotone" />
            </div>
            <div className="space-y-1">
              <h3 className="text-md font-medium tracking-display">Try a demo</h3>
              <p className="text-xs text-muted-fg leading-relaxed">
                Intervention meta-analysis with sample data pre-loaded.
              </p>
            </div>
            <button
              type="button"
              onClick={loadDemo}
              className="btn-compact btn-ghost mt-auto self-start"
            >
              Load demo
            </button>
          </div>
        </div>
      </section>

      {/* ── Feature highlights — 4 small inline cards, no dividers ────────
         Whitespace separates — no hairlines. Tiny 16px Phosphor icon +
         label + 1-line description. */}
      <section className="px-4 sm:px-6 lg:px-8 mt-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex flex-col gap-1.5">
              <f.icon size={16} weight="duotone" className="text-accent" />
              <div>
                <div className="text-sm font-medium tracking-display">{f.label}</div>
                <div className="mt-0.5 text-xs text-muted-fg">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Library list ───────────────────────────────────────────────────
         .section-header with eyebrow + count, then single-column compact
         rows. Each row: type icon tile (size-9, neutral) + title + RQ +
         tiny badges + date + ghost delete button (visible on hover). */}
      <section id="recent-saved" className="px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="section-header">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">Your library</span>
              {saved && saved.length > 0 && (
                <span className="text-xs tabular text-meta">
                  {saved.length} saved
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : saved && saved.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 enter-pop">
              {saved.map((r, idx) => {
                const Icon = TYPE_ICONS[r.type] ?? FileText;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(r.id);
                      }
                    }}
                    className={`bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-lg flex cursor-pointer items-center gap-3 p-3 group${
                      idx < 4 ? " stagger-item" : ""
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-hover text-fg-2">
                      <Icon size={16} weight="duotone" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-md font-medium">{r.title}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-fg">
                        {r.researchQuestion || "No research question"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="badge-tiny badge-neutral capitalize">
                        {r.type.toLowerCase()}
                      </span>
                      {r.subType && (
                        <span className="badge-tiny badge-neutral capitalize">
                          {r.subType.toLowerCase()}
                        </span>
                      )}
                      <span className="badge-tiny badge-neutral capitalize">
                        {r.phase.replace("_", " ")}
                      </span>
                    </div>
                    <span className="w-[70px] shrink-0 text-right text-xs tabular text-meta">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete review"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r.id);
                      }}
                      className="btn-compact btn-ghost p-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-lg enter-pop flex flex-col items-center justify-center gap-2 border-dashed p-6 text-center">
              <FolderOpen size={24} weight="duotone" className="text-meta" />
              <div className="text-md font-medium">No saved reviews yet</div>
              <div className="text-xs text-muted-fg">Create your first review above.</div>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer — minimal single line ─────────────────────────────────── */}
      <footer className="py-6">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-xs text-meta">
            RevKit · open-source · not affiliated with Cochrane · Next.js + Prisma + Tailwind
          </p>
        </div>
      </footer>

      <NewReviewWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(input) => {
          setWizardOpen(false);
          // Welcome-screen flow only ever creates top-level reviews with
          // subType: null at this entry point — explicit narrowing avoids
          // a cast through `any`.
          onNew({
            title: input.title,
            type: input.type,
            subType: null,
            researchQuestion: input.researchQuestion,
          });
        }}
      />
    </div>
  );
}
