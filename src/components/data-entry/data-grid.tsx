// src/components/data-entry/data-grid.tsx
//
// Editable data entry grid for a single Outcome (or a Subgroup within an
// Outcome). Columns adapt to `outcome.dataType`:
//   - DICHOTOMOUS  : Study | Events1 | Total1 | Events2 | Total2 | Actions
//   - CONTINUOUS   : Study | Mean1 | SD1 | N1 | Mean2 | SD2 | N2 | Actions
//   - OE_V         : Study | O-E | V | Actions
//   - GIV          : Study | Effect | SE | Actions
//   - DTA_2x2      : Study | TP | FP | FN | TN | 🧮 | Actions
//
// All mutations go through the Zustand store (`useReviewStore`). Each cell is
// locally-controlled and commits via `setDataPointValue` on blur. A small
// "Add row" form at the bottom lets the user pick a study and append an empty
// data point. Paste-from-Excel is supported: pasting tab-separated text into
// any cell fills the remaining cells of the same row.

"use client";

import { useMemo, useState, type ClipboardEvent } from "react";
import { Plus, Trash2, Calculator as CalcIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useReviewStore } from "@/lib/project/state";
import type { DataPoint, DataType, Outcome } from "@/lib/types";
import { DtaCalculatorDialog } from "@/components/dta/calculator-dialog";

interface Props {
  outcome: Outcome;
  /** Defaults to null (root-level data points). Pass a subgroupId for a
   *  subgroup-scoped grid. */
  subgroupId?: string | null;
}

interface ColumnDef {
  field: keyof DataPoint;
  label: string;
}

const COLUMNS: Record<DataType, ColumnDef[]> = {
  DICHOTOMOUS: [
    { field: "events1", label: "Events1" },
    { field: "total1", label: "Total1" },
    { field: "events2", label: "Events2" },
    { field: "total2", label: "Total2" },
  ],
  CONTINUOUS: [
    { field: "mean1", label: "Mean1" },
    { field: "sd1", label: "SD1" },
    { field: "n1", label: "N1" },
    { field: "mean2", label: "Mean2" },
    { field: "sd2", label: "SD2" },
    { field: "n2", label: "N2" },
  ],
  OE_V: [
    { field: "oE", label: "O−E" },
    { field: "v", label: "V" },
  ],
  GIV: [
    { field: "effect", label: "Effect" },
    { field: "se", label: "SE" },
  ],
  DTA_2x2: [
    { field: "tp", label: "TP" },
    { field: "fp", label: "FP" },
    { field: "fn", label: "FN" },
    { field: "tn", label: "TN" },
  ],
};

/** Validate a single cell value given its field and the whole row. */
function cellInvalid(
  field: keyof DataPoint,
  dp: DataPoint,
): boolean {
  const v = dp[field];
  if (v === undefined || v === null) return false; // empty is allowed
  if (typeof v !== "number" || !Number.isFinite(v)) return true;
  if (v < 0) return true;
  // Cross-field validation
  if (field === "events1" && dp.total1 != null && v > dp.total1) return true;
  if (field === "total1" && dp.events1 != null && v < dp.events1) return true;
  if (field === "events2" && dp.total2 != null && v > dp.total2) return true;
  if (field === "total2" && dp.events2 != null && v < dp.events2) return true;
  if (
    (field === "sd1" || field === "sd2") &&
    v < 0
  )
    return true;
  return false;
}

export function DataGrid({ outcome, subgroupId = null }: Props) {
  const review = useReviewStore((s) => s.review);
  const upsertDataPoint = useReviewStore((s) => s.upsertDataPoint);
  const setDataPointValue = useReviewStore((s) => s.setDataPointValue);
  const deleteDataPoint = useReviewStore((s) => s.deleteDataPoint);

  const studies = review?.studies ?? [];
  const columns = COLUMNS[outcome.dataType];

  // Data points belonging to this scope (root or specific subgroup).
  const rows = useMemo(() => {
    if (subgroupId === null) {
      return outcome.dataPoints.filter((dp) => dp.subgroupId === null);
    }
    const sg = outcome.subgroups.find((s) => s.id === subgroupId);
    return sg?.dataPoints ?? [];
  }, [outcome, subgroupId]);

  function handleAddRow(studyId: string) {
    if (!studyId) {
      toast.error("Pick a study first");
      return;
    }
    upsertDataPoint(outcome.id, subgroupId, studyId, {});
  }

  return (
    <div className="space-y-3">
      {studies.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed border-muted-foreground/30 p-3 bg-muted/30">
          Add studies first from the Studies tab.
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[160px]">Study</TableHead>
            {columns.map((c) => (
              <TableHead key={c.field} className="min-w-[80px]">
                {c.label}
              </TableHead>
            ))}
            {outcome.dataType === "DTA_2x2" && (
              <TableHead className="w-10 text-center">🧮</TableHead>
            )}
            <TableHead className="w-10 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length + (outcome.dataType === "DTA_2x2" ? 3 : 2)}
                className="text-center text-muted-foreground text-xs py-6"
              >
                No data points yet — add a row below.
              </TableCell>
            </TableRow>
          )}

          {rows.map((dp) => {
            const study = studies.find((s) => s.id === dp.studyId);
            return (
              <DataRow
                key={dp.id}
                dp={dp}
                studyLabel={study?.label ?? "Unknown study"}
                columns={columns}
                dataType={outcome.dataType}
                onCommit={(field, value) =>
                  setDataPointValue(dp.id, field, value)
                }
                onDelete={() => {
                  deleteDataPoint(dp.id);
                  toast.success("Row deleted");
                }}
                onApplyDta={(values) => {
                  // Apply TP/FP/FN/TN atomically via upsert.
                  upsertDataPoint(outcome.id, subgroupId, dp.studyId, values);
                }}
              />
            );
          })}

          {/* Add row form */}
          <AddRowForm
            key={`${outcome.id}-${subgroupId ?? "root"}`}
            studies={studies}
            onAdd={handleAddRow}
            columnCount={columns.length + (outcome.dataType === "DTA_2x2" ? 3 : 2)}
          />
        </TableBody>
      </Table>

      <p className="text-[11px] text-muted-foreground">
        Tip: paste a tab-separated row from Excel directly into any cell — values
        will fill across the rest of the row.
      </p>
    </div>
  );
}

