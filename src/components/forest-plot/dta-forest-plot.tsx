// src/components/forest-plot/dta-forest-plot.tsx — diagnostic-test-accuracy
// forest plot. Renders two side-by-side mini forest plots: Sensitivity (left)
// and Specificity (right). Per-study proportions use Wilson 95% CIs; pooled
// estimates come from `univariateLogitSensitivity` / `univariateLogitSpecificity`
// (random-effects when `outcome.model === "random"`). Per-study weights are
// extracted by calling the equivalent IV / DL pooling on the logit-scale
// effects (the spec's `UnivariateSensitivity` interface does not expose the
// weight array).

"use client";

import * as React from "react";
import { useRef } from "react";
import {
  univariateLogitSensitivity,
  univariateLogitSpecificity,
  inverseVarianceFixed,
  derSimonianLaird,
  type EffectInput,
  type DtaStudy,
  type Heterogeneity,
} from "@/lib/stats";
import type { Outcome, Study, DataPoint } from "@/lib/types";
import { useReviewStore } from "@/lib/project/state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  downloadPNG,
  downloadSVG,
  formatPercent,
  formatP,
  formatNumber,
  slugify,
  withDtaCc,
  wilsonCI,
} from "./plot-utils";

export interface DtaForestPlotProps {
  outcome: Outcome;
  studies?: Study[];
}

const SVG_WIDTH = 1080;
const ROW_HEIGHT = 26;
const PANEL_WIDTH = 540;
const LEFT_PANEL_X = 0;
const RIGHT_PANEL_X = 540;
const PLOT_LEFT_OFFSET = 180;
const PLOT_WIDTH = 280;
const FIRST_ROW_TOP = 84;
const HEADER_TOP = 24;
const HEADER_SUBTOP = 44;
const COL_HEADER_TOP = 64;
const LABEL_X_OFFSET = 12;
const EFFECT_X_OFFSET = 470;
const WEIGHT_X_OFFSET = 528;

const COLORS = {
  ink: "#0f172a",
  subink: "#475569",
  faint: "#94a3b8",
  rule: "#cbd5e1",
  diamond: "#047857",
  diamondStroke: "#065f46",
  box: "#10b981",
  boxStroke: "#047857",
  whisker: "#334155",
  nullLine: "#94a3b8",
};

const TICKS = [0, 0.25, 0.5, 0.75, 1];

interface PerStudyRow {
  dp: DataPoint;
  prop: number;       // 0..1
  ciLower: number;   // 0..1
  ciUpper: number;   // 0..1
  weight: number;    // 0..1
}

/** Extract DTA studies from outcome data points (filters out rows with no 2x2 data). */
function extractDtaStudies(outcome: Outcome): { dp: DataPoint; study: DtaStudy }[] {
  const rows: { dp: DataPoint; study: DtaStudy }[] = [];
  for (const dp of outcome.dataPoints ?? []) {
    const tp = dp.tp ?? 0;
    const fp = dp.fp ?? 0;
    const fn = dp.fn ?? 0;
    const tn = dp.tn ?? 0;
    if (tp + fn === 0 && fp + tn === 0) continue;
    rows.push({ dp, study: { tp, fp, fn, tn } });
  }
  rows.sort((a, b) => a.dp.order - b.dp.order);
  return rows;
}

/**
 * Build a per-study row list for either the Sensitivity or Specificity panel.
 *
 * - `mode === "sens"`: per-study prop = TP/(TP+FN) with Wilson CI; pooled via
 *   `univariateLogitSensitivity`. Weights derived by replicating the logit
 *   pooling (IV fixed / DL) which gives the same weight array as the engine
 *   function (the spec's UnivariateSensitivity doesn't expose weights).
 * - `mode === "spec"`: per-study prop = TN/(TN+FP) with Wilson CI; pooled via
 *   `univariateLogitSpecificity`.
 */
