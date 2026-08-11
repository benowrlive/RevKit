"use client";

// src/components/revkit/welcome-screen.tsx
//
// Apple-design-language Welcome screen.
//
// Design principles applied (per skills/design/design-systems/brand-inspiration/
// apple/DESIGN.md + tokens.css):
//
//   • Pure white hero canvas (no gradient) — Apple's billboard chapter is white.
//   • SF Pro Display headings with -0.015em tracking; 17px body baseline.
//   • Single Apple Action Blue accent (#0071e3) reserved for the primary CTA
//     card's icon tile, the hero pill, the eyebrow labels, and the saved-review
//     list tile. Secondary cards walk down to neutral text-fg-2.
//   • 18px card radius (Apple --radius-lg); 980px capsule CTA (--radius-pill).
//   • Restraint: no shadow on chrome by default — `card-apple` lifts the
//     0_12px_32px_rgba(0,0,0,0.08) raised shadow ONLY on hover.
//   • Motion: cubic-bezier(0.28, 0, 0.22, 1) — `.transition-apple` everywhere.
//   • Focus halo: `.focus-halo` (4px blue glow ring) on every interactive
//     element.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilePlus2,
  FolderOpen,
  Trash2,
  Activity,
  Microscope,
  FlaskConical,
  Layers,
  Settings2,
  ArrowRight,
  BarChart3,
  ShieldCheck,
  FileText,
  BookOpen,
} from "lucide-react";
import { RevKitLogo } from "@/components/revkit/icons";
import { NewReviewWizard } from "@/components/revkit/new-review-wizard";
import type { ReviewType } from "@/lib/types";
import { removeRecentFile } from "@/lib/project/id";

interface Props {
  onNew: (input: { title: string; type: ReviewType; subType: null; researchQuestion: string }) => void;
  onOpen: (id: string) => void;
  refreshKey: number;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  INTERVENTION: Activity,
  DTA: Microscope,
  METHODOLOGY: FlaskConical,
  OVERVIEW: Layers,
  FLEXIBLE: Settings2,
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
  { icon: BarChart3, label: "Meta-analysis engine", desc: "MH · Peto · IV · DL" },
  { icon: ShieldCheck, label: "Risk of bias", desc: "RoB 2 · ROBINS-I · QUADAS-2" },
  { icon: Layers, label: "PRISMA 2020", desc: "11-box flow editor" },
  { icon: FileText, label: "Exports", desc: "Word · CSV · PNG · SVG" },
] as const;