// ----- Single row component --------------------------------------------------

interface DataRowProps {
  dp: DataPoint;
  studyLabel: string;
  columns: ColumnDef[];
  dataType: DataType;
  onCommit: (field: keyof DataPoint, value: number | null) => void;
  onDelete: () => void;
  onApplyDta: (values: {
    tp: number;
    fp: number;
    fn: number;
    tn: number;
  }) => void;
}

function DataRow({
  dp,
  studyLabel,
  columns,
  dataType,
  onCommit,
  onDelete,
  onApplyDta,
}: DataRowProps) {
  const [dtaOpen, setDtaOpen] = useState(false);

  function handlePaste(
    e: ClipboardEvent<HTMLInputElement>,
    startFieldIndex: number,
  ) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // single value → let default happen
    e.preventDefault();
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const parts = firstLine.split("\t");
    parts.forEach((raw, i) => {
      const col = columns[startFieldIndex + i];
      if (!col) return;
      const trimmed = raw.trim();
      const parsed = trimmed === "" ? null : Number(trimmed);
      if (parsed !== null && !Number.isFinite(parsed)) return;
      onCommit(col.field, parsed);
    });
  }

  const dtaInitial = {
    tp: dp.tp ?? 0,
    fp: dp.fp ?? 0,
    fn: dp.fn ?? 0,
    tn: dp.tn ?? 0,
  };

  return (
    <TableRow>
      <TableCell className="font-medium truncate max-w-[200px]">
        {studyLabel}
      </TableCell>
      {columns.map((col, idx) => (
        <TableCell key={col.field}>
          <EditableCell
            value={dp[col.field] as number | null | undefined}
            invalid={cellInvalid(col.field, dp)}
            onCommit={(v) => onCommit(col.field, v)}
            onPaste={(e) => handlePaste(e, idx)}
          />
        </TableCell>
      ))}
      {dataType === "DTA_2x2" && (
        <TableCell className="text-center">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Open DTA calculator"
            onClick={() => setDtaOpen(true)}
          >
            <CalcIcon className="size-4" />
          </Button>
          <DtaCalculatorDialog
            open={dtaOpen}
            onClose={() => setDtaOpen(false)}
            initial={dtaInitial}
            onApply={(values) => {
              onApplyDta(values);
              toast.success("2×2 table applied");
            }}
          />
        </TableCell>
      )}
      <TableCell className="text-right">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-rose-600 hover:text-rose-700"
          title="Delete row"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ----- Editable cell ---------------------------------------------------------

function EditableCell({
  value,
  invalid,
  onCommit,
  onPaste,
}: {
  value: number | null | undefined;
  invalid: boolean;
  onCommit: (v: number | null) => void;
  onPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
}) {
  // `draft` is non-null only while the input is being edited. When null, the
  // displayed value is derived directly from the prop — so external store
  // updates (paste, DTA calculator apply) flow into the input without an
  // effect.
  const display =
    value != null && Number.isFinite(value) ? String(value) : "";
  const [draft, setDraft] = useState<string | null>(null);
  const current = draft ?? display;

  function commit() {
    if (draft === null) return; // no edit, no commit
    const trimmed = draft.trim();
    if (trimmed === "") {
      onCommit(null);
    } else {
      const n = Number(trimmed);
      if (Number.isFinite(n) && n !== (value ?? null)) {
        onCommit(n);
      }
    }
    setDraft(null);
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      value={current}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") setDraft(null);
      }}
      onPaste={onPaste}
      aria-invalid={invalid}
      className={cn(
        "h-8 w-[72px] tabular-nums",
        invalid && "border-rose-500 focus-visible:ring-rose-500/30",
      )}
    />
  );
}

// ----- Add row form (separate component so it remounts cleanly per outcome/subgroup) ---

function AddRowForm({
  studies,
  onAdd,
  columnCount,
}: {
  studies: { id: string; label: string }[];
  onAdd: (studyId: string) => void;
  columnCount: number;
}) {
  const [addStudyId, setAddStudyId] = useState<string>("");
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell>
        <Select value={addStudyId} onValueChange={setAddStudyId}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder="Pick study…" />
          </SelectTrigger>
          <SelectContent>
            {studies.map((st) => (
              <SelectItem key={st.id} value={st.id}>
                {st.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      {Array.from({ length: columnCount - 2 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-8 rounded-md bg-muted/60 border border-transparent" />
        </TableCell>
      ))}
      <TableCell className="text-right">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-teal-700"
          onClick={() => {
            onAdd(addStudyId);
            setAddStudyId("");
          }}
          disabled={!addStudyId}
          title="Add row"
        >
          <Plus className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
