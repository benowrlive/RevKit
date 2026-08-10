// src/components/revkit/comparisons-page.tsx
//
// Comparisons & Outcomes page. Two-column layout:
//   ┌──────────────┬───────────────────────────────────────────────┐
//   │ 280px tree   │  Selected outcome detail (header + tabs)      │
//   │ Comparisons   │  Data Entry | Forest | Funnel/SROC | Subgps  │
//   └──────────────┴───────────────────────────────────────────────┘
//
// All mutations go through the Zustand store. The Data Entry tab renders the
// `DataGrid` component (data-entry/data-grid.tsx). The Forest/Funnel/SROC plot
// tabs render the ForestPlot family stub from forest-plot/forest-plot.tsx
// (full D3 + SVG implementation arrives in Task 5-a).

"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  GitCompare,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { useReviewStore } from "@/lib/project/state";
import type {
  Comparison,
  DataType,
  EffectMeasure,
  MethodType,
  ModelType,
  Outcome,
} from "@/lib/types";
import { DataGrid } from "@/components/data-entry/data-grid";
import { ForestPlot } from "@/components/forest-plot/forest-plot";
import { FunnelPlot } from "@/components/forest-plot/funnel-plot";
import { SrocPlot } from "@/components/forest-plot/sroc-plot";

// --- Defaults & option matrix per dataType -----------------------------------

const DEFAULTS: Record<
  DataType,
  { effectMeasure: EffectMeasure; method: MethodType; model: ModelType }
> = {
  DICHOTOMOUS: { effectMeasure: "OR", method: "MH", model: "fixed" },
  CONTINUOUS: { effectMeasure: "MD", method: "IV", model: "fixed" },
  DTA_2x2: {
    effectMeasure: "SENSITIVITY",
    method: "LOGIT_UNIVARIATE",
    model: "random",
  },
  OE_V: { effectMeasure: "PETO_OR", method: "PETO", model: "fixed" },
  GIV: { effectMeasure: "OR", method: "IV", model: "fixed" },
};

const METHOD_OPTIONS: Record<DataType, MethodType[]> = {
  DICHOTOMOUS: ["MH", "PETO", "IV", "DL"],
  CONTINUOUS: ["IV", "DL"],
  OE_V: ["PETO"],
  GIV: ["IV", "DL"],
  DTA_2x2: ["LOGIT_UNIVARIATE", "HSROC"],
};

const EFFECT_OPTIONS: Record<DataType, EffectMeasure[]> = {
  DICHOTOMOUS: ["OR", "RR", "RD", "PETO_OR"],
  CONTINUOUS: ["MD", "SMD"],
  OE_V: ["PETO_OR"],
  GIV: ["OR", "RR", "RD", "MD", "SMD"],
  DTA_2x2: ["SENSITIVITY", "SPECIFICITY", "DOR"],
};

const DATA_TYPE_LABELS: Record<DataType, string> = {
  DICHOTOMOUS: "Dichotomous",
  CONTINUOUS: "Continuous",
  OE_V: "O-E & V",
  GIV: "Generic IV",
  DTA_2x2: "DTA 2×2",
};

const SHORT_TYPE_LABELS: Record<DataType, string> = {
  DICHOTOMOUS: "Dich",
  CONTINUOUS: "Cont",
  OE_V: "O-E",
  GIV: "GIV",
  DTA_2x2: "DTA",
};

const METHOD_LABELS: Record<MethodType, string> = {
  MH: "Mantel-Haenszel",
  PETO: "Peto",
  IV: "Inverse Variance",
  DL: "DerSimonian-Laird",
  LOGIT_UNIVARIATE: "Logit Univariate",
  HSROC: "HSROC",
};

const EFFECT_LABELS: Record<EffectMeasure, string> = {
  RR: "Risk Ratio",
  OR: "Odds Ratio",
  RD: "Risk Difference",
  PETO_OR: "Peto Odds Ratio",
  MD: "Mean Difference",
  SMD: "Std. Mean Diff.",
  DOR: "Diagnostic OR",
  SENSITIVITY: "Sensitivity",
  SPECIFICITY: "Specificity",
};

const ALL_DATA_TYPES: DataType[] = [
  "DICHOTOMOUS",
  "CONTINUOUS",
  "OE_V",
  "GIV",
  "DTA_2x2",
];

// --- Main page --------------------------------------------------------------

