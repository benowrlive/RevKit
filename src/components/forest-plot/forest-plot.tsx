// src/components/forest-plot/forest-plot.tsx — intervention-review forest plot.
//
// Pure-SVG RevMan-style forest plot for DICHOTOMOUS / CONTINUOUS / OE_V / GIV
// outcomes. Per-study effects come from `computeEffect` (lib/stats/effect);
// pooling dispatches to MH (OR/RR), Peto, IV fixed, or DerSimonian-Laird
// random-effects based on `outcome.method` / `outcome.model`. Random model
// with IV/MH method overrides to DL on the per-study effects (per spec).
//
// The plot scales responsively (SVG `width="100%"` with `viewBox`). Includes
// "Download SVG" + "Download PNG" buttons in the header.

"use client";

import * as React from "react";
import { useRef } from "react";
import { useReviewStore } from "@/lib/project/state";
import type { Outcome, Study, DataPoint } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  downloadPNG,
  downloadSVG,
  formatEffectWithCI,
  formatNumber,
  formatP,
  linearTicks,
  logTicksOriginal,
  slugify,
  snapLinearRange,
  snapLogRange,
} from "./plot-utils";
import {
  buildPerStudyEffects,
  effectMeasureLabel,
  outcomeIsLogScale,
  poolOutcomeEffects,
} from "./pooling";

export interface ForestPlotProps {
  outcome: Outcome;
  /** Optional studies lookup; if omitted the component reads from the review store. */
  studies?: Study[];
  /** Optional subgroup filter — if provided, only data points in that subgroup are plotted. */
  subgroupId?: string | null;
}

// Layout constants (in viewBox units; SVG scales responsively).
const SVG_WIDTH = 900;
const ROW_HEIGHT = 26;
const PLOT_LEFT = 380;
const PLOT_RIGHT = 700;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const HEADER_TOP = 24;
const HEADER_SUBTOP = 44;
const COL_HEADER_TOP = 64;
const FIRST_ROW_TOP = 84;
const ARM1_X = 220;
const ARM2_X = 300;
const EFFECT_X = 708;
const WEIGHT_X = 884;
const LABEL_X = 12;

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
  arrow: "#475569",
};

/** Arrowhead polygon points at the plot edge pointing outward (left or right). */
function arrowheadPoints(x: number, y: number, dir: 1 | -1, size = 5): string {
  // dir=1 → rightward arrow (at left edge of clipped CI), dir=-1 → leftward.
  return `${x},${y} ${x + dir * size},${y - size / 2} ${x + dir * size},${y + size / 2}`;
}

/** Formatted arm-1 / arm-2 cell text for the data column. */
function armCellText(dp: DataPoint, dataType: Outcome["dataType"]): { arm1: string; arm2: string } {
  if (dataType === "DICHOTOMOUS") {
    return {
      arm1: `${dp.events1 ?? 0}/${dp.total1 ?? 0}`,
      arm2: `${dp.events2 ?? 0}/${dp.total2 ?? 0}`,
    };
  }
  if (dataType === "CONTINUOUS") {
    return {
      arm1: `${formatNumber(dp.mean1 ?? NaN)} (${formatNumber(dp.sd1 ?? NaN, 1)}) ${dp.n1 ?? 0}`,
      arm2: `${formatNumber(dp.mean2 ?? NaN)} (${formatNumber(dp.sd2 ?? NaN, 1)}) ${dp.n2 ?? 0}`,
    };
  }
  if (dataType === "OE_V") {
    return {
      arm1: `O−E ${formatNumber(dp.oE ?? NaN)}`,
      arm2: `V ${formatNumber(dp.v ?? NaN)}`,
    };
  }
  // GIV
  return {
    arm1: `Eff ${formatNumber(dp.effect ?? NaN)}`,
    arm2: `SE ${formatNumber(dp.se ?? NaN)}`,
  };
}

