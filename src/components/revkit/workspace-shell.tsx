"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LayoutDashboard,
  Users,
  FileText,
  GitCompare,
  ShieldCheck,
  Network,
  Download,
  Settings as SettingsIcon,
  Save,
  Circle,
  ArrowLeft,
  Loader2,
  FilePlus2,
  CheckCircle2,
  CircleDot,
  Calculator,
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
import { ThemeToggle } from "@/components/revkit/theme-toggle";
import { UserChip } from "@/components/revkit/user-chip";
import { DtaCalculatorDialog } from "@/components/dta/calculator-dialog";

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

const NAV: { id: WorkspaceTab; label: string; icon: React.ElementType; badge?: (r: Review) => React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "studies", label: "Studies", icon: Users, badge: (r) => <span className="ml-auto text-[11px] tabular text-muted-fg">{r.studies.length}</span> },
  { id: "references", label: "References", icon: FileText, badge: (r) => <span className="ml-auto text-[11px] tabular text-muted-fg">{r.references.length}</span> },
  { id: "comparisons", label: "Comparisons", icon: GitCompare, badge: (r) => <span className="ml-auto text-[11px] tabular text-muted-fg">{r.comparisons.length}</span> },
  { id: "rob", label: "Risk of Bias", icon: ShieldCheck, badge: (r) => <span className="ml-auto text-[11px] tabular text-muted-fg">{r.robAssessments.length}</span> },
  { id: "prisma", label: "PRISMA Flow", icon: Network },
  { id: "export", label: "Export", icon: Download },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function WorkspaceShell({ active, onTabChange, onExit, children }: Props) {
  const review = useReviewStore((s) => s.review);
  const isDirty = useReviewStore((s) => s.isDirty);
  const isSaving = useReviewStore((s) => s.isSaving);
  const dbId = useReviewStore((s) => s.dbId);
  const setSaving = useReviewStore((s) => s.setSaving);
  const markSaved = useReviewStore((s) => s.markSaved);
  const setRecentFiles = useReviewStore((s) => s.setRecentFiles);

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
      try {
        const ls = localStorage.getItem("revkit:recent-files");
        const parsed = ls ? (JSON.parse(ls) as { id: string; title: string; type: string; savedAt: string }[]) : [];
        setRecentFiles(parsed);
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
      {/* Top bar — compact 44px */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex h-11 items-center justify-between px-3 sm:px-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onExit}
              className="btn-compact btn-ghost h-7 px-2 text-[12px]"
              aria-label="Back to library"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Library</span>
            </button>
            <Separator orientation="vertical" className="h-5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isDirty && (
                  <Circle className="size-1.5 fill-accent text-accent" aria-label="unsaved changes" />
                )}
                <h1 className="font-semibold text-[13px] truncate">{review.title}</h1>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-fg mt-0.5">
                {reviewTypeMeta && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 rounded-sm">
                    {reviewTypeMeta.label}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 rounded-sm capitalize">
                  {review.phase.replace("_", " ")}
                </Badge>
                {dbId && (
                  <span className="hidden md:inline text-[10px] text-meta">
                    saved {new Date(review.updatedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* DTA Calculator — standalone tool, shown only for DTA reviews (spec §9) */}
            {review.type === "DTA" && (
              <DtaCalculatorButton />
            )}
            <UserChip onClick={() => onTabChange("settings")} />
            <ThemeToggle />
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="btn-compact btn-primary h-7 px-3 text-[12px] gap-1.5"
            >
              {isSaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              <span className="hidden sm:inline">{isSaving ? "Saving…" : "Save"}</span>
              <kbd className="hidden md:inline ml-1 text-[9px] text-primary-foreground/60 border border-primary-foreground/20 rounded px-1">
                ⌘S
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      {/* Main: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — 220px, compacts to icons on small screens */}
        <aside className="w-14 sm:w-56 border-r border-border bg-sidebar shrink-0 overflow-y-auto scrollbar-thin">
          <nav className="p-1.5 space-y-0.5">
            {NAV.map((item) => {
              const isActive = active === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  data-active={isActive}
                  className={`btn-compact btn-ghost w-full h-8 px-2 text-[12px] ${
                    isActive ? "" : ""
                  }`}
                  title={item.label}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{item.label}</span>
                  {review && <span className="hidden sm:inline">{item.badge?.(review)}</span>}
                </button>
              );
            })}
          </nav>
          <Separator className="my-1.5 hidden sm:block" />
          <div className="p-2 space-y-1 text-[10px] text-meta hidden sm:block">
            <div className="font-mono tabular">{review.id.slice(0, 12)}…</div>
            <div>revkit-1 · v0.1.0</div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin bg-background">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              className="p-4 sm:p-5 max-w-6xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
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
    <div className="space-y-5">
      <div>
        <div className="eyebrow">OVERVIEW</div>
        <h2 className="text-xl font-semibold tracking-display mt-1">{review.title}</h2>
        <p className="text-xs text-muted-fg mt-1">
          Review metadata, phase tracking, and progress summary.
        </p>
      </div>

      {/* Phase stepper — compact segmented */}
      <Card className="card-compact p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">PHASE</div>
          <Badge className="badge-tiny badge-teal capitalize">{review.phase.replace("_", " ")}</Badge>
        </div>
        <Progress value={pct} className="h-1 mb-3 bg-surface-hover" />
        <div className="flex flex-wrap gap-1.5">
          {REVIEW_PHASES.map((p, i) => {
            const isCurrent = p.value === review.phase;
            const isDone = i < phaseIdx;
            return (
              <button
                key={p.value}
                onClick={() => setPhase(p.value as ReviewPhase)}
                className={`badge-tiny ${isCurrent ? "badge-teal" : isDone ? "badge-success" : "badge-neutral"} cursor-pointer transition-colors`}
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
      </Card>

      {/* KPI tiles — compact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile number={studyCount} label="Studies" />
        <KpiTile number={includedRef} label="Refs included" />
        <KpiTile number={outcomeCount} label="Outcomes" />
        <KpiTile number={cmpCount} label="Comparisons" />
      </div>

      {/* Editable fields */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="card-compact p-4 space-y-2">
          <Label htmlFor="ov-title" className="eyebrow">
            Title
          </Label>
          <Input
            key={titleKey}
            id="ov-title"
            defaultValue={review.title}
            onBlur={(e) => {
              if (e.target.value.trim() !== review.title) updateMeta({ title: e.target.value.trim() });
            }}
            className="input-compact h-8 text-[13px] font-medium"
          />
        </Card>
        <Card className="card-compact p-4 space-y-2">
          <Label className="eyebrow">Type (read-only)</Label>
          <div className="flex items-center gap-2 h-8">
            <Badge className="badge-tiny badge-neutral">{reviewTypeMeta?.label ?? review.type}</Badge>
            {review.subType && (
              <Badge className="badge-tiny badge-neutral">
                {REVIEW_SUBTYPES.find((s) => s.value === review.subType)?.label}
              </Badge>
            )}
          </div>
        </Card>
      </div>

      <Card className="card-compact p-4 space-y-2">
        <Label htmlFor="ov-rq" className="eyebrow">
          Research question (PICO)
        </Label>
        <Textarea
          key={rqKey}
          id="ov-rq"
          defaultValue={review.researchQuestion ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (review.researchQuestion ?? "")) updateMeta({ researchQuestion: e.target.value });
          }}
          rows={2}
          placeholder="e.g. In adults with acute sinusitis, do systemic corticosteroids improve symptom resolution compared to placebo?"
          className="input-compact text-[13px] min-h-[60px]"
        />
      </Card>

      {/* References screening bars */}
      {refCount > 0 && (
        <Card className="card-compact p-4">
          <div className="eyebrow mb-3">SCREENING STATUS</div>
          <div className="space-y-2">
            <RefBar label="Included" count={includedRef} total={refCount} color="bg-[var(--success)]" />
            <RefBar label="Pending / Maybe" count={maybeRef} total={refCount} color="bg-[var(--warning)]" />
            <RefBar label="Excluded" count={excludedRef} total={refCount} color="bg-[var(--destructive)]" />
            <RefBar label="Not screened" count={refCount - includedRef - maybeRef - excludedRef} total={refCount} color="bg-[var(--muted-foreground)]" />
          </div>
        </Card>
      )}

      <DemoDataLoader />
    </div>
  );
}

function KpiTile({ number, label }: { number: number; label: string }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-number">{number}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function RefBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-fg">{label}</span>
        <span className="font-numeric tabular text-fg-2">
          {count} <span className="text-meta">/ {total}</span>
        </span>
      </div>
      <div className="h-1 rounded-full bg-surface-hover overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
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
    <Card className="card-compact border-dashed bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-md bg-accent-subtle text-accent flex items-center justify-center shrink-0">
          <FilePlus2 className="size-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-[13px] font-semibold">Quick start: load sample data</h3>
          <p className="text-[11px] text-muted-fg mt-0.5">
            Add a sample comparison, 5 studies with dichotomous data, and see a real meta-analysis forest plot.
          </p>
          <Button
            size="sm"
            className="btn-compact btn-primary h-7 mt-2 px-2.5 text-[12px]"
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
              toast.success("Sample data loaded", { description: "Aspirin meta-analysis with 5 RCTs" });
            }}
          >
            <FilePlus2 className="size-3.5 mr-1" />
            Load sample intervention data
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── DTA Calculator button (standalone, shown only for DTA reviews) ──────
// Per spec §9: "Available in two places: 1. Standalone — from sidebar of
// any DTA review. 2. Per-study — calculator icon on each DTA data row."
// The per-study button is in DataGrid; this is the standalone one.

function DtaCalculatorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-compact btn-secondary h-7 px-2.5 text-[12px] gap-1.5"
        title="Open DTA 2×2 calculator"
      >
        <Calculator size={14} />
        <span className="hidden sm:inline">Calculator</span>
      </button>
      <DtaCalculatorDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
