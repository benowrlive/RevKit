// src/components/revkit/prisma-page.tsx — PRISMA 2020 flow diagram editor.
//
// Renders the canonical 11-box PRISMA 2020 flow as a single SVG canvas with
// four stage swimlanes (Identification / Screening / Eligibility / Included).
// Each box is interactive: click → edit dialog (toggle "auto-count from
// review" or set a custom count). Includes:
//   - "Auto-fill from review state" button (sets all boxes autoCount=true,
//     recomputes counts from the review state via computePrismaCountsFromReview).
//   - "Reset to 0" button (confirm dialog → all counts 0, autoCount=false).
//   - Download PNG / SVG buttons (serialize the SVG element).
//   - "View full screen" Sheet for mobile.
//   - Legend + counts summary table below the diagram.
//
// All mutations go through the Zustand store's `setPrismaBox` action. The
// flow is seeded from `createEmptyPrismaFlow` on first mount if it is null
// or empty (one-time effect guarded by `review.prismaFlow?.boxes.length`).

"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Image as ImageIcon,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useReviewStore } from "@/lib/project/state";
import type { PrismaFlowBox, Review } from "@/lib/types";
import {
  PRISMA_TEMPLATE,
  computePrismaCountsFromReview,
  createEmptyPrismaFlow,
  getPrismaBoxDef,
  type PrismaFlowBoxDef,
} from "@/lib/prisma-flow/template";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadPNGFromSVG, downloadSVGElement } from "@/lib/export/download";

// ---------------------------------------------------------------------------
// Layout — viewBox 820 × 940. Four stages stacked vertically; side-branches
// to the right for the "excluded" / "removed" / "not retrieved" boxes.
// ---------------------------------------------------------------------------

const SVG_WIDTH = 820;
const SVG_HEIGHT = 940;
const BOX_W = 200;
const BOX_H = 80;

interface BoxLayout {
  id: string;
  x: number;
  y: number;
}

const LAYOUT: Record<string, BoxLayout> = {
  id_db: { id: "id_db", x: 170, y: 70 },
  id_other: { id: "id_other", x: 430, y: 70 },
  id_dedup: { id: "id_dedup", x: 300, y: 220 },
  id_autoexcl: { id: "id_autoexcl", x: 560, y: 220 },
  scr_screened: { id: "scr_screened", x: 170, y: 380 },
  scr_excluded: { id: "scr_excluded", x: 430, y: 380 },
  elig_sought: { id: "elig_sought", x: 170, y: 510 },
  elig_notretrieved: { id: "elig_notretrieved", x: 430, y: 510 },
  elig_assessed: { id: "elig_assessed", x: 170, y: 640 },
  elig_excluded: { id: "elig_excluded", x: 430, y: 640 },
  inc_review: { id: "inc_review", x: 300, y: 800 },
};

// Stage background bands (behind each stage's row of boxes).
const STAGE_BANDS: Array<{
  stage: PrismaFlowBoxDef["stage"];
  label: string;
  y: number;
  height: number;
}> = [
  { stage: "identification", label: "Identification", y: 50, height: 270 },
  { stage: "screening", label: "Screening", y: 360, height: 140 },
  { stage: "eligibility", label: "Eligibility", y: 490, height: 270 },
  { stage: "included", label: "Included", y: 780, height: 130 },
];

// Stage colors: each stage has fill / stroke / text colors for its boxes and
// a faint band color for the swimlane background.
const STAGE_COLORS: Record<
  PrismaFlowBoxDef["stage"],
  { fill: string; stroke: string; text: string; band: string }
> = {
  identification: { fill: "#f1f5f9", stroke: "#475569", text: "#0f172a", band: "#f8fafc" },
  screening: { fill: "#dbeafe", stroke: "#1d4ed8", text: "#1e3a8a", band: "#eff6ff" },
  eligibility: { fill: "#fef3c7", stroke: "#b45309", text: "#78350f", band: "#fffbeb" },
  included: { fill: "#d1fae5", stroke: "#047857", text: "#064e3b", band: "#ecfdf5" },
};