export function ForestPlot({ outcome, studies: studiesProp, subgroupId }: ForestPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const storeStudies = useReviewStore((s) => s.review?.studies ?? []);
  const studies = studiesProp ?? storeStudies;
  const studiesById = React.useMemo(() => {
    const m = new Map<string, Study>();
    for (const s of studies) m.set(s.id, s);
    return m;
  }, [studies]);

  // Filter data points (optionally by subgroup), keep only those with non-null key cells.
  const dataPoints = React.useMemo(() => {
    const all = outcome.dataPoints ?? [];
    const filtered = subgroupId ? all.filter((dp) => dp.subgroupId === subgroupId) : all;
    return [...filtered].sort((a, b) => a.order - b.order);
  }, [outcome.dataPoints, subgroupId]);

  // DTA_2x2 outcomes are not supported here — render empty state.
  if (outcome.dataType === "DTA_2x2") {
    return (
      <EmptyState
        title="Forest plot not available for diagnostic outcomes"
        subtitle="Use the DTA Forest Plot for sensitivity / specificity panels."
      />
    );
  }

  const { effects, dichStudies, validDp } = buildPerStudyEffects(outcome, dataPoints);
  const pooled = poolOutcomeEffects(outcome, effects, dichStudies);

  if (effects.length === 0 || !pooled) {
    return (
      <EmptyState
        title="No data yet"
        subtitle="Add studies and data points to see the forest plot."
      />
    );
  }

  // ---- X-axis range ------------------------------------------------------
  const isLogScale = outcomeIsLogScale(outcome);
  const allLower = effects.map((e) => (isLogScale ? Math.log(e.ciLower) : e.ciLower));
  const allUpper = effects.map((e) => (isLogScale ? Math.log(e.ciUpper) : e.ciUpper));
  let minVal = Math.min(...allLower, pooled.ciLower);
  let maxVal = Math.max(...allUpper, pooled.ciUpper);
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    minVal = isLogScale ? Math.log(0.5) : -1;
    maxVal = isLogScale ? Math.log(2) : 1;
  }
  const { xMin, xMax } = isLogScale
    ? snapLogRange(Math.exp(minVal), Math.exp(maxVal))
    : snapLinearRange(minVal, maxVal);

  // Map a theta value to a plot x-pixel.
  const toX = (theta: number): number => {
    const ratio = (theta - xMin) / (xMax - xMin || 1);
    return PLOT_LEFT + ratio * PLOT_WIDTH;
  };

  // Build tick list (on the original scale for log display, raw for linear).
  const ticks = isLogScale
    ? logTicksOriginal(Math.exp(xMin), Math.exp(xMax))
    : linearTicks(xMin, xMax);

  // Null effect line: x=1 (log scale) or x=0 (linear).
  const nullX = toX(isLogScale ? 0 : 0);
  const nullVisible = nullX >= PLOT_LEFT && nullX <= PLOT_RIGHT;

  // ---- Layout height -----------------------------------------------------
  const N = effects.length;
  const rowTop = (i: number) => FIRST_ROW_TOP + i * ROW_HEIGHT;
  const pooledY = rowTop(N) + 4; // small gap below last study
  const diamondCenterY = pooledY + 7;
  const axisY = pooledY + 22;
  const tickLabelY = axisY + 16;
  const axisTitleY = axisY + 32;
  const hetY = axisY + 54;
  const testY = axisY + 72;
  const totalHeight = testY + 24;
  const plotTop = FIRST_ROW_TOP - 6;
  const plotBottom = axisY - 2;

  // Max weight for square scaling.
  const maxWeight = Math.max(...pooled.weight, 0.0001);

  // Format pooled effect on original scale for display.
  const pooledEffectDisplay = pooled.isLogScale
    ? pooled.effectOnOriginalScale
    : pooled.effect;
  const pooledLoDisplay = pooled.isLogScale ? pooled.ciLowerOriginal : pooled.ciLower;
  const pooledHiDisplay = pooled.isLogScale ? pooled.ciUpperOriginal : pooled.ciUpper;

  const filename = slugify(`forest-${outcome.name}`);

  // ---- Render ------------------------------------------------------------
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
        aria-label={`Forest plot for ${outcome.name}`}
      >
        {/* Header */}
        <text x={LABEL_X} y={HEADER_TOP} fontSize={15} fontWeight={600} fill={COLORS.ink}>
          {outcome.name}
        </text>
        <text x={LABEL_X} y={HEADER_SUBTOP} fontSize={12} fill={COLORS.subink}>
          {effectMeasureLabel(outcome)} · {outcome.method} · {outcome.model} model
        </text>

        {/* Column headers */}
        <text x={LABEL_X} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink}>
          Study
        </text>
        {outcome.dataType === "DICHOTOMOUS" || outcome.dataType === "CONTINUOUS" ? (
          <>
            <text x={ARM1_X + 40} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
              {outcome.dataType === "DICHOTOMOUS" ? "Experimental" : "Mean (SD) N"}
            </text>
            <text x={ARM2_X + 40} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
              {outcome.dataType === "DICHOTOMOUS" ? "Control" : "Mean (SD) N"}
            </text>
          </>
        ) : (
          <text x={ARM1_X + 80} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
            {outcome.dataType === "OE_V" ? "O−E, V" : "Effect, SE"}
          </text>
        )}
        <text x={PLOT_LEFT + PLOT_WIDTH / 2} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
          {effectMeasureLabel(outcome)} (95% CI)
        </text>
        <text x={EFFECT_X + 56} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
          {effectMeasureLabel(outcome)} [95% CI]
        </text>
        <text x={WEIGHT_X} y={COL_HEADER_TOP} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="end">
          Weight %
        </text>

        {/* Null-effect line (dashed vertical) */}
        {nullVisible && (
          <line
            x1={nullX}
            y1={plotTop}
            x2={nullX}
            y2={plotBottom}
            stroke={COLORS.nullLine}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Per-study rows */}
        {effects.map((eff, i) => {
          const dp = validDp[i];
          const study = studiesById.get(dp.studyId);
          const label = study?.label ?? `Study ${i + 1}`;
          const year = study?.year;
          const labelText = year ? `${label} (${year})` : label;
          const yCenter = rowTop(i) + ROW_HEIGHT / 2;
          const theta = isLogScale ? Math.log(eff.effect) : eff.effect;
          const thetaLower = isLogScale ? Math.log(eff.ciLower) : eff.ciLower;
          const thetaUpper = isLogScale ? Math.log(eff.ciUpper) : eff.ciUpper;
          const cx = toX(theta);
          const loX = toX(thetaLower);
          const hiX = toX(thetaUpper);
          const weight = pooled.weight[i] ?? 0;
          const side = 4 + 12 * Math.sqrt(weight / maxWeight);
          const arm = armCellText(dp, outcome.dataType);

          const clippedLo = Math.max(PLOT_LEFT, loX);
          const clippedHi = Math.min(PLOT_RIGHT, hiX);
          const loOff = loX < PLOT_LEFT;
          const hiOff = hiX > PLOT_RIGHT;

          return (
            <g key={dp.id}>
              {/* Label */}
              <text x={LABEL_X} y={yCenter + 4} fontSize={11} fill={COLORS.ink}>
                {labelText.length > 36 ? labelText.slice(0, 34) + "…" : labelText}
              </text>
              {/* Arm data */}
              <text x={ARM1_X + (outcome.dataType === "DICHOTOMOUS" || outcome.dataType === "CONTINUOUS" ? 40 : 80)} y={yCenter + 4} fontSize={11} fill={COLORS.subink} textAnchor="middle">
                {arm.arm1}
              </text>
              <text x={ARM2_X + (outcome.dataType === "DICHOTOMOUS" || outcome.dataType === "CONTINUOUS" ? 40 : 0)} y={yCenter + 4} fontSize={11} fill={COLORS.subink} textAnchor={outcome.dataType === "DICHOTOMOUS" || outcome.dataType === "CONTINUOUS" ? "middle" : "start"}>
                {arm.arm2}
              </text>
              {/* CI whisker */}
              <line
                x1={clippedLo}
                y1={yCenter}
                x2={clippedHi}
                y2={yCenter}
                stroke={COLORS.whisker}
                strokeWidth={1.5}
              />
              {/* Whisker caps (only if not clipped) */}
              {!loOff && (
                <line x1={clippedLo} y1={yCenter - 4} x2={clippedLo} y2={yCenter + 4} stroke={COLORS.whisker} strokeWidth={1.5} />
              )}
              {!hiOff && (
                <line x1={clippedHi} y1={yCenter - 4} x2={clippedHi} y2={yCenter + 4} stroke={COLORS.whisker} strokeWidth={1.5} />
              )}
              {/* Arrowheads for out-of-range CIs */}
              {loOff && (
                <polygon
                  points={arrowheadPoints(PLOT_LEFT, yCenter, -1)}
                  fill={COLORS.arrow}
                />
              )}
              {hiOff && (
                <polygon
                  points={arrowheadPoints(PLOT_RIGHT, yCenter, 1)}
                  fill={COLORS.arrow}
                />
              )}
              {/* Square (area ∝ weight) */}
              {cx >= PLOT_LEFT && cx <= PLOT_RIGHT && (
                <rect
                  x={cx - side / 2}
                  y={yCenter - side / 2}
                  width={side}
                  height={side}
                  fill={COLORS.box}
                  stroke={COLORS.boxStroke}
                  strokeWidth={1}
                />
              )}
              {/* Effect text */}
              <text x={EFFECT_X} y={yCenter + 4} fontSize={11} fill={COLORS.ink}>
                {formatEffectWithCI(eff.effect, eff.ciLower, eff.ciUpper)}
              </text>
              {/* Weight % */}
              <text x={WEIGHT_X} y={yCenter + 4} fontSize={11} fill={COLORS.subink} textAnchor="end">
                {(weight * 100).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Pooled diamond */}
        {(() => {
          const pooledTheta = isLogScale ? Math.log(pooledEffectDisplay) : pooledEffectDisplay;
          const pooledLoTheta = isLogScale ? Math.log(pooledLoDisplay) : pooledLoDisplay;
          const pooledHiTheta = isLogScale ? Math.log(pooledHiDisplay) : pooledHiDisplay;
          const cx = toX(pooledTheta);
          const loX = toX(pooledLoTheta);
          const hiX = toX(pooledHiTheta);
          const left = loX < PLOT_LEFT ? PLOT_LEFT : loX;
          const right = hiX > PLOT_RIGHT ? PLOT_RIGHT : hiX;
          return (
            <g>
              {/* "Subtotal / Overall" label */}
              <text x={LABEL_X} y={diamondCenterY + 4} fontSize={11} fontWeight={600} fill={COLORS.ink}>
                {outcome.model === "random" ? "Random effects" : "Fixed effect"} ({outcome.method})
              </text>
              <polygon
                points={`${cx},${diamondCenterY - 7} ${right},${diamondCenterY} ${cx},${diamondCenterY + 7} ${left},${diamondCenterY}`}
                fill={COLORS.diamond}
                stroke={COLORS.diamondStroke}
                strokeWidth={1}
              />
              {loX < PLOT_LEFT && (
                <polygon points={arrowheadPoints(PLOT_LEFT, diamondCenterY, -1)} fill={COLORS.arrow} />
              )}
              {hiX > PLOT_RIGHT && (
                <polygon points={arrowheadPoints(PLOT_RIGHT, diamondCenterY, 1)} fill={COLORS.arrow} />
              )}
              <text x={EFFECT_X} y={diamondCenterY + 4} fontSize={11} fontWeight={600} fill={COLORS.ink}>
                {formatEffectWithCI(pooledEffectDisplay, pooledLoDisplay, pooledHiDisplay)}
              </text>
              <text x={WEIGHT_X} y={diamondCenterY + 4} fontSize={11} fill={COLORS.subink} textAnchor="end">
                100.0
              </text>
            </g>
          );
        })()}

        {/* X-axis line */}
        <line x1={PLOT_LEFT} y1={axisY} x2={PLOT_RIGHT} y2={axisY} stroke={COLORS.rule} strokeWidth={1} />
        {/* Ticks */}
        {ticks.map((tick, idx) => {
          const tickTheta = isLogScale ? Math.log(tick) : tick;
          if (tickTheta < xMin - 1e-9 || tickTheta > xMax + 1e-9) return null;
          const x = toX(tickTheta);
          const label = isLogScale ? formatNumber(tick, tick < 1 ? 3 : 2) : formatNumber(tick, 2);
          return (
            <g key={`tick-${idx}`}>
              <line x1={x} y1={axisY} x2={x} y2={axisY + 4} stroke={COLORS.rule} strokeWidth={1} />
              <text x={x} y={tickLabelY} fontSize={10} fill={COLORS.subink} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
        <text x={PLOT_LEFT + PLOT_WIDTH / 2} y={axisTitleY} fontSize={11} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
          {effectMeasureLabel(outcome)}{isLogScale ? " (log scale)" : ""}
        </text>

        {/* Heterogeneity annotation */}
        <text x={LABEL_X} y={hetY} fontSize={11} fill={COLORS.subink}>
          Heterogeneity: τ² = {formatNumber(pooled.tau2)}; χ² = {formatNumber(pooled.Q)}, df = {pooled.df} (P = {formatP(pooled.pValueHeterogeneity)}); I² = {(pooled.I2 * 100).toFixed(0)}%
        </text>
        {/* Test for overall effect */}
        <text x={LABEL_X} y={testY} fontSize={11} fill={COLORS.subink}>
          Test for overall effect: Z = {formatNumber(pooled.z)} (P = {formatP(pooled.pValue)})
        </text>
      </svg>
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="p-6 text-center text-muted-foreground">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs opacity-70">{subtitle}</div>
    </Card>
  );
}

export default ForestPlot;
