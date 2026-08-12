"use client";

// src/components/revkit/welcome-screen.tsx
//
// RevKit home page — hero + feature cards + library.
//
// Design language:
//   • Dark-first, teal/blue accents from the RevKit logo palette.
//   • Glassmorphism cards (backdrop-blur + translucent surfaces).
//   • Hero: icon + "RevKit" wordmark with gradient, eyebrow pill, subtitle, CTAs.
//   • 3 feature cards: icon tile + title + description + action link.
//   • Library list: compact glass rows with hover-reveal delete.
//   • Footer: single line, centered, muted.

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
  CaretRight,
  Lock,
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
  { icon: ChartBar, label: "Meta-analysis", desc: "MH · Peto · IV · DL pooling" },
  { icon: ShieldCheck, label: "Risk of bias", desc: "RoB 2 · ROBINS-I · QUADAS-2" },
  { icon: Stack, label: "PRISMA 2020", desc: "11-box flow diagram" },
  { icon: Export, label: "Exports", desc: "Word · CSV · PNG · SVG" },
] as const;

export function WelcomeScreen({ onNew, onOpen, refreshKey }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saved, setSaved] = useState<SavedReviewMeta[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
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
      {/* ── Sticky top bar ─────────────────────────────────────────────── */}
      <header className="bg-surface backdrop-blur-xl backdrop-saturate-150 border-b border-border sticky top-0 z-10 h-11">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="text-md font-semibold tracking-display">RevKit</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs uppercase tracking-[0.04em] text-meta sm:inline">
              v0.1.0 · MIT
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Hero — icon + wordmark + eyebrow + subtitle + CTAs ─────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-4xl enter-pop flex flex-col items-center text-center">

          {/* Eyebrow pill */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-subtle/50 px-4 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
              Systematic Reviews · Meta-Analysis · Evidence Synthesis
            </span>
          </div>

          {/* Logo icon + wordmark */}
          <div className="flex items-center gap-4 sm:gap-6 mb-4">
            <RevKitLogo className="size-16 sm:size-20 shrink-0" />
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              RevKit
            </h1>
          </div>

          {/* Decorative dots */}
          <div className="flex items-center gap-2 mb-4">
            <span className="size-2 rounded-full bg-primary" />
            <span className="size-2 rounded-full bg-primary/70" />
            <span className="size-2 rounded-full bg-accent/70" />
            <span className="size-2 rounded-full bg-accent" />
          </div>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted-fg font-normal max-w-2xl leading-relaxed">
            Better evidence. Better decisions. Revkit helps you conduct
            systematic reviews, meta-analyses, and build evidence you can trust.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="group relative inline-flex h-10 items-center gap-2 rounded-[10px] px-6 text-[15px] font-semibold tracking-tight transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
                color: "white",
                boxShadow:
                  "0 4px 16px color-mix(in oklab, var(--primary), transparent 55%), 0 0 0 1px color-mix(in oklab, var(--primary), transparent 75%)",
              }}
            >
              <Plus size={18} weight="bold" className="transition-transform group-hover:scale-110" />
              Create new review
            </button>
            <button
              type="button"
              onClick={loadDemo}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border bg-surface px-5 text-[15px] font-medium text-fg-2 transition-all hover:bg-surface-hover hover:border-muted-fg active:scale-[0.98]"
            >
              <Sparkle size={16} weight="fill" className="text-accent" />
              Load demo
            </button>
          </div>
        </div>
      </section>

      {/* ── Feature highlights — 4 inline items ────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 mb-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex flex-col items-center text-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                <f.icon size={18} weight="duotone" />
              </div>
              <div>
                <div className="text-sm font-medium tracking-tight">{f.label}</div>
                <div className="mt-0.5 text-xs text-muted-fg">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 action cards ─────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-3">

          {/* Card 1 — New Review */}
          <div className="stagger-item bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col p-6 sm:p-7">
            <div className="flex size-11 items-center justify-center rounded-lg bg-accent-subtle text-accent mb-4">
              <FileText size={20} weight="duotone" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">New review</h3>
            <p className="mt-2 text-sm text-muted-fg leading-relaxed flex-1">
              Start a new systematic review with the 4-step PICO wizard.
              All 5 Cochrane review types supported.
            </p>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:gap-2 transition-all"
            >
              Create <CaretRight size={14} weight="bold" />
            </button>
          </div>

          {/* Card 2 — Browse library */}
          <div className="stagger-item bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col p-6 sm:p-7">
            <div className="flex size-11 items-center justify-center rounded-lg bg-surface-hover text-fg-2 mb-4">
              <FolderOpen size={20} weight="duotone" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Browse library</h3>
            <p className="mt-2 text-sm text-muted-fg leading-relaxed flex-1">
              Open a saved review from your library. Continue from where
              you left off — all data preserved.
            </p>
            <button
              type="button"
              onClick={scrollToLibrary}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-fg-2 hover:gap-2 transition-all"
            >
              Browse <CaretRight size={14} weight="bold" />
            </button>
          </div>

          {/* Card 3 — Demo */}
          <div className="stagger-item bg-card backdrop-blur-xl backdrop-saturate-150 border border-border rounded-xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col p-6 sm:p-7">
            <div className="flex size-11 items-center justify-center rounded-lg bg-surface-hover text-fg-2 mb-4">
              <Sparkle size={20} weight="duotone" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Try a demo</h3>
            <p className="mt-2 text-sm text-muted-fg leading-relaxed flex-1">
              See an intervention meta-analysis with 5 RCTs pre-loaded.
              Forest plot, heterogeneity, and export included.
            </p>
            <button
              type="button"
              onClick={loadDemo}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-fg-2 hover:gap-2 transition-all"
            >
              Load demo <CaretRight size={14} weight="bold" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Library list ──────────────────────────────────────────────── */}
      <section id="recent-saved" className="px-4 sm:px-6 lg:px-8 py-12">
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

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="py-8 mt-auto">
        <div className="mx-auto max-w-5xl px-4 text-center flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-meta">
            <Lock size={12} />
            <span>Your data stays in your browser. No sign-in required.</span>
          </div>
          <p className="text-xs text-meta">
            RevKit · open-source · MIT · not affiliated with Cochrane
          </p>
        </div>
      </footer>

      <NewReviewWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(input) => {
          setWizardOpen(false);
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