function buildPanelRows(
  rows: { dp: DataPoint; study: DtaStudy }[],
  mode: "sens" | "spec",
  isRandom: boolean,
): {
  rows: PerStudyRow[];
  pooled: { value: number; ciLower: number; ciUpper: number };
  heterogeneity: Heterogeneity;
} {
  const dtaStudies = rows.map((r) => r.study);

  // Per-study proportions with Wilson CI.
  const perStudyProp: { prop: number; ciLower: number; ciUpper: number }[] = dtaStudies.map((s) => {
    if (mode === "sens") {
      const denom = s.tp + s.fn;
      const w = wilsonCI(s.tp, denom);
      return { prop: w.p, ciLower: w.lower, ciUpper: w.upper };
    }
    const denom = s.tn + s.fp;
    const w = wilsonCI(s.tn, denom);
    return { prop: w.p, ciLower: w.lower, ciUpper: w.upper };
  });

  // Pooled estimate + heterogeneity via the engine.
  let pooledValue: number;
  let pooledLo: number;
  let pooledHi: number;
  let het: Heterogeneity;
  if (mode === "sens") {
    const r = univariateLogitSensitivity(dtaStudies, isRandom);
    pooledValue = r.pooled.sens;
    pooledLo = r.pooled.ciLower;
    pooledHi = r.pooled.ciUpper;
    het = r.heterogeneity;
  } else {
    const r = univariateLogitSpecificity(dtaStudies, isRandom);
    pooledValue = r.pooled.spec;
    pooledLo = r.pooled.ciLower;
    pooledHi = r.pooled.ciUpper;
    het = r.heterogeneity;
  }

  // Replicate logit pooling to extract weights.
  const logitEffects: EffectInput[] = dtaStudies.map((s) => {
    const cc = withDtaCc(s);
    if (mode === "sens") {
      return { theta: Math.log(cc.tp / cc.fn), se: Math.sqrt(1 / cc.tp + 1 / cc.fn) };
    }
    return { theta: Math.log(cc.tn / cc.fp), se: Math.sqrt(1 / cc.tn + 1 / cc.fp) };
  });
  const pooledForWeights = isRandom
    ? derSimonianLaird(logitEffects, true)
    : inverseVarianceFixed(logitEffects, true);

  // Sanity: pooledForWeights.effect should equal the engine's logit pooled value.
  // (We use the engine result for display; weights from the replicated pooler.)
  void pooledForWeights.effect;

  const perStudyRows: PerStudyRow[] = rows.map((r, i) => ({
    dp: r.dp,
    prop: perStudyProp[i].prop,
    ciLower: perStudyProp[i].ciLower,
    ciUpper: perStudyProp[i].ciUpper,
    weight: pooledForWeights.weight[i] ?? 0,
  }));

  return {
    rows: perStudyRows,
    pooled: { value: pooledValue, ciLower: pooledLo, ciUpper: pooledHi },
    heterogeneity: het,
  };
}

