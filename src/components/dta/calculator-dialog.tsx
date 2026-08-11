// src/components/dta/calculator-dialog.tsx
//
// 2x2-table diagnostic accuracy calculator dialog.
//
// Renders a 4-cell input grid (TP / FP / FN / TN) with auto-computed row &
// column totals, plus a live panel of Sens/Spec/PPV/NPV/LR+/LR-/Prevalence/DOR
// each with 95% CIs (Wilson for proportions, log-based for ratios — all handled
// by `calculateDta` from @/lib/dta/calculate).
//
// Layout matches the ASCII diagram from the master prompt §9 (calculator spec):
//
//        Disease +       Disease -      Total
//   ┌──────────────┬──────────────┬──────────┐
//   │      TP      │      FP      │ Test +   │
//   ├──────────────┼──────────────┼──────────┤
//   │      FN      │      TN      │ Test -   │
//   ├──────────────┼──────────────┼──────────┤
//   │ D+ total     │ D- total     │ N total  │
//   └──────────────┴──────────────┴──────────┘

"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  ClipboardCopy,
  RotateCcw,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  calculateDta,
  formatDtaResult,
  type DtaResult,
  type DtaInput,
} from "@/lib/dta/calculate";

export interface DtaCalculatorProps {
  open: boolean;
  onClose: () => void;
  initial?: { tp?: number; fp?: number; fn?: number; tn?: number };
  onApply?: (values: { tp: number; fp: number; fn: number; tn: number }) => void;
}