export function ComparisonsPage() {
  const review = useReviewStore((s) => s.review);
  const addComparison = useReviewStore((s) => s.addComparison);
  const deleteComparison = useReviewStore((s) => s.deleteComparison);
  const renameComparison = useReviewStore((s) => s.renameComparison);
  const deleteOutcome = useReviewStore((s) => s.deleteOutcome);
  const addSubgroup = useReviewStore((s) => s.addSubgroup);
  const renameSubgroup = useReviewStore((s) => s.renameSubgroup);
  const deleteSubgroup = useReviewStore((s) => s.deleteSubgroup);

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [expandedComparisons, setExpandedComparisons] = useState<Set<string>>(
    new Set(),
  );

  // Inline add-comparison form
  const [newComparisonName, setNewComparisonName] = useState("");

  // Add/Edit outcome dialog state
  const [outcomeDialog, setOutcomeDialog] = useState<{
    mode: "add" | "edit";
    comparisonId?: string;
    outcome?: Outcome;
  } | null>(null);

  // Pending delete (single AlertDialog handles all three kinds)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "comparison" | "outcome" | "subgroup"; id: string; label: string }
    | null
  >(null);

  // Inline rename state (comparison)
  const [renamingComparison, setRenamingComparison] = useState<string | null>(
    null,
  );
  const [renameComparisonValue, setRenameComparisonValue] = useState("");

  // Inline add-subgroup form state (per outcome id)
  const [addSubgroupFor, setAddSubgroupFor] = useState<string | null>(null);
  const [newSubgroupName, setNewSubgroupName] = useState("");

  // Inline rename subgroup
  const [renamingSubgroup, setRenamingSubgroup] = useState<string | null>(null);
  const [renameSubgroupValue, setRenameSubgroupValue] = useState("");

  const comparisons = review?.comparisons ?? [];

  // Find the selected outcome object (live from store so edits flow back).
  const selectedOutcome = useMemo<Outcome | null>(() => {
    if (!selectedOutcomeId) return null;
    for (const c of comparisons) {
      const o = c.outcomes.find((o2) => o2.id === selectedOutcomeId);
      if (o) return o;
    }
    return null;
  }, [comparisons, selectedOutcomeId]);

  // Auto-expand the comparison that owns the selected outcome (handled in
  // `handleSelectOutcome` below — no effect needed).
  // Clear-selection-on-delete is also handled in the delete handler.

  if (!review) return null;

  function handleAddComparison() {
    const name = newComparisonName.trim();
    if (!name) {
      toast.error("Name required");
      return;
    }
    const id = addComparison(name);
    setNewComparisonName("");
    setExpandedComparisons((prev) => new Set(prev).add(id));
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "comparison") {
      deleteComparison(pendingDelete.id);
    } else if (pendingDelete.kind === "outcome") {
      deleteOutcome(pendingDelete.id);
      if (selectedOutcomeId === pendingDelete.id) setSelectedOutcomeId(null);
    } else {
      deleteSubgroup(pendingDelete.id);
    }
    toast.success("Deleted");
    setPendingDelete(null);
  }

  function commitComparisonRename(id: string) {
    const name = renameComparisonValue.trim();
    if (!name) {
      setRenamingComparison(null);
      return;
    }
    renameComparison(id, name);
    setRenamingComparison(null);
  }

  function commitSubgroupAdd(outcomeId: string) {
    const name = newSubgroupName.trim();
    if (!name) {
      setAddSubgroupFor(null);
      return;
    }
    addSubgroup(outcomeId, name);
    setNewSubgroupName("");
    setAddSubgroupFor(null);
  }

  function commitSubgroupRename(id: string) {
    const name = renameSubgroupValue.trim();
    if (!name) {
      setRenamingSubgroup(null);
      return;
    }
    renameSubgroup(id, name);
    setRenamingSubgroup(null);
  }

  /** Select an outcome and ensure its parent comparison is expanded. */
  function handleSelectOutcome(id: string, comparisonId: string) {
    setSelectedOutcomeId(id);
    setExpandedComparisons((prev) => {
      if (prev.has(comparisonId)) return prev;
      const next = new Set(prev);
      next.add(comparisonId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Comparisons & Outcomes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Build the analysis tree: comparisons → outcomes → subgroups. Enter data
          per study on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
        {/* LEFT — Tree */}
        <Card className="p-3 lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <FolderTree className="size-4 text-emerald-600" />
              Comparisons
            </h3>
          </div>

          {/* Add comparison inline form */}
          <div className="flex gap-1 mb-2">
            <Input
              value={newComparisonName}
              onChange={(e) => setNewComparisonName(e.target.value)}
              placeholder="New comparison name…"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddComparison();
                if (e.key === "Escape") setNewComparisonName("");
              }}
            />
            <Button
              size="icon"
              variant="default"
              className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              onClick={handleAddComparison}
              title="Add comparison"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <Separator className="mb-2" />

          {comparisons.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              No comparisons yet.
              <br />
              Add one above to get started.
            </div>
          ) : (
            <div className="space-y-0.5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
              {comparisons.map((c) => (
                <ComparisonNode
                  key={c.id}
                  comparison={c}
                  expanded={expandedComparisons.has(c.id)}
                  onToggleExpand={() =>
                    setExpandedComparisons((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                  selectedOutcomeId={selectedOutcomeId}
                  onSelectOutcome={handleSelectOutcome}
                  onAddOutcome={() =>
                    setOutcomeDialog({
                      mode: "add",
                      comparisonId: c.id,
                    })
                  }
                  onEditOutcome={(o) =>
                    setOutcomeDialog({ mode: "edit", outcome: o })
                  }
                  onDeleteComparison={() =>
                    setPendingDelete({
                      kind: "comparison",
                      id: c.id,
                      label: c.name,
                    })
                  }
                  onDeleteOutcome={(o) =>
                    setPendingDelete({
                      kind: "outcome",
                      id: o.id,
                      label: o.name,
                    })
                  }
                  onRenameComparison={() => {
                    setRenameComparisonValue(c.name);
                    setRenamingComparison(c.id);
                  }}
                  renamingComparisonId={renamingComparison}
                  renameComparisonValue={renameComparisonValue}
                  onRenameComparisonValueChange={setRenameComparisonValue}
                  onCommitComparisonRename={() => commitComparisonRename(c.id)}
                  onCancelComparisonRename={() => setRenamingComparison(null)}
                  addSubgroupFor={addSubgroupFor}
                  newSubgroupName={newSubgroupName}
                  onNewSubgroupNameChange={setNewSubgroupName}
                  onStartAddSubgroup={(outcomeId) => {
                    setAddSubgroupFor(outcomeId);
                    setNewSubgroupName("");
                  }}
                  onCommitAddSubgroup={() => commitSubgroupAdd(addSubgroupFor ?? "")}
                  onCancelAddSubgroup={() => setAddSubgroupFor(null)}
                  onDeleteSubgroup={(sg) =>
                    setPendingDelete({
                      kind: "subgroup",
                      id: sg.id,
                      label: sg.name,
                    })
                  }
                  renamingSubgroupId={renamingSubgroup}
                  renameSubgroupValue={renameSubgroupValue}
                  onRenameSubgroupValueChange={setRenameSubgroupValue}
                  onStartRenameSubgroup={(sg) => {
                    setRenameSubgroupValue(sg.name);
                    setRenamingSubgroup(sg.id);
                  }}
                  onCommitRenameSubgroup={() => commitSubgroupRename(renamingSubgroup ?? "")}
                  onCancelRenameSubgroup={() => setRenamingSubgroup(null)}
                />
              ))}
            </div>
          )}
        </Card>

        {/* RIGHT — Selected outcome detail */}
        {!selectedOutcome ? (
          <EmptyDetail comparisonsCount={comparisons.length} />
        ) : (
          <OutcomeDetail
            outcome={selectedOutcome}
            onEdit={() =>
              setOutcomeDialog({ mode: "edit", outcome: selectedOutcome })
            }
            onAddSubgroup={() => {
              setAddSubgroupFor(selectedOutcome.id);
              setNewSubgroupName("");
            }}
            addSubgroupOpen={addSubgroupFor === selectedOutcome.id}
            newSubgroupName={newSubgroupName}
            onNewSubgroupNameChange={setNewSubgroupName}
            onCommitAddSubgroup={() => commitSubgroupAdd(selectedOutcome.id)}
            onCancelAddSubgroup={() => setAddSubgroupFor(null)}
            renamingSubgroupId={renamingSubgroup}
            renameSubgroupValue={renameSubgroupValue}
            onRenameSubgroupValueChange={setRenameSubgroupValue}
            onStartRenameSubgroup={(sg) => {
              setRenameSubgroupValue(sg.name);
              setRenamingSubgroup(sg.id);
            }}
            onCommitRenameSubgroup={() => commitSubgroupRename(renamingSubgroup ?? "")}
            onCancelRenameSubgroup={() => setRenamingSubgroup(null)}
            onDeleteSubgroup={(sg) =>
              setPendingDelete({
                kind: "subgroup",
                id: sg.id,
                label: sg.name,
              })
            }
          />
        )}
      </div>

      {/* Add / Edit outcome dialog */}
      {outcomeDialog && (
        <OutcomeFormDialog
          mode={outcomeDialog.mode}
          outcome={outcomeDialog.outcome}
          comparisonId={outcomeDialog.comparisonId}
          onClose={() => setOutcomeDialog(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.label}
              </span>
              {pendingDelete?.kind === "comparison" &&
                " and all of its outcomes and data points."}
              {pendingDelete?.kind === "outcome" &&
                " and all of its data points and subgroups."}
              {pendingDelete?.kind === "subgroup" &&
                " and its data points."}
              {" "}This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Comparison tree node ----------------------------------------------------

interface ComparisonNodeProps {
  comparison: Comparison;
  expanded: boolean;
  onToggleExpand: () => void;
  selectedOutcomeId: string | null;
  onSelectOutcome: (id: string, comparisonId: string) => void;
  onAddOutcome: () => void;
  onEditOutcome: (o: Outcome) => void;
  onDeleteComparison: () => void;
  onDeleteOutcome: (o: Outcome) => void;
  onRenameComparison: () => void;
  renamingComparisonId: string | null;
  renameComparisonValue: string;
  onRenameComparisonValueChange: (v: string) => void;
  onCommitComparisonRename: () => void;
  onCancelComparisonRename: () => void;
  addSubgroupFor: string | null;
  newSubgroupName: string;
  onNewSubgroupNameChange: (v: string) => void;
  onStartAddSubgroup: (outcomeId: string) => void;
  onCommitAddSubgroup: () => void;
  onCancelAddSubgroup: () => void;
  onDeleteSubgroup: (sg: { id: string; name: string }) => void;
  renamingSubgroupId: string | null;
  renameSubgroupValue: string;
  onRenameSubgroupValueChange: (v: string) => void;
  onStartRenameSubgroup: (sg: { id: string; name: string }) => void;
  onCommitRenameSubgroup: () => void;
  onCancelRenameSubgroup: () => void;
}

function ComparisonNode(props: ComparisonNodeProps) {
  const {
    comparison: c,
    expanded,
    onToggleExpand,
    selectedOutcomeId,
    onSelectOutcome,
    onAddOutcome,
    onEditOutcome,
    onDeleteComparison,
    onDeleteOutcome,
    onRenameComparison,
    renamingComparisonId,
    renameComparisonValue,
    onRenameComparisonValueChange,
    onCommitComparisonRename,
    onCancelComparisonRename,
    addSubgroupFor,
    newSubgroupName,
    onNewSubgroupNameChange,
    onStartAddSubgroup,
    onCommitAddSubgroup,
    onCancelAddSubgroup,
    onDeleteSubgroup,
    renamingSubgroupId,
    renameSubgroupValue,
    onRenameSubgroupValueChange,
    onStartRenameSubgroup,
    onCommitRenameSubgroup,
    onCancelRenameSubgroup,
  } = props;

  const isRenaming = renamingComparisonId === c.id;

  return (
    <div className="rounded-md">
      {/* Comparison header */}
      <div className="flex items-center gap-1 group">
        <button
          onClick={onToggleExpand}
          className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>

        {isRenaming ? (
          <Input
            value={renameComparisonValue}
            onChange={(e) => onRenameComparisonValueChange(e.target.value)}
            onBlur={onCommitComparisonRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitComparisonRename();
              if (e.key === "Escape") onCancelComparisonRename();
            }}
            className="h-7 text-sm flex-1"
            autoFocus
          />
        ) : (
          <button
            onClick={onToggleExpand}
            className="flex-1 text-left text-sm font-medium truncate hover:text-emerald-700"
            title={c.name}
          >
            {c.name}
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({c.outcomes.length})
            </span>
          </button>
        )}

        {!isRenaming && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <IconBtn
              icon={Plus}
              title="Add outcome"
              onClick={onAddOutcome}
              className="text-emerald-700"
            />
            <IconBtn
              icon={Pencil}
              title="Rename"
              onClick={onRenameComparison}
            />
            <IconBtn
              icon={Trash2}
              title="Delete comparison"
              onClick={onDeleteComparison}
              className="text-rose-600 hover:text-rose-700"
            />
          </div>
        )}
      </div>

      {/* Outcomes */}
      {expanded && (
        <div className="ml-3 mt-0.5 border-l border-border pl-2 space-y-0.5">
          {c.outcomes.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic pl-2 py-1">
              No outcomes.
            </p>
          )}
          {c.outcomes.map((o) => {
            const isSelected = o.id === selectedOutcomeId;
            return (
              <OutcomeNode
                key={o.id}
                outcome={o}
                isSelected={isSelected}
                onSelect={() => onSelectOutcome(o.id, c.id)}
                onEdit={() => onEditOutcome(o)}
                onDelete={() => onDeleteOutcome(o)}
                addSubgroupOpen={addSubgroupFor === o.id}
                newSubgroupName={newSubgroupName}
                onNewSubgroupNameChange={onNewSubgroupNameChange}
                onStartAddSubgroup={() => onStartAddSubgroup(o.id)}
                onCommitAddSubgroup={onCommitAddSubgroup}
                onCancelAddSubgroup={onCancelAddSubgroup}
                onDeleteSubgroup={onDeleteSubgroup}
                renamingSubgroupId={renamingSubgroupId}
                renameSubgroupValue={renameSubgroupValue}
                onRenameSubgroupValueChange={onRenameSubgroupValueChange}
                onStartRenameSubgroup={onStartRenameSubgroup}
                onCommitRenameSubgroup={onCommitRenameSubgroup}
                onCancelRenameSubgroup={onCancelRenameSubgroup}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Outcome node ----------------------------------------------------------

interface OutcomeNodeProps {
  outcome: Outcome;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  addSubgroupOpen: boolean;
  newSubgroupName: string;
  onNewSubgroupNameChange: (v: string) => void;
  onStartAddSubgroup: () => void;
  onCommitAddSubgroup: () => void;
  onCancelAddSubgroup: () => void;
  onDeleteSubgroup: (sg: { id: string; name: string }) => void;
  renamingSubgroupId: string | null;
  renameSubgroupValue: string;
  onRenameSubgroupValueChange: (v: string) => void;
  onStartRenameSubgroup: (sg: { id: string; name: string }) => void;
  onCommitRenameSubgroup: () => void;
  onCancelRenameSubgroup: () => void;
}

function OutcomeNode(props: OutcomeNodeProps) {
  const {
    outcome: o,
    isSelected,
    onSelect,
    onEdit,
    onDelete,
    addSubgroupOpen,
    newSubgroupName,
    onNewSubgroupNameChange,
    onStartAddSubgroup,
    onCommitAddSubgroup,
    onCancelAddSubgroup,
    onDeleteSubgroup,
    renamingSubgroupId,
    renameSubgroupValue,
    onRenameSubgroupValueChange,
    onStartRenameSubgroup,
    onCommitRenameSubgroup,
    onCancelRenameSubgroup,
  } = props;

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-1 rounded px-1.5 py-1 cursor-pointer",
          isSelected
            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100"
            : "hover:bg-muted",
        )}
        onClick={onSelect}
      >
        <Badge
          variant="outline"
          className="text-[9px] h-4 px-1 py-0 shrink-0 font-mono"
        >
          {SHORT_TYPE_LABELS[o.dataType]}
        </Badge>
        <span className="flex-1 text-sm truncate">{o.name}</span>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <IconBtn
            icon={Plus}
            title="Add subgroup"
            onClick={(e) => {
              e.stopPropagation();
              onStartAddSubgroup();
            }}
            className="text-emerald-700"
          />
          <IconBtn
            icon={Pencil}
            title="Edit outcome"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
          <IconBtn
            icon={Trash2}
            title="Delete outcome"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-rose-600 hover:text-rose-700"
          />
        </div>
      </div>

      {/* Subgroups */}
      {o.subgroups.length > 0 && (
        <div className="ml-3 mt-0.5 border-l border-border pl-2 space-y-0.5">
          {o.subgroups.map((sg) => {
            const isRenaming = renamingSubgroupId === sg.id;
            return (
              <div
                key={sg.id}
                className="flex items-center gap-1 group/sg px-1.5 py-0.5 rounded hover:bg-muted"
              >
                {isRenaming ? (
                  <Input
                    value={renameSubgroupValue}
                    onChange={(e) => onRenameSubgroupValueChange(e.target.value)}
                    onBlur={onCommitRenameSubgroup}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitRenameSubgroup();
                      if (e.key === "Escape") onCancelRenameSubgroup();
                    }}
                    className="h-6 text-xs flex-1"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-xs text-muted-foreground truncate">
                    {sg.name}
                  </span>
                )}
                {!isRenaming && (
                  <div className="flex items-center opacity-0 group-hover/sg:opacity-100 transition-opacity">
                    <IconBtn
                      icon={Pencil}
                      title="Rename subgroup"
                      onClick={() => onStartRenameSubgroup(sg)}
                    />
                    <IconBtn
                      icon={Trash2}
                      title="Delete subgroup"
                      onClick={() => onDeleteSubgroup(sg)}
                      className="text-rose-600 hover:text-rose-700"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Inline add-subgroup form */}
      {addSubgroupOpen && (
        <div className="ml-3 mt-0.5 border-l border-border pl-2 flex gap-1 py-0.5">
          <Input
            value={newSubgroupName}
            onChange={(e) => onNewSubgroupNameChange(e.target.value)}
            placeholder="Subgroup name…"
            className="h-6 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitAddSubgroup();
              if (e.key === "Escape") onCancelAddSubgroup();
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={onCommitAddSubgroup}
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={onCancelAddSubgroup}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Outcome detail (right panel) -----------------------------------------

interface OutcomeDetailProps {
  outcome: Outcome;
  onEdit: () => void;
  onAddSubgroup: () => void;
  addSubgroupOpen: boolean;
  newSubgroupName: string;
  onNewSubgroupNameChange: (v: string) => void;
  onCommitAddSubgroup: () => void;
  onCancelAddSubgroup: () => void;
  renamingSubgroupId: string | null;
  renameSubgroupValue: string;
  onRenameSubgroupValueChange: (v: string) => void;
  onStartRenameSubgroup: (sg: { id: string; name: string }) => void;
  onCommitRenameSubgroup: () => void;
  onCancelRenameSubgroup: () => void;
  onDeleteSubgroup: (sg: { id: string; name: string }) => void;
}

function OutcomeDetail(props: OutcomeDetailProps) {
  const {
    outcome,
    onEdit,
    onAddSubgroup,
    addSubgroupOpen,
    newSubgroupName,
    onNewSubgroupNameChange,
    onCommitAddSubgroup,
    onCancelAddSubgroup,
    renamingSubgroupId,
    renameSubgroupValue,
    onRenameSubgroupValueChange,
    onStartRenameSubgroup,
    onCommitRenameSubgroup,
    onCancelRenameSubgroup,
    onDeleteSubgroup,
  } = props;

  const isDta = outcome.dataType === "DTA_2x2";

  return (
    <Card className="p-4 lg:p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold truncate">{outcome.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge variant="secondary" className="text-xs">
              {DATA_TYPE_LABELS[outcome.dataType]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {EFFECT_LABELS[outcome.effectMeasure]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {METHOD_LABELS[outcome.method]}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-xs capitalize",
                outcome.model === "random"
                  ? "border-amber-300 text-amber-700"
                  : "border-emerald-300 text-emerald-700",
              )}
            >
              {outcome.model === "random" ? "Random" : "Fixed"}
            </Badge>
            {outcome.unit && (
              <Badge variant="outline" className="text-xs">
                Unit: {outcome.unit}
              </Badge>
            )}
            {outcome.timeFrame && (
              <Badge variant="outline" className="text-xs">
                {outcome.timeFrame}
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </div>

      <Tabs defaultValue="data" className="w-full">
        <TabsList>
          <TabsTrigger value="data">Data Entry</TabsTrigger>
          <TabsTrigger value="forest">Forest Plot</TabsTrigger>
          <TabsTrigger value="funnel">
            {isDta ? "SROC Plot" : "Funnel Plot"}
          </TabsTrigger>
          <TabsTrigger value="subgroups">
            Subgroups
            <Badge
              variant="secondary"
              className="ml-1.5 h-4 px-1 text-[10px]"
            >
              {outcome.subgroups.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="mt-3">
          <DataGrid outcome={outcome} />
        </TabsContent>

        <TabsContent value="forest" className="mt-3">
          <ForestPlot outcome={outcome} />
        </TabsContent>

        <TabsContent value="funnel" className="mt-3">
          {isDta ? <SrocPlot outcome={outcome} /> : <FunnelPlot outcome={outcome} />}
        </TabsContent>

        <TabsContent value="subgroups" className="mt-3">
          <SubgroupsTab
            outcome={outcome}
            addSubgroupOpen={addSubgroupOpen}
            newSubgroupName={newSubgroupName}
            onNewSubgroupNameChange={onNewSubgroupNameChange}
            onAddSubgroup={onAddSubgroup}
            onCommitAddSubgroup={onCommitAddSubgroup}
            onCancelAddSubgroup={onCancelAddSubgroup}
            renamingSubgroupId={renamingSubgroupId}
            renameSubgroupValue={renameSubgroupValue}
            onRenameSubgroupValueChange={onRenameSubgroupValueChange}
            onStartRenameSubgroup={onStartRenameSubgroup}
            onCommitRenameSubgroup={onCommitRenameSubgroup}
            onCancelRenameSubgroup={onCancelRenameSubgroup}
            onDeleteSubgroup={onDeleteSubgroup}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// --- Subgroups tab ---------------------------------------------------------

interface SubgroupsTabProps {
  outcome: Outcome;
  addSubgroupOpen: boolean;
  newSubgroupName: string;
  onNewSubgroupNameChange: (v: string) => void;
  onAddSubgroup: () => void;
  onCommitAddSubgroup: () => void;
  onCancelAddSubgroup: () => void;
  renamingSubgroupId: string | null;
  renameSubgroupValue: string;
  onRenameSubgroupValueChange: (v: string) => void;
  onStartRenameSubgroup: (sg: { id: string; name: string }) => void;
  onCommitRenameSubgroup: () => void;
  onCancelRenameSubgroup: () => void;
  onDeleteSubgroup: (sg: { id: string; name: string }) => void;
}

function SubgroupsTab(props: SubgroupsTabProps) {
  const {
    outcome,
    addSubgroupOpen,
    newSubgroupName,
    onNewSubgroupNameChange,
    onAddSubgroup,
    onCommitAddSubgroup,
    onCancelAddSubgroup,
    renamingSubgroupId,
    renameSubgroupValue,
    onRenameSubgroupValueChange,
    onStartRenameSubgroup,
    onCommitRenameSubgroup,
    onCancelRenameSubgroup,
    onDeleteSubgroup,
  } = props;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Subgroups</h4>
          <p className="text-xs text-muted-foreground">
            Subgroups let you split the analysis (e.g. by age band, study design).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onAddSubgroup}>
          <Plus className="size-4" />
          Add subgroup
        </Button>
      </div>

      {addSubgroupOpen && (
        <Card className="p-3 flex gap-2 items-center">
          <Input
            value={newSubgroupName}
            onChange={(e) => onNewSubgroupNameChange(e.target.value)}
            placeholder="Subgroup name…"
            className="h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitAddSubgroup();
              if (e.key === "Escape") onCancelAddSubgroup();
            }}
          />
          <Button size="sm" onClick={onCommitAddSubgroup} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelAddSubgroup}>
            Cancel
          </Button>
        </Card>
      )}

      {outcome.subgroups.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-md">
          No subgroups defined.
        </div>
      ) : (
        <div className="space-y-1">
          {outcome.subgroups.map((sg) => {
            const isRenaming = renamingSubgroupId === sg.id;
            return (
              <Card key={sg.id} className="p-2.5 flex items-center gap-2">
                {isRenaming ? (
                  <Input
                    value={renameSubgroupValue}
                    onChange={(e) => onRenameSubgroupValueChange(e.target.value)}
                    onBlur={onCommitRenameSubgroup}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitRenameSubgroup();
                      if (e.key === "Escape") onCancelRenameSubgroup();
                    }}
                    className="h-7"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{sg.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {sg.dataPoints.length} data points
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onStartRenameSubgroup(sg)}
                      title="Rename"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-600 hover:text-rose-700"
                      onClick={() => onDeleteSubgroup(sg)}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Add / Edit outcome dialog --------------------------------------------

interface OutcomeFormDialogProps {
  mode: "add" | "edit";
  outcome?: Outcome;
  /** Required when mode === "add"; ignored when editing an existing outcome. */
  comparisonId?: string;
  onClose: () => void;
}

function OutcomeFormDialog({
  mode,
  outcome,
  comparisonId,
  onClose,
}: OutcomeFormDialogProps) {
  const addOutcome = useReviewStore((s) => s.addOutcome);
  const updateOutcome = useReviewStore((s) => s.updateOutcome);

  const [name, setName] = useState(outcome?.name ?? "");
  const [dataType, setDataType] = useState<DataType>(
    outcome?.dataType ?? "DICHOTOMOUS",
  );
  const [effectMeasure, setEffectMeasure] = useState<EffectMeasure>(
    outcome?.effectMeasure ?? DEFAULTS.DICHOTOMOUS.effectMeasure,
  );
  const [method, setMethod] = useState<MethodType>(
    outcome?.method ?? DEFAULTS.DICHOTOMOUS.method,
  );
  const [model, setModel] = useState<ModelType>(
    outcome?.model ?? DEFAULTS.DICHOTOMOUS.model,
  );
  const [unit, setUnit] = useState<string>(outcome?.unit ?? "");
  const [timeFrame, setTimeFrame] = useState<string>(
    outcome?.timeFrame ?? "",
  );

  // When dataType changes, snap defaults to the spec's per-type defaults and
  // ensure the chosen effect/method remain valid for the new dataType.
  function handleDataTypeChange(next: DataType) {
    setDataType(next);
    const d = DEFAULTS[next];
    setEffectMeasure(d.effectMeasure);
    setMethod(d.method);
    setModel(d.model);
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("Outcome name is required");
      return;
    }
    if (mode === "add") {
      if (!comparisonId) {
        toast.error("No comparison selected");
        return;
      }
      addOutcome(comparisonId, {
        name: name.trim(),
        dataType,
        effectMeasure,
        method,
        model,
        unit: unit.trim() || null,
        timeFrame: timeFrame.trim() || null,
      });
      toast.success("Outcome added");
    } else if (outcome) {
      updateOutcome(outcome.id, {
        name: name.trim(),
        dataType,
        effectMeasure,
        method,
        model,
        unit: unit.trim() || null,
        timeFrame: timeFrame.trim() || null,
      });
      toast.success("Outcome updated");
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add outcome" : "Edit outcome"}
          </DialogTitle>
          <DialogDescription>
            Configure the data type, effect measure, and pooling method. Options
            for method/effect adapt to the selected data type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="out-name" className="text-xs">
              Outcome name
            </Label>
            <Input
              id="out-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. All-cause mortality"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data type</Label>
              <Select
                value={dataType}
                onValueChange={(v) => handleDataTypeChange(v as DataType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DATA_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DATA_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Model</Label>
              <Select
                value={model}
                onValueChange={(v) => setModel(v as ModelType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed-effect</SelectItem>
                  <SelectItem value="random">Random-effects</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Effect measure</Label>
              <Select
                value={effectMeasure}
                onValueChange={(v) => setEffectMeasure(v as EffectMeasure)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFECT_OPTIONS[dataType].map((m) => (
                    <SelectItem key={m} value={m}>
                      {EFFECT_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Method</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as MethodType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS[dataType].map((m) => (
                    <SelectItem key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="out-unit" className="text-xs">
                Unit (optional)
              </Label>
              <Input
                id="out-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. mmHg"
              />
            </div>
            <div>
              <Label htmlFor="out-tf" className="text-xs">
                Time frame (optional)
              </Label>
              <Input
                id="out-tf"
                value={timeFrame}
                onChange={(e) => setTimeFrame(e.target.value)}
                placeholder="e.g. 6 months"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {mode === "add" ? "Add outcome" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Empty state (no outcome selected) ------------------------------------

function EmptyDetail({ comparisonsCount }: { comparisonsCount: number }) {
  return (
    <Card className="p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
      <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-3">
        <GitCompare className="size-6 text-emerald-600" />
      </div>
      <h3 className="text-base font-semibold">No outcome selected</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {comparisonsCount === 0
          ? "Start by adding a comparison on the left, then add an outcome to enter your study data."
          : "Pick an outcome from the tree on the left to see its data entry grid, forest plot, and subgroups."}
      </p>
    </Card>
  );
}

// --- Small icon button helper ---------------------------------------------

function IconBtn({
  icon: Icon,
  title,
  onClick,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0",
        className,
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
