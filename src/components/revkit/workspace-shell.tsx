"use client";

import { useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard,
  Users,
  FileText,
  GitCompare,
  ShieldCheck,
  Network,
  Download,
  Settings,
  Save,
  Circle,
  ChevronLeft,
  Loader2,
  FilePlus2,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { useReviewStore } from "@/lib/project/state";
import {
  REVIEW_PHASES,
  REVIEW_TYPES,
  REVIEW_SUBTYPES,
  type ReviewPhase,
  type Review,
} from "@/lib/types";
import { addRecentFile } from "@/lib/project/id";
import { toast } from "sonner";

export type WorkspaceTab =
  | "overview"
  | "studies"
  | "references"
  | "comparisons"
  | "rob"
  | "prisma"
  | "export"
  | "settings";

interface Props {
  active: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  onExit: () => void;
  children: React.ReactNode;
}

const NAV: {
  id: WorkspaceTab;
  label: string;
  icon: React.ElementType;
  badge?: (r: Review) => React.ReactNode;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  {
    id: "studies",
    label: "Studies",
    icon: Users,
    badge: (r) => (
      <span className="ml-auto text-[11px] text-meta font-medium">{r.studies.length}</span>
    ),
  },
  {
    id: "references",
    label: "References",
    icon: FileText,
    badge: (r) => (
      <span className="ml-auto text-[11px] text-meta font-medium">{r.references.length}</span>
    ),
  },
  {
    id: "comparisons",
    label: "Comparisons & Outcomes",
    icon: GitCompare,
    badge: (r) => (
      <span className="ml-auto text-[11px] text-meta font-medium">{r.comparisons.length}</span>
    ),
  },
  {
    id: "rob",
    label: "Risk of Bias",
    icon: ShieldCheck,
    badge: (r) => (
      <span className="ml-auto text-[11px] text-meta font-medium">{r.robAssessments.length}</span>
    ),
  },
  { id: "prisma", label: "PRISMA Flow", icon: Network },
  { id: "export", label: "Export", icon: Download },
  { id: "settings", label: "Settings", icon: Settings },
];

export function WorkspaceShell({ active, onTabChange, onExit, children }: Props) {
  const review = useReviewStore((s) => s.review);
  const isDirty = useReviewStore((s) => s.isDirty);
  const isSaving = useReviewStore((s) => s.isSaving);
  const dbId = useReviewStore((s) => s.dbId);
  const setSaving = useReviewStore((s) => s.setSaving);
  const markSaved = useReviewStore((s) => s.markSaved);
  const setRecentFiles = useReviewStore((s) => s.setRecentFiles);

  // Beforeunload handler for unsaved changes
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  const reviewTypeMeta = REVIEW_TYPES.find((t) => t.value === review.type);

  async function handleSave() {
    const current = useReviewStore.getState().review;
    if (!current) return;
    setSaving(true);
    try {
      const method = dbId ? "PUT" : "POST";
      const url = dbId ? `/api/reviews?id=${dbId}` : "/api/reviews";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: current }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { review: { id: string; updatedAt: string } };
      markSaved(data.review.id);
      addRecentFile({
        id: data.review.id,
        title: current.title,
        type: current.type,
        savedAt: new Date().toISOString(),
      });
      setRecentFiles([]);
      // reload recent files in background
      try {
        const recent = await fetch("/api/reviews").then((r) => r.json());
        // localStorage mirror:
        const ls = localStorage.getItem("revkit:recent-files");
        const parsed = ls
          ? (JSON.parse(ls) as { id: string; title: string; type: string; savedAt: string }[])
          : [];
        setRecentFiles(parsed);
        void recent;
      } catch {
        // ignore
      }
      toast.success("Review saved", { description: current.title });
    } catch (e) {
      toast.error("Save failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ───────── Top bar — Apple frosted-glass toolbar ───────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onExit}
              className="btn-press shrink-0 inline-flex items-center gap-0.5 text-fg-2 hover:text-foreground transition-apple focus-halo rounded-md px-2 py-1 -ml-2"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline text-[14px]">Library</span>
            </button>
            <Separator orientation="vertical" className="h-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-semibold tracking-display text-base truncate">
                  {review.title}
                </h1>
                {isDirty && (
                  <span
                    className="size-1.5 rounded-full bg-[#0071e3] shrink-0"
                    aria-label="unsaved changes"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {reviewTypeMeta && (
                  <span className="text-[11px] uppercase tracking-[0.08em] text-meta font-semibold">
                    {reviewTypeMeta.label}
                  </span>
                )}
                <span className="bg-[#0071e3] text-white rounded-full px-2 py-0.5 text-[11px] font-medium capitalize leading-none">
                  {review.phase.replace("_", " ")}
                </span>
                {dbId && (
                  <span className="hidden sm:inline text-[11px] text-meta">
                    · saved {new Date(review.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="btn-pill btn-press px-5 py-2 text-[14px] font-medium focus-halo"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span className="hidden sm:inline">{isSaving ? "Saving…" : "Save"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ───────── Main: sidebar + content ───────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — Apple warm-tinted navigator */}
        <aside className="w-56 bg-surface-warm border-r border-border shrink-0 overflow-y-auto scrollbar-apple py-4">
          <nav className="px-2 space-y-0.5">
            {NAV.map((item) => {
              const isActive = active === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`btn-press w-full flex items-center gap-3 px-4 py-2 rounded-md text-[14px] transition-apple focus-halo ${
                    isActive
                      ? "bg-[#0071e3]/10 text-[#0071e3] font-medium"
                      : "text-fg-2 hover:bg-surface-apple hover:text-foreground"
                  }`}
                  title={item.label}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge?.(review)}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 px-4 space-y-1.5 text-[11px] text-meta">
            <div>
              <span className="font-medium text-fg-2">App version:</span> 0.1.0
            </div>
            <div>
              <span className="font-medium text-fg-2">File format:</span> revkit-1
            </div>
            <div className="truncate">
              <span className="font-medium text-fg-2">Review ID:</span>{" "}
              <span className="font-mono">{review.id.slice(0, 12)}…</span>
            </div>
          </div>
        </aside>

        {/* Main content — Apple reading measure.
            Tab transitions use CSS-only .enter-pop (220ms scale(0.96)→1 +
            opacity 0→1, ease-out) keyed off `active` so each tab switch remounts
            the panel and replays the entrance. Per Emil's "Use CSS transitions
            over keyframes for interruptible UI." No framer-motion = off main
            thread. */}
        <main className="flex-1 overflow-y-auto scrollbar-apple bg-background">
          <div
            key={active}
            className="enter-pop p-6 md:p-10 max-w-5xl mx-auto"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Reusable Overview page component
export function OverviewPage() {
  const review = useReviewStore((s) => s.review);
  const updateMeta = useReviewStore((s) => s.updateMeta);
  const setPhase = useReviewStore((s) => s.setPhase);

  if (!review) return null;

  return <OverviewBody review={review} updateMeta={updateMeta} setPhase={setPhase} />;
}

function OverviewBody({
  review,
  updateMeta,
  setPhase,
}: {
  review: NonNullable<ReturnType<typeof useReviewStore.getState>["review"]>;
  updateMeta: ReturnType<typeof useReviewStore.getState>["updateMeta"];
  setPhase: ReturnType<typeof useReviewStore.getState>["setPhase"];
}) {
  // Re-key the inputs on review.id switch to reset state cleanly
  const titleKey = `${review.id}-title`;
  const rqKey = `${review.id}-rq`;

  const reviewTypeMeta = REVIEW_TYPES.find((t) => t.value === review.type);
  const phaseIdx = REVIEW_PHASES.findIndex((p) => p.value === review.phase);
  const pct = (phaseIdx / (REVIEW_PHASES.length - 1)) * 100;

  const studyCount = review.studies.length;
  const refCount = review.references.length;
  const includedRef = review.references.filter((r) => r.decision === "INCLUDE").length;
  const excludedRef = review.references.filter((r) => r.decision === "EXCLUDE").length;
  const maybeRef = review.references.filter((r) => r.decision === "MAYBE").length;
  const cmpCount = review.comparisons.length;
  const outcomeCount = review.comparisons.reduce((acc, c) => acc + c.outcomes.length, 0);

  return (
    <div className="space-y-8">
      {/* ───── Page header — Apple eyebrow + display headline + subhead ───── */}
      <header>
        <p className="text-[11px] uppercase tracking-[0.08em] text-[#0071e3] font-semibold">
          Overview
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-display mt-2">
          {review.title || "Untitled review"}
        </h1>
        <p className="text-base text-fg-2 mt-2">
          Review metadata, phase tracking, and progress summary.
        </p>
      </header>

      {/* ───── Phase stepper — Apple segmented control ───── */}
      <section className="card-apple p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] uppercase tracking-[0.08em] text-meta font-semibold">
            Phase
          </h3>
          <span className="bg-[#0071e3] text-white rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize leading-none">
            {review.phase.replace("_", " ")}
          </span>
        </div>
        <div className="h-1 bg-surface-apple rounded-full overflow-hidden mb-4">
          <div
            className="bg-[#0071e3] h-full transition-apple-slow"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {REVIEW_PHASES.map((p, i) => {
            const isCurrent = p.value === review.phase;
            const isDone = i < phaseIdx;
            return (
              <button
                key={p.value}
                onClick={() => setPhase(p.value as ReviewPhase)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-apple focus-halo ${
                  isCurrent
                    ? "bg-[#0071e3] text-white"
                    : isDone
                    ? "bg-[#0071e3]/10 text-[#0071e3]"
                    : "bg-surface-apple text-meta hover:bg-surface-apple/70 hover:text-fg-2"
                }`}
                title={isCurrent ? "Current phase" : isDone ? "Completed phase" : "Not started"}
              >
                {isDone ? (
                  <CheckCircle2 className="size-3" />
                ) : isCurrent ? (
                  <CircleDot className="size-3" />
                ) : (
                  <Circle className="size-3" />
                )}
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ───── Editable fields — Apple form rows ───── */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="card-apple p-6 space-y-2">
          <Label
            htmlFor="ov-title"
            className="text-[11px] uppercase tracking-[0.08em] text-meta font-semibold"
          >
            Review title
          </Label>
          <input
            key={titleKey}
            id="ov-title"
            defaultValue={review.title}
            onBlur={(e) => {
              if (e.target.value.trim() !== review.title)
                updateMeta({ title: e.target.value.trim() });
            }}
            className="field-apple font-medium"
          />
        </div>
        <div className="card-apple p-6 space-y-2">
          <Label className="text-[11px] uppercase tracking-[0.08em] text-meta font-semibold">
            Review type (read-only)
          </Label>
          <div className="flex items-center gap-2 pt-1">
            <span className="inline-flex items-center rounded-md bg-surface-apple px-2.5 py-1 text-sm font-medium text-fg-2">
              {reviewTypeMeta?.label ?? review.type}
            </span>
            {review.subType && (
              <span className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-sm text-fg-2">
                {REVIEW_SUBTYPES.find((s) => s.value === review.subType)?.label}
              </span>
            )}
          </div>
        </div>
      </div>

      <section className="card-apple p-6 space-y-2">
        <Label
          htmlFor="ov-rq"
          className="text-[11px] uppercase tracking-[0.08em] text-meta font-semibold"
        >
          Research question (PICO / PECO / PICTO)
        </Label>
        <textarea
          key={rqKey}
          id="ov-rq"
          defaultValue={review.researchQuestion ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (review.researchQuestion ?? ""))
              updateMeta({ researchQuestion: e.target.value });
          }}
          rows={3}
          placeholder="e.g. In adults with acute sinusitis, do systemic corticosteroids improve symptom resolution compared to placebo?"
          className="field-apple min-h-[88px] resize-y"
        />
        <p className="text-xs text-meta">
          A clear PICO question helps guide your screening criteria and analysis plan.
        </p>
      </section>

      {/* ───── Quick stats — Apple KPI tiles ───── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <div className="card-apple p-5">
          <div className="font-display text-4xl font-semibold text-[#0071e3] tracking-display">
            {studyCount}
          </div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-meta mt-2">Studies</div>
        </div>
        <div className="card-apple p-5">
          <div className="font-display text-4xl font-semibold text-[#0071e3] tracking-display">
            {includedRef}
          </div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-meta mt-2">
            Refs included
          </div>
        </div>
        <div className="card-apple p-5">
          <div className="font-display text-4xl font-semibold text-[#0071e3] tracking-display">
            {outcomeCount}
          </div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-meta mt-2">Outcomes</div>
        </div>
        <div className="card-apple p-5">
          <div className="font-display text-4xl font-semibold text-[#0071e3] tracking-display">
            {cmpCount}
          </div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-meta mt-2">Comparisons</div>
        </div>
      </div>

      {/* ───── Reference screening status ───── */}
      {refCount > 0 && (
        <section className="card-apple p-6">
          <h3 className="text-[11px] uppercase tracking-[0.08em] text-meta font-semibold mb-4">
            Reference screening status
          </h3>
          <div className="space-y-3">
            <RefBar label="Included" count={includedRef} total={refCount} color="bg-[#16a34a]" />
            <RefBar
              label="Pending / Maybe"
              count={maybeRef}
              total={refCount}
              color="bg-[#eab308]"
            />
            <RefBar label="Excluded" count={excludedRef} total={refCount} color="bg-[#dc2626]" />
            <RefBar
              label="Not screened"
              count={refCount - includedRef - maybeRef - excludedRef}
              total={refCount}
              color="bg-[#86868b]"
            />
          </div>
        </section>
      )}

      {/* ───── Demo data loader ───── */}
      <DemoDataLoader />
    </div>
  );
}

function RefBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-fg-2">{label}</span>
        <span className="font-medium text-meta">
          {count} / {total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-apple overflow-hidden">
        <div
          className={`h-full ${color} transition-apple-slow`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DemoDataLoader() {
  const review = useReviewStore((s) => s.review);
  const addComparison = useReviewStore((s) => s.addComparison);
  const addOutcome = useReviewStore((s) => s.addOutcome);
  const addStudy = useReviewStore((s) => s.addStudy);
  const upsertDataPoint = useReviewStore((s) => s.upsertDataPoint);
  const markDirty = useReviewStore((s) => s.markDirty);

  if (!review) return null;
  if (review.comparisons.length > 0 || review.studies.length > 0) return null;

  return (
    <div className="card-apple border-dashed bg-surface-warm p-6">
      <div className="flex items-start gap-4">
        <div className="size-10 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shrink-0">
          <FilePlus2 className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-semibold">Quick start: load sample data</h3>
          <p className="text-sm text-fg-2 mt-1">
            Add a sample comparison, 5 studies with dichotomous data, and see a real meta-analysis
            forest plot rendered. Replace the data with your own any time.
          </p>
          <button
            className="btn-pill px-4 py-1.5 text-[13px] mt-4 focus-halo"
            onClick={() => {
              const cmpId = addComparison("Aspirin vs placebo");
              const outId = addOutcome(cmpId, {
                name: "All-cause mortality",
                dataType: "DICHOTOMOUS",
                effectMeasure: "OR",
                method: "MH",
                model: "fixed",
                unit: null,
                timeFrame: "≥ 6 months follow-up",
              });
              const studies = [
                { label: "Elwood 1974", events1: 18, total1: 615, events2: 22, total2: 624 },
                { label: "CDPA 1976", events1: 7, total1: 758, events2: 10, total2: 771 },
                { label: "Elwood 1979", events1: 49, total1: 832, events2: 49, total2: 850 },
                { label: "AMIS 1980", events1: 237, total1: 2267, events2: 220, total2: 2257 },
                { label: "Peto 1988 (ISIS-2)", events1: 110, total1: 8587, events2: 175, total2: 8600 },
              ];
              const studyIds: string[] = [];
              for (const s of studies) {
                const sid = addStudy({
                  label: s.label,
                  year: parseInt(s.label.match(/\d{4}/)?.[0] ?? "2000"),
                  authors: s.label,
                  doi: null,
                  pdfPath: null,
                  status: "included",
                  excludeReason: null,
                  design: "RCT — parallel",
                  picos: null,
                  indexTest: null,
                  referenceStandard: null,
                  notes: "Sample data",
                });
                studyIds.push(sid);
              }
              studies.forEach((s, i) => {
                upsertDataPoint(outId, null, studyIds[i], {
                  events1: s.events1,
                  total1: s.total1,
                  events2: s.events2,
                  total2: s.total2,
                });
              });
              markDirty();
              toast.success("Sample data loaded", {
                description: "Aspirin meta-analysis with 5 RCTs",
              });
            }}
          >
            <FilePlus2 className="size-4" />
            Load sample intervention data
          </button>
        </div>
      </div>
    </div>
  );
}