/** Render one panel (Sensitivity or Specificity) of the DTA forest plot. */
function DtaPanel({
  panelTitle,
  originX,
  rows,
  pooled,
  heterogeneity,
  studiesById,
  isRandom,
}: {
  panelTitle: string;
  originX: number;
  rows: PerStudyRow[];
  pooled: { value: number; ciLower: number; ciUpper: number };
  heterogeneity: Heterogeneity;
  studiesById: Map<string, Study>;
  isRandom: boolean;
}) {
  const N = rows.length;
  const plotLeft = originX + PLOT_LEFT_OFFSET;
  const plotRight = plotLeft + PLOT_WIDTH;
  const effectX = originX + EFFECT_X_OFFSET;
  const weightX = originX + WEIGHT_X_OFFSET;
  const labelX = originX + LABEL_X_OFFSET;

  // Map proportion (0..1) to plot x.
  const toX = (p: number) => plotLeft + p * PLOT_WIDTH;

  const rowTop = (i: number) => FIRST_ROW_TOP + i * ROW_HEIGHT;
  const pooledY = rowTop(N) + 4;
  const diamondCenterY = pooledY + 7;
  const axisY = pooledY + 22;
  const tickLabelY = axisY + 16;
  const axisTitleY = axisY + 32;
  const hetY = axisY + 54;

  const maxWeight = Math.max(...rows.map((r) => r.weight), 0.0001);
  const nullX = toX(0.5);
  const plotTop = FIRST_ROW_TOP - 6;
  const plotBottom = axisY - 2;

  return (
    <g>
      {/* Header */}
      <text x={labelX} y={HEADER_TOP} fontSize={15} fontWeight={600} fill={COLORS.ink}>
        {panelTitle}
      </text>
      <text x={labelX} y={HEADER_SUBTOP} fontSize={12} fill={COLORS.subink}>
        {isRandom ? "Random-effects (logit, DerSimonian-Laird)" : "Fixed-effect (logit, inverse variance)"}
      </text>

      {/* Column headers */}
      <text x={labelX} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink}>
        Study
      </text>
      <text x={plotLeft + PLOT_WIDTH / 2} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
        {panelTitle} (95% CI)
      </text>
      <text x={effectX + 30} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
        {panelTitle} [95% CI]
      </text>
      <text x={weightX} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="end">
        Weight %
      </text>

      {/* Null (50%) line */}
      <line x1={nullX} y1={plotTop} x2={nullX} y2={plotBottom} stroke={COLORS.nullLine} strokeWidth={1} strokeDasharray="4 3" />

      {/* Per-study rows */}
      {rows.map((r, i) => {
        const study = studiesById.get(r.dp.studyId);
        const label = study?.label ?? `Study ${i + 1}`;
        const year = study?.year;
        const labelText = year ? `${label} (${year})` : label;
        const yCenter = rowTop(i) + ROW_HEIGHT / 2;
        const cx = toX(r.prop);
        const loX = toX(r.ciLower);
        const hiX = toX(r.ciUpper);
        const side = 4 + 12 * Math.sqrt(r.weight / maxWeight);
        return (
          <g key={r.dp.id}>
            <text x={labelX} y={yCenter + 4} fontSize={11} fill={COLORS.ink}>
              {labelText.length > 26 ? labelText.slice(0, 24) + "…" : labelText}
            </text>
            {/* CI whisker */}
            <line x1={loX} y1={yCenter} x2={hiX} y2={yCenter} stroke={COLORS.whisker} strokeWidth={1.5} />
            <line x1={loX} y1={yCenter - 4} x2={loX} y2={yCenter + 4} stroke={COLORS.whisker} strokeWidth={1.5} />
            <line x1={hiX} y1={yCenter - 4} x2={hiX} y2={yCenter + 4} stroke={COLORS.whisker} strokeWidth={1.5} />
            {/* Square */}
            <rect
              x={cx - side / 2}
              y={yCenter - side / 2}
              width={side}
              height={side}
              fill={COLORS.box}
              stroke={COLORS.boxStroke}
              strokeWidth={1}
            />
            {/* Effect text */}
            <text x={effectX} y={yCenter + 4} fontSize={11} fill={COLORS.ink}>
              {formatPercent(r.prop)} [{formatPercent(r.ciLower)}, {formatPercent(r.ciUpper)}]
            </text>
            {/* Weight % */}
            <text x={weightX} y={yCenter + 4} fontSize={11} fill={COLORS.subink} textAnchor="end">
              {(r.weight * 100).toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Pooled diamond */}
      {(() => {
        const cx = toX(pooled.value);
        const loX = toX(pooled.ciLower);
        const hiX = toX(pooled.ciUpper);
        return (
          <g>
            <text x={labelX} y={diamondCenterY + 4} fontSize={11} fontWeight={600} fill={COLORS.ink}>
              Pooled ({isRandom ? "random" : "fixed"})
            </text>
            <polygon
              points={`${cx},${diamondCenterY - 7} ${hiX},${diamondCenterY} ${cx},${diamondCenterY + 7} ${loX},${diamondCenterY}`}
              fill={COLORS.diamond}
              stroke={COLORS.diamondStroke}
              strokeWidth={1}
            />
            <text x={effectX} y={diamondCenterY + 4} fontSize={11} fontWeight={600} fill={COLORS.ink}>
              {formatPercent(pooled.value)} [{formatPercent(pooled.ciLower)}, {formatPercent(pooled.ciUpper)}]
            </text>
            <text x={weightX} y={diamondCenterY + 4} fontSize={11} fill={COLORS.subink} textAnchor="end">
              100.0
            </text>
          </g>
        );
      })()}

      {/* X-axis */}
      <line x1={plotLeft} y1={axisY} x2={plotRight} y2={axisY} stroke={COLORS.rule} strokeWidth={1} />
      {TICKS.map((t, idx) => (
        <g key={`tick-${idx}`}>
          <line x1={toX(t)} y1={axisY} x2={toX(t)} y2={axisY + 4} stroke={COLORS.rule} strokeWidth={1} />
          <text x={toX(t)} y={tickLabelY} fontSize={10} fill={COLORS.subink} textAnchor="middle">
            {(t * 100).toFixed(0)}%
          </text>
        </g>
      ))}
      <text x={plotLeft + PLOT_WIDTH / 2} y={axisTitleY} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
        {panelTitle}
      </text>

      {/* Heterogeneity annotation */}
      <text x={labelX} y={hetY} fontSize={11} fill={COLORS.subink}>
        Heterogeneity: τ² = {formatNumber(heterogeneity.tau2)}; χ² = {formatNumber(heterogeneity.Q)}, df = {heterogeneity.df} (P = {formatP(heterogeneity.pValue)}); I² = {(heterogeneity.I2 * 100).toFixed(0)}%
      </text>
    </g>
  );
}

export function DtaForestPlot({ outcome, studies: studiesProp }: DtaForestPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const storeStudies = useReviewStore((s) => s.review?.studies ?? []);
  const studies = studiesProp ?? storeStudies;
  const studiesById = React.useMemo(() => {
    const m = new Map<string, Study>();
    for (const s of studies) m.set(s.id, s);
    return m;
  }, [studies]);

  if (outcome.dataType !== "DTA_2x2") {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <div className="text-sm font-medium">DTA forest plot not available</div>
        <div className="mt-1 text-xs opacity-70">
          The DTA forest plot requires a diagnostic outcome (DTA_2x2 data type).
        </div>
      </Card>
    );
  }

  const dtaRows = extractDtaStudies(outcome);
  if (dtaRows.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <div className="text-sm font-medium">No DTA data yet</div>
        <div className="mt-1 text-xs opacity-70">
          Add studies and 2×2 data (TP / FP / FN / TN) to see the DTA forest plot.
        </div>
      </Card>
    );
  }

  const isRandom = outcome.model === "random";
  const sensPanel = buildPanelRows(dtaRows, "sens", isRandom);
  const specPanel = buildPanelRows(dtaRows, "spec", isRandom);

  // Layout heights — each panel has the same number of rows so heights match.
  const N = dtaRows.length;
  const axisY = FIRST_ROW_TOP + N * ROW_HEIGHT + 4 + 22;
  const hetY = axisY + 54;
  const totalHeight = hetY + 24;

  const filename = slugify(`dta-forest-${outcome.name}`);

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => svgRef.current && downloadSVG(svgRef.current, `${filename}.svg`)}
        >
          Download SVG
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => svgRef.current && downloadPNG(svgRef.current, `${filename}.png`)}
        >
          Download PNG
        </Button>
      </div>
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${SVG_WIDTH} ${totalHeight}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", width: "100%", height: "auto", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        role="img"
        aria-label={`DTA forest plot for ${outcome.name}`}
      >
        <DtaPanel
          panelTitle="Sensitivity"
          originX={LEFT_PANEL_X}
          rows={sensPanel.rows}
          pooled={sensPanel.pooled}
          heterogeneity={sensPanel.heterogeneity}
          studiesById={studiesById}
          isRandom={isRandom}
        />
        <DtaPanel
          panelTitle="Specificity"
          originX={RIGHT_PANEL_X}
          rows={specPanel.rows}
          pooled={specPanel.pooled}
          heterogeneity={specPanel.heterogeneity}
          studiesById={studiesById}
          isRandom={isRandom}
        />
      </svg>
    </div>
  );
}

export default DtaForestPlot;
