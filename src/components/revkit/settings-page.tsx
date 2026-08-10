"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Database,
  FileText,
  Trash2,
  Info,
  HardDrive,
  Clock,
  Shield,
  Github,
  ExternalLink,
  Users,
  GitCompare,
  BarChart3,
} from "lucide-react";
import { useReviewStore } from "@/lib/project/state";
import { REVIEW_TYPES, type ReviewPhase, REVIEW_PHASES } from "@/lib/types";
import { loadRecentFiles, removeRecentFile } from "@/lib/project/id";
import { useState } from "react";
import { toast } from "sonner";

export function SettingsPage() {
  const review = useReviewStore((s) => s.review);
  const updateMeta = useReviewStore((s) => s.updateMeta);
  const setRecentFiles = useReviewStore((s) => s.setRecentFiles);

  const [clearing, setClearing] = useState(false);

  if (!review) return null;

  const reviewTypeMeta = REVIEW_TYPES.find((t) => t.value === review.type);
  const stats = {
    comparisons: review.comparisons.length,
    outcomes: review.comparisons.reduce((a, c) => a + c.outcomes.length, 0),
    dataPoints: review.comparisons.reduce(
      (a, c) => a + c.outcomes.reduce((b, o) => b + o.dataPoints.length + o.subgroups.reduce((d, sg) => d + sg.dataPoints.length, 0), 0),
      0
    ),
    studies: review.studies.length,
    references: review.references.length,
    robAssessments: review.robAssessments.length,
  };

  const approxSize = JSON.stringify(review).length;

  async function clearAllRecent() {
    if (!confirm("Clear all recent files from local storage? Saved reviews on the server are not affected.")) return;
    setClearing(true);
    try {
      const all = loadRecentFiles();
      for (const r of all) removeRecentFile(r.id);
      setRecentFiles([]);
      toast.success("Recent files cleared");
    } catch (e) {
      toast.error("Failed to clear recent files", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="size-6" />
          Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review metadata, app info, and local data management.
        </p>
      </div>

      {/* Review metadata */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Review metadata</h3>
          <Badge variant="outline" className="text-[10px]">
            ID: {review.id.slice(0, 12)}…
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Type</Label>
            <div className="text-sm">{reviewTypeMeta?.label ?? review.type}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Sub-type</Label>
            <div className="text-sm">{review.subType ?? "None"}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Status</Label>
            <Select
              value={review.status}
              onValueChange={(v) => updateMeta({ status: v as Review["status"] })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Phase</Label>
            <Select
              value={review.phase}
              onValueChange={(v) => updateMeta({ phase: v as ReviewPhase })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_PHASES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Created</div>
            <div className="font-medium">{new Date(review.createdAt).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Last updated</div>
            <div className="font-medium">{new Date(review.updatedAt).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Approx. size</div>
            <div className="font-medium">
              {approxSize < 1024 ? `${approxSize} B` : `${(approxSize / 1024).toFixed(1)} KB`}
            </div>
          </div>
        </div>
      </Card>

      {/* Review stats */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Review inventory</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Comparisons", value: stats.comparisons, icon: GitCompare },
            { label: "Outcomes", value: stats.outcomes, icon: BarChart3 },
            { label: "Data points", value: stats.dataPoints, icon: Database },
            { label: "Studies", value: stats.studies, icon: Users },
            { label: "References", value: stats.references, icon: FileText },
            { label: "RoB assessments", value: stats.robAssessments, icon: Shield },
          ].map((s) => (
            <div key={s.label} className="rounded-md border p-3 flex items-center gap-3">
              <div className="size-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
                <s.icon className="size-4" />
              </div>
              <div>
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Storage */}
      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="size-4" />
          Local data
        </h3>
        <p className="text-xs text-muted-foreground">
          RevKit stores your review on the server (SQLite via Prisma) and keeps a
          list of recently-opened files in your browser&apos;s localStorage.
        </p>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Recent files in localStorage</span>
            <span>{loadRecentFiles().length} entries</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllRecent}
            disabled={clearing}
          >
            <Trash2 className="size-4 mr-1" />
            Clear recent file list
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Info className="size-4" />
          About RevKit
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Version</div>
            <div className="font-medium">0.1.0 (alpha)</div>
          </div>
          <div>
            <div className="text-muted-foreground">File format</div>
            <div className="font-medium">revkit-1 (v1.0.0)</div>
          </div>
          <div>
            <div className="text-muted-foreground">License</div>
            <div className="font-medium">MIT</div>
          </div>
          <div>
            <div className="text-muted-foreground">Source</div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium inline-flex items-center gap-1 text-emerald-600 hover:underline"
            >
              <Github className="size-3" />
              Open on GitHub
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs">
          <div className="font-medium text-amber-900 dark:text-amber-100 mb-1 flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Web preview build
          </div>
          <p className="text-amber-800 dark:text-amber-200">
            This build of RevKit runs entirely in your browser. The master prompt
            describes a Tauri desktop app (.exe / .dmg / .AppImage) — this web
            adaptation covers all 5 review types, meta-analysis, RoB, PRISMA flow,
            and Word/CSV export. PDF attachment, native dialogs, and auto-update are
            available only in the desktop build.
          </p>
        </div>
      </Card>
    </div>
  );
}
