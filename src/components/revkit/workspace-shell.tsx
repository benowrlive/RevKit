"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Settings,
  Save,
  Circle,
  ArrowLeft,
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

const NAV: { id: WorkspaceTab; label: string; icon: React.ElementType; badge?: (r: Review) => React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "studies", label: "Studies", icon: Users, badge: (r) => <span className="ml-auto text-xs">{r.studies.length}</span> },
  { id: "references", label: "References", icon: FileText, badge: (r) => <span className="ml-auto text-xs">{r.references.length}</span> },
  { id: "comparisons", label: "Comparisons & Outcomes", icon: GitCompare, badge: (r) => <span className="ml-auto text-xs">{r.comparisons.length}</span> },
  { id: "rob", label: "Risk of Bias", icon: ShieldCheck, badge: (r) => <span className="ml-auto text-xs">{r.robAssessments.length}</span> },
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
  const updateMeta = useReviewStore((s) => s.updateMeta);
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
      <div className="min-h-screen flex items-center justify-center">
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
        const parsed = ls ? (JSON.parse(ls) as { id: string; title: string; type: string; savedAt: string }[]) : [];
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
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Top bar */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" onClick={onExit} className="shrink-0">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Library</span>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isDirty && (
                  <Circle className="size-2 fill-emerald-500 text-emerald-500" aria-label="unsaved changes" />
                )}
                <h1 className="font-semibold text-sm sm:text-base truncate">{review.title}</h1>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                {reviewTypeMeta && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{reviewTypeMeta.label}</Badge>}
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">
                  {review.phase.replace("_", " ")}
                </Badge>
                {dbId && (
                  <span className="hidden sm:inline text-[10px]">
                    · saved {new Date(review.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              <span className="hidden sm:inline">{isSaving ? "Saving…" : "Save"}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-14 sm:w-56 border-r bg-background shrink-0 overflow-y-auto">
          <nav className="p-2 space-y-1">
            {NAV.map((item) => {
              const isActive = active === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-2 px-2 sm:px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  title={item.label}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden sm:inline truncate">{item.label}</span>
                  {review && (
                    <span className="hidden sm:inline">{item.badge?.(review)}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <Separator className="my-2" />
          <div className="p-2 space-y-2 text-[10px] text-muted-foreground hidden sm:block">
            <div>
              <span className="font-medium">App version:</span> 0.1.0
            </div>
            <div>
              <span className="font-medium">File format:</span> revkit-1
            </div>
            <div>
              <span className="font-medium">Review ID:</span> {review.id.slice(0, 12)}…
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="p-4 sm:p-6 max-w-6xl mx-auto"
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review metadata, phase tracking, and progress summary.
        </p>
      </div>

      {/* Phase stepper */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Phase</h3>
          <Badge className="capitalize bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {review.phase.replace("_", " ")}
          </Badge>
        </div>
        <Progress value={pct} className="h-2 mb-3" />
        <div className="flex flex-wrap gap-2">
          {REVIEW_PHASES.map((p, i) => {
            const isCurrent = p.value === review.phase;
            const isDone = i < phaseIdx;
            return (
              <button
                key={p.value}
                onClick={() => setPhase(p.value as ReviewPhase)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                  isCurrent
                    ? "bg-emerald-600 text-white"
                    : isDone
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
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
      </Card>

      {/* Editable fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 space-y-2">
          <Label htmlFor="ov-title" className="text-xs text-muted-foreground uppercase tracking-widest">
            Review title
          </Label>
          <Input
            key={titleKey}
            id="ov-title"
            defaultValue={review.title}
            onBlur={(e) => {
              if (e.target.value.trim() !== review.title) updateMeta({ title: e.target.value.trim() });
            }}
            className="text-base font-medium"
          />
        </Card>
        <Card className="p-5 space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-widest">
            Review type (read-only)
          </Label>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{reviewTypeMeta?.label ?? review.type}</Badge>
            {review.subType && (
              <Badge variant="outline">{REVIEW_SUBTYPES.find((s) => s.value === review.subType)?.label}</Badge>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5 space-y-2">
        <Label htmlFor="ov-rq" className="text-xs text-muted-foreground uppercase tracking-widest">
          Research question (PICO / PECO / PICTO)
        </Label>
        <Textarea
          key={rqKey}
          id="ov-rq"
          defaultValue={review.researchQuestion ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (review.researchQuestion ?? "")) updateMeta({ researchQuestion: e.target.value });
          }}
          rows={3}
          placeholder="e.g. In adults with acute sinusitis, do systemic corticosteroids improve symptom resolution compared to placebo?"
        />
        <p className="text-xs text-muted-foreground">
          A clear PICO question helps guide your screening criteria and analysis plan.
        </p>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-600">{studyCount}</div>
          <div className="text-xs text-muted-foreground">Studies</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-600">{includedRef}</div>
          <div className="text-xs text-muted-foreground">Refs included</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-600">{outcomeCount}</div>
          <div className="text-xs text-muted-foreground">Outcomes</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-600">{cmpCount}</div>
          <div className="text-xs text-muted-foreground">Comparisons</div>
        </Card>
      </div>

      {/* References summary */}
      {refCount > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Reference screening status</h3>
          <div className="space-y-2">
            <RefBar label="Included" count={includedRef} total={refCount} color="bg-emerald-500" />
            <RefBar label="Pending / Maybe" count={maybeRef} total={refCount} color="bg-amber-500" />
            <RefBar label="Excluded" count={excludedRef} total={refCount} color="bg-rose-500" />
            <RefBar
              label="Not screened"
              count={refCount - includedRef - maybeRef - excludedRef}
              total={refCount}
              color="bg-muted-foreground"
            />
          </div>
        </Card>
      )}

      {/* Quick action: load demo data */}
      <DemoDataLoader />
    </div>
  );
}

function RefBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count} / {total}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
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
    <Card className="p-5 border-dashed bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
      <div className="flex items-start gap-3">
        <FilePlus2 className="size-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Quick start: load sample data</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add a sample comparison, 5 studies with dichotomous data, and see a real meta-analysis forest plot
            rendered. Replace the data with your own any time.
          </p>
          <Button
            size="sm"
            className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
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
            <FilePlus2 className="size-4 mr-1" />
            Load sample intervention data
          </Button>
        </div>
      </div>
    </Card>
  );
}