// ---------------------------------------------------------------------------
// Arrows — each arrow connects two boxes by id.
//   - "merge":        vertical → horizontal → vertical (inverted-Y).
//   - "vertical":     straight down.
//   - "horizontal":   right side-arrow (used for "excluded" side boxes).
//   - "L-down":       vertical → horizontal → vertical with a single elbow.
// ---------------------------------------------------------------------------

type ArrowType = "merge" | "vertical" | "horizontal" | "L-down";

interface ArrowDef {
  from: string;
  to: string;
  type: ArrowType;
}

const ARROWS: ArrowDef[] = [
  { from: "id_db", to: "id_dedup", type: "merge" },
  { from: "id_other", to: "id_dedup", type: "merge" },
  { from: "id_dedup", to: "id_autoexcl", type: "horizontal" },
  { from: "id_dedup", to: "scr_screened", type: "L-down" },
  { from: "scr_screened", to: "scr_excluded", type: "horizontal" },
  { from: "scr_screened", to: "elig_sought", type: "vertical" },
  { from: "elig_sought", to: "elig_notretrieved", type: "horizontal" },
  { from: "elig_sought", to: "elig_assessed", type: "vertical" },
  { from: "elig_assessed", to: "elig_excluded", type: "horizontal" },
  { from: "elig_assessed", to: "inc_review", type: "L-down" },
];

const ARROW_COLOR = "#475569";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split a label string into 1-2 balanced lines, stripping the "(n=)" suffix. */
function splitLabel(label: string): string[] {
  const text = label.replace(/\s*\(n=\)\s*$/, "");
  if (text.length <= 28) return [text];
  const words = text.split(/\s+/);
  if (words.length <= 1) return [text];
  let bestSplit = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(" ").length;
    const right = words.slice(i).join(" ").length;
    const diff = Math.abs(left - right);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")];
}