export function WelcomeScreen({ onNew, onOpen, refreshKey }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saved, setSaved] = useState<SavedReviewMeta[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    // Initial loading flag is already true; we only flip it after fetch settles.
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Slim sticky Apple-style header ──────────────────────────────────
         Hairline border-soft (not the heavier --border) so the chrome recedes
         against the white hero canvas. Backdrop blur keeps content legible
         under scroll. */}
      <header className="border-b border-border-soft bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RevKitLogo className="size-7" />
            <div>
              <div className="text-base font-semibold leading-none tracking-display">
                RevKit
              </div>
              <div className="text-[11px] text-meta uppercase tracking-[0.08em] mt-1">
                Modern RevMan clone
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-meta uppercase tracking-[0.08em] hidden sm:inline">
              v0.1.0 · MIT
            </span>
            <a
              href="https://www.cochrane.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-link hidden md:inline-flex items-center gap-1.5 focus-halo rounded-md transition-apple"
            >
              <BookOpen className="size-3.5" />
              Cochrane handbook
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero — Apple billboard ──────────────────────────────────────────
         Pure white canvas, py-20/md:py-32 (~Apple --section-y-desktop: 100px).
         Centered max-w-3xl column with eyebrow → 5xl/6xl display head → lead →
         primary + secondary capsule CTAs. */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.28, 0, 0.22, 1] }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="eyebrow mb-5">
            Open-Source · Cochrane-Style Systematic Reviews
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-display leading-[1.07] mb-6">
            Build systematic reviews
            <br className="hidden sm:block" /> with statistical rigor.
          </h1>
          <p className="text-xl text-fg-2 tracking-body leading-relaxed max-w-2xl mx-auto mb-10">
            RevKit supports all five Cochrane review types — Intervention, DTA,
            Methodology, Overview, and Flexible — with meta-analysis, risk-of-bias,
            PRISMA flow, and Word export. All in your browser.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="btn-pill focus-halo transition-apple"
            >
              <FilePlus2 className="size-4" />
              Create new review
            </button>
            <button
              type="button"
              onClick={scrollToLibrary}
              className="btn-pill btn-pill-secondary focus-halo transition-apple"
            >
              Browse library
              <ArrowRight className="size-4" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Action cards row — Apple tile cards ─────────────────────────────
         Three .card-apple tiles at p-8, hover -translate-y-0.5 + raised
         shadow. Apple Action Blue accent ONLY on the primary CTA card; the
         Open and Demo tiles walk down to text-fg-2 on a --surface-apple
         background so the eye stays on the blue action. */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16 md:pb-20">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-4">
          {/* Primary CTA — New Review */}
          <div className="card-apple p-8 hover:-translate-y-0.5 transition-apple-slow flex flex-col">
            <div className="eyebrow mb-4">Recommended</div>
            <div className="size-11 rounded-lg bg-[#0071e3] text-white flex items-center justify-center mb-5">
              <FilePlus2 className="size-5" />
            </div>
            <h3 className="text-xl font-semibold tracking-display mb-2">New Review</h3>
            <p className="text-sm text-fg-2 tracking-body leading-relaxed mb-6 line-clamp-2">
              Start a new systematic review with the 4-step wizard.
            </p>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="btn-pill focus-halo w-full transition-apple mt-auto"
            >
              <FilePlus2 className="size-4" />
              Create new review
            </button>
          </div>

          {/* Open Saved Review */}
          <div className="card-apple p-8 hover:-translate-y-0.5 transition-apple-slow flex flex-col">
            <div className="eyebrow mb-4 text-meta">Your library</div>
            <div className="size-11 rounded-lg bg-surface-apple text-fg-2 flex items-center justify-center mb-5">
              <FolderOpen className="size-5" />
            </div>
            <h3 className="text-xl font-semibold tracking-display mb-2">Open Saved Review</h3>
            <p className="text-sm text-fg-2 tracking-body leading-relaxed mb-6 line-clamp-2">
              Pick a review from your library below.
            </p>
            <button
              type="button"
              onClick={scrollToLibrary}
              className="btn-pill btn-pill-secondary focus-halo w-full transition-apple mt-auto"
            >
              Browse library
              <ArrowRight className="size-4" />
            </button>
          </div>

          {/* Demo */}
          <div className="card-apple p-8 hover:-translate-y-0.5 transition-apple-slow flex flex-col">
            <div className="eyebrow mb-4 text-meta">Demo</div>
            <div className="size-11 rounded-lg bg-surface-apple text-fg-2 flex items-center justify-center mb-5">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="text-xl font-semibold tracking-display mb-2">Try a demo review</h3>
            <p className="text-sm text-fg-2 tracking-body leading-relaxed mb-6 line-clamp-2">
              See an intervention meta-analysis with sample data pre-loaded.
            </p>
            <button
              type="button"
              onClick={loadDemo}
              className="btn-pill btn-pill-secondary focus-halo w-full transition-apple mt-auto"
            >
              Load demo review
            </button>
          </div>
        </div>
      </section>

      {/* ── Feature highlights — Apple spec strip ───────────────────────────
         Four small inline cards on the --surface-warm band. No dividers —
         Apple's strip relies on whitespace, not hairlines. Each tile is just
         a 32px icon chip + label + 1-line description. */}
      <section className="band-warm py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex flex-col gap-3">
                <div className="size-8 rounded-md bg-surface-apple text-fg-2 flex items-center justify-center">
                  <f.icon className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-medium tracking-display">{f.label}</div>
                  <div className="text-xs text-meta tracking-body mt-1">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Saved reviews library ──────────────────────────────────────────
         Eyebrow header + count, then a 2-up grid of .card-apple review tiles.
         Each tile carries a size-12 Apple-blue tinted left tile with the
         review-type icon; on hover the tile fills solid blue and the whole
         card lifts with a raised shadow. Delete button is invisible until
         hover (or keyboard focus-visible). */}
      <section id="recent-saved" className="px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="eyebrow">Your Review Library</div>
            {saved && saved.length > 0 && (
              <span className="text-xs text-meta tracking-body">{saved.length} saved</span>
            )}
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : saved && saved.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {saved.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? FilePlus2;
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
                    className="card-apple p-5 hover:-translate-y-0.5 transition-apple-slow cursor-pointer group focus-halo"
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-lg bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0 transition-apple group-hover:bg-[#0071e3] group-hover:text-white">
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium tracking-display truncate">
                          {r.title}
                        </h3>
                        <p className="text-xs text-fg-2 tracking-body truncate mt-1">
                          {r.researchQuestion || "No research question"}
                        </p>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {r.type.toLowerCase()}
                          </Badge>
                          {r.subType && (
                            <Badge variant="secondary" className="text-[10px]">
                              {r.subType.toLowerCase()}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {r.phase.replace("_", " ")}
                          </Badge>
                          <span className="text-[10px] text-meta ml-auto">
                            {new Date(r.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Delete review"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(r.id);
                        }}
                        className="text-meta hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-halo rounded-md p-1.5 transition-apple"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <FolderOpen className="size-10 mx-auto text-meta mb-5" />
              <h3 className="text-base font-medium tracking-display mb-1">
                No saved reviews yet
              </h3>
              <p className="text-sm text-fg-2 tracking-body mb-6 max-w-sm mx-auto">
                Create your first review using the wizard above, and it&apos;ll appear here.
              </p>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="btn-pill btn-pill-secondary focus-halo transition-apple"
              >
                <FilePlus2 className="size-4" />
                Create new review
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer — Apple's minimal hairline-top line ───────────────────────
         Single centered line of text-meta text, pt-20, hairline border-t.
         No logo, no social, no decorative elements. */}
      <footer className="pt-20 pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-border pt-8 text-center">
            <p className="text-xs text-meta tracking-body">
              RevKit is an independent open-source project. Not affiliated with Cochrane.
              Built on Next.js 16 + Prisma 6 + Tailwind 4 + shadcn/ui.
            </p>
          </div>
        </div>
      </footer>

      <NewReviewWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(input) => {
          setWizardOpen(false);
          // The welcome-screen flow only ever creates top-level reviews —
          // subType is always null at this entry point. We explicitly narrow
          // here so the parent's `subType: null` prop type is satisfied
          // without any cast through `any`.
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
