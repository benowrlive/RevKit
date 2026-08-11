"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilePlus2,
  FolderOpen,
  Clock,
  Trash2,
  Activity,
  Microscope,
  FlaskConical,
  Layers,
  Settings2,
  ArrowRight,
  Sparkles,
  BookOpen,
  BarChart3,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { RevKitLogo } from "@/components/revkit/icons";
import { NewReviewWizard } from "@/components/revkit/new-review-wizard";
import type { ReviewType } from "@/lib/types";
import { loadRecentFiles, removeRecentFile, type RecentFileEntry } from "@/lib/project/id";

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

export function WelcomeScreen({ onNew, onOpen, refreshKey }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saved, setSaved] = useState<SavedReviewMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<RecentFileEntry[]>(() => loadRecentFiles());

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    // Initial loading flag is already true; we only flip it after fetch settles.
    fetch("/api/reviews", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
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
        setRecent(loadRecentFiles());
      })
      .catch((e) => alert(`Failed to delete: ${e.message}`));
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/30 via-background to-background">
      {/* Hero header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RevKitLogo className="size-8" />
            <div>
              <div className="font-bold text-lg leading-none">RevKit</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Modern RevMan clone
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              v0.1.0 · MIT
            </Badge>
            <a
              href="https://www.cochrane.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground hidden md:inline-flex items-center gap-1"
            >
              <BookOpen className="size-3.5" />
              Cochrane handbook
            </a>
          </div>
        </div>
      </header>

      {/* Main hero */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3 mb-10"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs font-medium">
            <Sparkles className="size-3" />
            Open-source · Cochrane-style systematic reviews in your browser
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Build systematic reviews with{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              statistical rigor
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            RevKit supports all 5 Cochrane review types — Intervention, DTA, Methodology,
            Overview, and Flexible — with meta-analysis, risk-of-bias, PRISMA flow, and Word export.
          </p>
        </motion.div>

        {/* Primary action cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          <Card className="p-6 hover:shadow-lg transition-all border-emerald-200 dark:border-emerald-900/50 group">
            <div className="flex items-start justify-between mb-4">
              <div className="size-10 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
                <FilePlus2 className="size-5" />
              </div>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Recommended
              </span>
            </div>
            <h3 className="font-semibold mb-1">New Review</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Start a new systematic review with the 4-step wizard.
            </p>
            <Button
              onClick={() => setWizardOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white group-hover:scale-[1.02] transition-transform"
            >
              <FilePlus2 className="size-4 mr-1" />
              Create new review
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="size-10 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center">
                <FolderOpen className="size-5" />
              </div>
            </div>
            <h3 className="font-semibold mb-1">Open Saved Review</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Pick a review from your library below.
            </p>
            <Button
              onClick={() => document.getElementById("recent-saved")?.scrollIntoView({ behavior: "smooth" })}
              variant="outline"
              className="w-full"
            >
              Browse library
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="size-10 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center">
                <BarChart3 className="size-5" />
              </div>
            </div>
            <h3 className="font-semibold mb-1">Try a demo review</h3>
            <p className="text-xs text-muted-foreground mb-4">
              See an intervention meta-analysis with sample data pre-loaded.
            </p>
            <Button
              onClick={() => onNew({
                title: "Aspirin for secondary prevention of cardiovascular events (demo)",
                type: "INTERVENTION",
                subType: null,
                researchQuestion:
                  "In adults with prior MI, does aspirin reduce all-cause mortality vs placebo?",
              })}
              variant="outline"
              className="w-full"
            >
              <Sparkles className="size-4 mr-1" />
              Load demo review
            </Button>
          </Card>
        </div>

        {/* Feature highlights */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {[
            { icon: BarChart3, label: "Meta-analysis engine", desc: "MH · Peto · IV · DL" },
            { icon: ShieldCheck, label: "Risk of bias", desc: "RoB 2 · ROBINS-I · QUADAS-2" },
            { icon: Layers, label: "PRISMA 2020", desc: "11-box flow editor" },
            { icon: FileText, label: "Exports", desc: "Word · CSV · PNG · SVG" },
          ].map((f) => (
            <Card key={f.label} className="p-4 flex items-center gap-3">
              <div className="size-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                <f.icon className="size-4" />
              </div>
              <div>
                <div className="text-xs font-medium">{f.label}</div>
                <div className="text-[10px] text-muted-foreground">{f.desc}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Saved reviews */}
        <section id="recent-saved">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="size-4" />
              Your review library
            </h2>
            {saved && saved.length > 0 && (
              <span className="text-xs text-muted-foreground">{saved.length} saved</span>
            )}
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : saved && saved.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {saved.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? FilePlus2;
                return (
                  <Card
                    key={r.id}
                    className="p-4 hover:shadow-md transition-all group cursor-pointer"
                    onClick={() => onOpen(r.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:group-hover:bg-emerald-950 dark:group-hover:text-emerald-300 transition-colors">
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{r.title}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.researchQuestion || "No research question"}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(r.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(r.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 text-center border-dashed">
              <FolderOpen className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No saved reviews yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create your first review using the wizard above, and it'll appear here.
              </p>
            </Card>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>
            RevKit is an independent open-source project. Not affiliated with Cochrane.
            Built on Next.js 16 + Prisma 6 + Tailwind 4 + shadcn/ui.
          </p>
        </footer>
      </main>

      <NewReviewWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={(input) => {
          setWizardOpen(false);
          onNew(input);
        }}
      />
    </div>
  );
}