interface CellState {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

const EMPTY: CellState = { tp: 0, fp: 0, fn: 0, tn: 0 };

/** Parse a string into a non-negative integer; "" / NaN → 0. */
function parseCell(raw: string): number {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.floor(n);
}

/** True when every cell is a finite non-negative integer AND the sum > 0. */
function isValid(s: CellState): boolean {
  const vals = [s.tp, s.fp, s.fn, s.tn];
  return (
    vals.every((v) => Number.isFinite(v) && v >= 0) &&
    s.tp + s.fp + s.fn + s.tn > 0
  );
}

/** Format a numeric value (used for inputs: show "" for 0 to keep cells tidy). */
function fmtInputValue(v: number): string {
  return Number.isFinite(v) && v > 0 ? String(v) : "";
}

/** Format a metric value+CI pair as "value (lower – upper)". */
function fmtMetric(
  m: DtaResult["sensitivity"],
  asPercent: boolean,
): string {
  const fmt = (x: number) => {
    if (!Number.isFinite(x)) return "—";
    return asPercent ? `${(x * 100).toFixed(1)}%` : x.toFixed(2);
  };
  if (!Number.isFinite(m.value)) return "—";
  if (!Number.isFinite(m.ciLower) || !Number.isFinite(m.ciUpper)) {
    return fmt(m.value);
  }
  return `${fmt(m.value)} (${fmt(m.ciLower)} – ${fmt(m.ciUpper)})`;
}

export function DtaCalculatorDialog({
  open,
  onClose,
  initial,
  onApply,
}: DtaCalculatorProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        {/* Only mount the body when open, so useState re-seeds from `initial` on each open. */}
        {open ? (
          <DtaCalculatorBody
            initial={initial}
            onClose={onClose}
            onApply={onApply}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DtaCalculatorBody({
  initial,
  onClose,
  onApply,
}: Omit<DtaCalculatorProps, "open">) {
  const [state, setState] = useState<CellState>(() => ({
    tp: initial?.tp ?? 0,
    fp: initial?.fp ?? 0,
    fn: initial?.fn ?? 0,
    tn: initial?.tn ?? 0,
  }));
  // Raw string inputs so the user can type "1." / "" freely before commit.
  const [raw, setRaw] = useState<Record<keyof CellState, string>>(() => ({
    tp: fmtInputValue(initial?.tp ?? 0),
    fp: fmtInputValue(initial?.fp ?? 0),
    fn: fmtInputValue(initial?.fn ?? 0),
    tn: fmtInputValue(initial?.tn ?? 0),
  }));

  function commitField(field: keyof CellState, str: string) {
    setRaw((r) => ({ ...r, [field]: str }));
    const parsed = parseCell(str);
    setState((s) => ({ ...s, [field]: Number.isFinite(parsed) ? parsed : s[field] }));
  }

  function handleReset() {
    setState(EMPTY);
    setRaw({ tp: "", fp: "", fn: "", tn: "" });
  }

  async function handleCopy() {
    if (!isValid(state)) {
      toast.error("Cannot copy", { description: "Fix invalid cells first." });
      return;
    }
    const result = calculateDta(state as DtaInput);
    const text = formatDtaResult(result);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard unavailable", {
        description: "Browser blocked clipboard write.",
      });
    }
  }

  function handleOk() {
    if (!isValid(state)) {
      toast.error("Invalid 2x2 table", {
        description: "Use non-negative integers; at least one cell > 0.",
      });
      return;
    }
    if (onApply) {
      onApply({
        tp: state.tp,
        fp: state.fp,
        fn: state.fn,
        tn: state.tn,
      });
    }
    onClose();
  }

  const result: DtaResult | null = useMemo(() => {
    if (!isValid(state)) return null;
    return calculateDta(state as DtaInput);
  }, [state]);

  const totals = {
    testPlus: state.tp + state.fp,
    testMinus: state.fn + state.tn,
    diseasePlus: state.tp + state.fn,
    diseaseMinus: state.fp + state.tn,
    n: state.tp + state.fp + state.fn + state.tn,
  };

  const valid = isValid(state);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calculator className="size-5 text-teal-600" />
          DTA Calculator (2×2 table)
        </DialogTitle>
        <DialogDescription>
          Enter the four cell counts. Live results update below — Sensitivity,
          Specificity, PPV, NPV, LR+, LR−, Prevalence, DOR with 95% CIs.
        </DialogDescription>
      </DialogHeader>

      {/* 2×2 grid */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        {/* Header row */}
        <div className="text-xs font-medium text-muted-foreground text-center">
          Disease +
        </div>
        <div className="text-xs font-medium text-muted-foreground text-center">
          Disease −
        </div>
        <div className="text-xs font-medium text-muted-foreground text-center w-20">
          Total
        </div>

        {/* Row 1: TP / FP / Test+ total */}
        <CellInput
          label="TP"
          description="True positive"
          value={raw.tp}
          onChange={(s) => commitField("tp", s)}
          invalid={Number.isNaN(parseCell(raw.tp))}
        />
        <CellInput
          label="FP"
          description="False positive"
          value={raw.fp}
          onChange={(s) => commitField("fp", s)}
          invalid={Number.isNaN(parseCell(raw.fp))}
        />
        <ReadoutCell label="Test +" value={totals.testPlus} />

        {/* Row 2: FN / TN / Test- total */}
        <CellInput
          label="FN"
          description="False negative"
          value={raw.fn}
          onChange={(s) => commitField("fn", s)}
          invalid={Number.isNaN(parseCell(raw.fn))}
        />
        <CellInput
          label="TN"
          description="True negative"
          value={raw.tn}
          onChange={(s) => commitField("tn", s)}
          invalid={Number.isNaN(parseCell(raw.tn))}
        />
        <ReadoutCell label="Test −" value={totals.testMinus} />

        {/* Row 3: D+ total / D- total / N */}
        <ReadoutCell label="D+ total" value={totals.diseasePlus} />
        <ReadoutCell label="D− total" value={totals.diseaseMinus} />
        <ReadoutCell label="N" value={totals.n} highlight />
      </div>

      {!valid && (
        <p className="text-xs text-rose-600">
          Cells must be non-negative integers; at least one cell must be &gt; 0.
        </p>
      )}

      <Separator />

      {/* Live results */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-sm font-semibold">Results</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-left">
              <p className="font-medium mb-1">Formulas</p>
              <ul className="space-y-0.5 text-[10px] opacity-90">
                <li>Sens = TP / (TP+FN) — Wilson CI</li>
                <li>Spec = TN / (TN+FP) — Wilson CI</li>
                <li>PPV = TP / (TP+FP); NPV = TN / (TN+FN)</li>
                <li>LR+ = Sens / (1 − Spec); LR− = (1 − Sens) / Spec</li>
                <li>DOR = (TP·TN) / (FP·FN) — log-scale CI</li>
                <li>0.5 continuity correction applied to variance only.</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>

        {result ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <ResultRow label="Sensitivity" value={fmtMetric(result.sensitivity, true)} />
            <ResultRow label="Specificity" value={fmtMetric(result.specificity, true)} />
            <ResultRow label="PPV" value={fmtMetric(result.ppv, true)} />
            <ResultRow label="NPV" value={fmtMetric(result.npv, true)} />
            <ResultRow label="LR+" value={fmtMetric(result.lrPlus, false)} />
            <ResultRow label="LR−" value={fmtMetric(result.lrMinus, false)} />
            <ResultRow label="Prevalence" value={fmtMetric(result.prevalence, true)} />
            <ResultRow label="DOR" value={fmtMetric(result.dor, false)} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Enter at least one cell count to see results.
          </p>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={!valid}>
          <ClipboardCopy className="size-4" />
          Copy
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleOk} disabled={!valid} className="bg-teal-600 hover:bg-teal-700 text-white">
          OK
        </Button>
      </DialogFooter>
    </>
  );
}

// ----- Local sub-components --------------------------------------------------

function CellInput({
  label,
  description,
  value,
  onChange,
  invalid,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (s: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label
        htmlFor={`dta-${label}`}
        className="text-[10px] uppercase tracking-widest text-muted-foreground"
      >
        {description}
      </Label>
      <div className="relative">
        <span
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold",
            invalid ? "text-rose-500" : "text-teal-600",
          )}
        >
          {label}
        </span>
        <Input
          id={`dta-${label}`}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className={cn("pl-9 h-9 tabular-nums", invalid && "border-rose-500")}
        />
      </div>
    </div>
  );
}

function ReadoutCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="w-20 space-y-1">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <div
        className={cn(
          "h-9 flex items-center justify-center rounded-md border tabular-nums text-sm font-medium",
          highlight
            ? "bg-teal-50 dark:bg-teal-950 border-teal-300 text-teal-800 dark:text-teal-200"
            : "bg-muted/50 border-border text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}