/** Compute the path for an arrow between two box layouts. */
function arrowPath(arrow: ArrowDef): string {
  const from = LAYOUT[arrow.from];
  const to = LAYOUT[arrow.to];
  const fromCx = from.x + BOX_W / 2;
  const fromBottom = from.y + BOX_H;
  const toCx = to.x + BOX_W / 2;
  const toTop = to.y;
  const toLeft = to.x;

  switch (arrow.type) {
    case "merge":
    case "L-down": {
      // Down from source, horizontal across, down into target.
      const midY = (fromBottom + toTop) / 2;
      return `M ${fromCx} ${fromBottom} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${toTop - 4}`;
    }
    case "vertical": {
      return `M ${fromCx} ${fromBottom} L ${fromCx} ${toTop - 4}`;
    }
    case "horizontal": {
      const fromRight = from.x + BOX_W;
      const midY = from.y + BOX_H / 2;
      return `M ${fromRight} ${midY} L ${toLeft - 4} ${midY}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface BoxProps {
  boxId: string;
  count: number;
  auto: boolean;
  onEdit: (boxId: string) => void;
}

function PrismaBox({ boxId, count, auto, onEdit }: BoxProps) {
  const def = getPrismaBoxDef(boxId);
  const layout = LAYOUT[boxId];
  if (!def || !layout) return null;
  const colors = STAGE_COLORS[def.stage];
  const lines = splitLabel(def.label);
  const labelYStart = layout.y + 22;

  return (
    <g
      onClick={() => onEdit(boxId)}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(boxId);
        }
      }}
      aria-label={`${def.label}: ${count} (click to edit)`}
    >
      <title>{`${def.label}: ${count}${auto ? " (auto)" : " (manual)"}`}</title>
      <rect
        x={layout.x}
        y={layout.y}
        width={BOX_W}
        height={BOX_H}
        rx={8}
        ry={8}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1.5}
        className="prisma-box-rect"
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={layout.x + BOX_W / 2}
          y={labelYStart + i * 13}
          fontSize={10}
          fill={colors.text}
          textAnchor="middle"
          fontWeight={500}
        >
          {line}
        </text>
      ))}
      <text
        x={layout.x + BOX_W / 2}
        y={layout.y + 60}
        fontSize={20}
        fontWeight={700}
        fill={colors.text}
        textAnchor="middle"
      >
        {count}
      </text>
      {auto && (
        <circle
          cx={layout.x + BOX_W - 8}
          cy={layout.y + 8}
          r={4}
          fill="#10b981"
        >
          <title>Auto-count from review state</title>
        </circle>
      )}
    </g>
  );
}

function PrismaDiagram({
  boxes,
  onEdit,
  svgRef,
}: {
  boxes: PrismaFlowBox[];
  onEdit: (boxId: string) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const countById = useMemo(() => {
    const m = new Map<string, PrismaFlowBox>();
    for (const b of boxes) m.set(b.id, b);
    return m;
  }, [boxes]);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: "#ffffff",
        borderRadius: 8,
      }}
      role="img"
      aria-label="PRISMA 2020 flow diagram"
    >
      <defs>
        <marker
          id="prisma-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={ARROW_COLOR} />
        </marker>
        <style>{`.prisma-box-rect:hover { stroke-width: 2.5; filter: brightness(0.97); }`}</style>
      </defs>

      {/* Stage background bands */}
      {STAGE_BANDS.map((band) => {
        const colors = STAGE_COLORS[band.stage];
        return (
          <g key={band.stage}>
            <rect
              x={10}
              y={band.y}
              width={SVG_WIDTH - 20}
              height={band.height}
              fill={colors.band}
              stroke={colors.stroke}
              strokeOpacity={0.15}
              strokeWidth={1}
              rx={6}
            />
            <text
              x={20}
              y={band.y + 18}
              fontSize={11}
              fontWeight={700}
              fill={colors.stroke}
              opacity={0.7}
            >
              {band.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Arrows */}
      {ARROWS.map((arrow, i) => (
        <path
          key={i}
          d={arrowPath(arrow)}
          fill="none"
          stroke={ARROW_COLOR}
          strokeWidth={1.5}
          markerEnd="url(#prisma-arrow)"
        />
      ))}

      {/* Boxes */}
      {PRISMA_TEMPLATE.map((def) => {
        const box = countById.get(def.id);
        const count = box?.count ?? 0;
        const auto = box?.autoCount ?? false;
        return (
          <PrismaBox
            key={def.id}
            boxId={def.id}
            count={count}
            auto={auto}
            onEdit={onEdit}
          />
        );
      })}

      {/* Footer */}
      <text
        x={SVG_WIDTH / 2}
        y={SVG_HEIGHT - 8}
        fontSize={9}
        fill="#94a3b8"
        textAnchor="middle"
      >
        PRISMA 2020 · Page MJ et al. BMJ 2021;372:n71
      </text>
    </svg>
  );
}

function StageLegend() {
  const items: Array<{ stage: PrismaFlowBoxDef["stage"]; label: string }> = [
    { stage: "identification", label: "Identification" },
    { stage: "screening", label: "Screening" },
    { stage: "eligibility", label: "Eligibility" },
    { stage: "included", label: "Included" },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => {
        const c = STAGE_COLORS[item.stage];
        return (
          <div key={item.stage} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm border"
              style={{ background: c.fill, borderColor: c.stroke }}
            />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: "#10b981" }}
        />
        <span className="text-xs text-muted-foreground">Auto-count</span>
      </div>
    </div>
  );
}

function CountsTable({ boxes }: { boxes: PrismaFlowBox[] }) {
  const countById = useMemo(() => {
    const m = new Map<string, PrismaFlowBox>();
    for (const b of boxes) m.set(b.id, b);
    return m;
  }, [boxes]);
  return (
    <Card className="p-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Stage</TableHead>
            <TableHead>Label</TableHead>
            <TableHead className="text-right w-[80px]">Count</TableHead>
            <TableHead className="w-[100px]">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PRISMA_TEMPLATE.map((def) => {
            const b = countById.get(def.id);
            const count = b?.count ?? 0;
            const auto = b?.autoCount ?? false;
            return (
              <TableRow key={def.id}>
                <TableCell className="capitalize text-xs text-muted-foreground">
                  {def.stage}
                </TableCell>
                <TableCell className="text-sm">{def.label}</TableCell>
                <TableCell className="text-right font-mono text-sm">{count}</TableCell>
                <TableCell>
                  <Badge
                    variant={auto ? "secondary" : "outline"}
                    className={
                      auto
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        : ""
                    }
                  >
                    {auto ? "auto" : "manual"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

interface EditDialogProps {
  boxId: string;
  onClose: () => void;
}

function EditBoxDialog({ boxId, onClose }: EditDialogProps) {
  const review = useReviewStore((s) => s.review);
  const setPrismaBox = useReviewStore((s) => s.setPrismaBox);

  const def = getPrismaBoxDef(boxId);
  const existingBox = useMemo(() => {
    if (!review?.prismaFlow) return null;
    return review.prismaFlow.boxes.find((b) => b.id === boxId) ?? null;
  }, [review, boxId]);

  // Computed count is derived from the live review state (recomputes when the
  // review's references / studies change).
  const computedCount = useMemo(() => {
    if (!review) return 0;
    const counts = computePrismaCountsFromReview(review);
    return counts[boxId] ?? 0;
  }, [review, boxId]);

  // Local draft state — initialized once on mount. The parent remounts this
  // component (via `key={boxId}`) whenever the user picks a different box, so
  // the useState initializers run fresh each time.
  const [autoCount, setAutoCount] = useState<boolean>(existingBox?.autoCount ?? true);
  const [countStr, setCountStr] = useState<string>(String(existingBox?.count ?? 0));

  if (!def || !review) return null;

  const handleSave = () => {
    const finalCount = autoCount
      ? computedCount
      : Math.max(0, parseInt(countStr, 10) || 0);
    setPrismaBox(boxId, finalCount, autoCount);
    toast.success(`Updated "${def.label.replace(/\s*\(n=\)\s*$/, "")}"`, {
      description: `Count: ${finalCount} (${autoCount ? "auto" : "manual"})`,
    });
    onClose();
  };

  const displayName = def.label.replace(/\s*\(n=\)\s*$/, "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit PRISMA box</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{displayName}</span>
            <br />
            <span className="text-xs">{def.description}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border p-3 bg-muted/30">
            <Checkbox
              id="prisma-auto-count"
              checked={autoCount}
              onCheckedChange={(v) => setAutoCount(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="prisma-auto-count" className="text-sm font-medium cursor-pointer">
                Auto-count from review state
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, the count is derived from the current references and
                studies in this review. The value cannot be edited manually.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prisma-count" className="text-sm font-medium">
              Count
            </Label>
            {autoCount ? (
              <div className="flex items-center gap-2">
                <Input
                  id="prisma-count"
                  value={String(computedCount)}
                  readOnly
                  className="font-mono bg-muted/50"
                />
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                >
                  auto
                </Badge>
              </div>
            ) : (
              <Input
                id="prisma-count"
                type="number"
                min={0}
                value={countStr}
                onChange={(e) => setCountStr(e.target.value)}
                className="font-mono"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {autoCount
                ? `Computed from ${review.references.length} references and ${review.studies.length} studies.`
                : "Enter a custom count (0 or positive integer)."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PrismaPage() {
  const review = useReviewStore((s) => s.review);
  const setPrismaBox = useReviewStore((s) => s.setPrismaBox);

  const svgRef = useRef<SVGSVGElement>(null);
  const [editingBox, setEditingBox] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Seed the prismaFlow once if it's null or empty.
  useEffect(() => {
    if (!review) return;
    const flow = review.prismaFlow;
    if (flow && flow.boxes.length > 0) return;
    // Build the empty template and seed all 11 boxes via the store, with
    // autoCount=true so counts are derived from the review state initially.
    const empty = createEmptyPrismaFlow(review.id);
    const counts = computePrismaCountsFromReview(review);
    for (const box of empty.boxes) {
      setPrismaBox(box.id, counts[box.id] ?? 0, true);
    }
  }, [review?.id, review?.prismaFlow?.boxes.length]);

  if (!review) return null;

  const boxes = review.prismaFlow?.boxes ?? [];

  const handleAutoFill = () => {
    if (!review) return;
    const counts = computePrismaCountsFromReview(review);
    for (const def of PRISMA_TEMPLATE) {
      setPrismaBox(def.id, counts[def.id] ?? 0, true);
    }
    toast.success("PRISMA flow auto-filled from review state", {
      description: `${PRISMA_TEMPLATE.length} boxes updated.`,
    });
  };

  const handleReset = () => {
    for (const def of PRISMA_TEMPLATE) {
      setPrismaBox(def.id, 0, false);
    }
    setResetOpen(false);
    toast.success("PRISMA flow reset", { description: "All counts set to 0 (manual)." });
  };

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    downloadSVGElement(svgRef.current, "prisma-flow.svg");
    toast.success("Exported prisma-flow.svg");
  };

  const handleDownloadPng = () => {
    if (!svgRef.current) return;
    downloadPNGFromSVG(svgRef.current, "prisma-flow.png");
    toast.success("Exported prisma-flow.png");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">PRISMA 2020 Flow Diagram</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Edit counts for each stage of the review process. Click any box to
            customize the count or toggle auto-counting from review state.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAutoFill} variant="outline" size="sm">
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">Auto-fill from review</span>
            <span className="sm:hidden">Auto-fill</span>
          </Button>
          <Button onClick={() => setResetOpen(true)} variant="outline" size="sm">
            <RotateCcw className="size-4" />
            <span className="hidden sm:inline">Reset to 0</span>
            <span className="sm:hidden">Reset</span>
          </Button>
          <Button onClick={handleDownloadSvg} variant="outline" size="sm">
            <Download className="size-4" />
            SVG
          </Button>
          <Button onClick={handleDownloadPng} variant="outline" size="sm">
            <ImageIcon className="size-4" />
            PNG
          </Button>
          <Button
            onClick={() => setSheetOpen(true)}
            variant="outline"
            size="sm"
            className="sm:hidden"
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Diagram */}
      <Card className="p-3 sm:p-4">
        <PrismaDiagram boxes={boxes} onEdit={setEditingBox} svgRef={svgRef} />
      </Card>

      {/* Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <StageLegend />
        <Button
          onClick={() => setSheetOpen(true)}
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
        >
          <Maximize2 className="size-4" />
          View full screen
        </Button>
      </div>

      <Separator />

      {/* Counts summary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Counts summary</h3>
        <CountsTable boxes={boxes} />
      </div>

      {/* Edit dialog — rendered only when a box is selected, and keyed by boxId
          so the inner draft state is re-initialized cleanly when the user
          picks a different box. */}
      {editingBox && (
        <EditBoxDialog
          key={editingBox}
          boxId={editingBox}
          onClose={() => setEditingBox(null)}
        />
      )}

      {/* Reset confirm dialog */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all PRISMA counts to 0?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set every box to count=0 with manual counting. Auto-count
              will be disabled for all boxes. You can re-enable auto-count per box
              or use "Auto-fill from review" again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <RotateCcw className="size-4 mr-1" />
              Reset all to 0
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full-screen sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto p-4"
        >
          <SheetHeader>
            <SheetTitle>PRISMA 2020 Flow Diagram</SheetTitle>
            <SheetDescription>
              Full-screen view. Click any box to edit its count.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <PrismaDiagram boxes={boxes} onEdit={setEditingBox} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
