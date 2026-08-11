// src/components/forest-plot/funnel-plot.tsx — funnel plot for visualising
// publication bias in intervention reviews.
//
// X-axis: per-study effect (log-scale for ratio measures, linear for
// differences). Y-axis: standard error (inverted — larger studies with
// smaller SE appear at the top).
//
// The plot draws:
//  - One circle per study at (theta_i, se_i).
//  - A vertical line at the pooled effect.
//  - Two diagonal pseudo-95% CI lines from the apex (pooled, 0) outward at
//    ±1.96·SE, forming the "funnel" triangular region.
//
// Asymmetry (studies clustering outside the funnel on one side) suggests
// potential publication bias — we visualize only; no Egger's test is computed.

"use client";

import * as React from "react";
import { useRef } from "react";
import { useReviewStore } from "@/lib/project/state";
import type { Outcome, Study } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  downloadPNG,
  downloadSVG,
  formatNumber,
  logTicksOriginal,
  slugify,
  snapLogRange,
  snapLinearRange,
  Z95,
} from "./plot-utils";
import {
  buildPerStudyEffects,
  effectMeasureLabel,
  outcomeIsLogScale,
  poolOutcomeEffects,
} from "./pooling";

export interface FunnelPlotProps {
  outcome: Outcome;
  studies?: Study[];
}

const SVG_WIDTH = 640;
const SVG_HEIGHT = 560;
const MARGIN = { top: 60, right: 40, bottom: 60, left: 70 };
const PLOT_LEFT = MARGIN.left;
const PLOT_RIGHT = SVG_WIDTH - MARGIN.right;
const PLOT_TOP = MARGIN.top;
const PLOT_BOTTOM = SVG_HEIGHT - MARGIN.bottom;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

const COLORS = {
  ink: "#0f172a",
  subink: "#475569",
  faint: "#94a3b8",
  rule: "#cbd5e1",
  grid: "#e2e8f0",
  study: "#0ea5e9",
  studyStroke: "#0369a1",
  funnel: "#94a3b8",
  funnelFill: "#e2e8f0",
  pooled: "#dc2626",
};

const TICK_FRAC = [0, 0.2, 0.4, 0.6, 0.8, 1];

export function FunnelPlot({ outcome, studies: studiesProp }: FunnelPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const storeStudies = useReviewStore((s) => s.review?.studies ?? []);
  const studies = studiesProp ?? storeStudies;
  const studiesById = React.useMemo(() => {
    const m = new Map<string, Study>();
    for (const s of studies) m.set(s.id, s);
    return m;
  }, [studies]);
  // (studies prop is consulted for the future tooltip labels; not rendered as
  // part of the funnel itself, but we keep it bound to avoid React's unused-var
  // warnings and so consumers can pass study metadata in the future.)
  void studiesById;

  const dataPoints = React.useMemo(() => {
    return [...(outcome.dataPoints ?? [])].sort((a, b) => a.order - b.order);
  }, [outcome.dataPoints]);

  if (outcome.dataType === "DTA_2x2") {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <div className="text-sm font-medium">Funnel plot not available</div>
        <div className="mt-1 text-xs opacity-70">
          Funnel plots are intended for intervention reviews. DTA outcomes use the SROC plot instead.
        </div>
      </Card>
    );
  }

  const { effects, dichStudies } = buildPerStudyEffects(outcome, dataPoints);
  const pooled = poolOutcomeEffects(outcome, effects, dichStudies);

  if (effects.length === 0 || !pooled) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <div className="text-sm font-medium">No data yet</div>
        <div className="mt-1 text-xs opacity-70">
          Add studies and data points to see the funnel plot.
        </div>
      </Card>
    );
  }

  const isLogScale = outcomeIsLogScale(outcome);

  // Per-study theta values (already on log scale for ratios).
  const thetas = effects.map((e) => e.theta);
  const ses = effects.map((e) => e.se);
  const maxSE = Math.max(...ses, 0.0001);

  // Pooled effect (on theta scale).
  const pooledTheta = pooled.effect;

  // X-axis range: pooled ± 1.96·maxSE (covers the pseudo-95% CI triangle)
  // plus padding so the studies don't sit on the frame.
  const xLower = Math.min(pooledTheta - Z95 * maxSE, ...thetas);
  const xUpper = Math.max(pooledTheta + Z95 * maxSE, ...thetas);
  const { xMin, xMax } = isLogScale
    ? snapLogRange(Math.exp(xLower), Math.exp(xUpper))
    : snapLinearRange(xLower, xUpper);

  // Coordinate transforms.
  const toX = (theta: number) => PLOT_LEFT + ((theta - xMin) / (xMax - xMin || 1)) * PLOT_WIDTH;
  const toY = (se: number) => PLOT_TOP + (se / maxSE) * PLOT_HEIGHT; // inverted: se=0 → top, se=maxSE → bottom.

  const pooledX = toX(pooledTheta);

  // Funnel triangle (pseudo-95% CI region):
  //   Apex: (pooled, 0) at the top.
  //   Left base: (pooled - 1.96·maxSE, maxSE) at the bottom.
  //   Right base: (pooled + 1.96·maxSE, maxSE) at the bottom.
  const apexY = toY(0);
  const baseY = toY(maxSE);
  const leftBaseX = toX(pooledTheta - Z95 * maxSE);
  const rightBaseX = toX(pooledTheta + Z95 * maxSE);

  // Tick generation on the original scale for log axes.
  const xTicks = isLogScale
    ? logTicksOriginal(Math.exp(xMin), Math.exp(xMax))
    : (() => {
        // Linear: ~5 ticks across the range.
        const span = xMax - xMin;
        const step = span / 5 || 1;
        const ticks: number[] = [];
        for (let v = xMin; v <= xMax + step * 1e-9; v += step) {
          ticks.push(Number(v.toFixed(12)));
        }
        return ticks;
      })();

  const filename = slugify(`funnel-${outcome.name}`);
  const labelMeasure = effectMeasureLabel(outcome);

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
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", width: "100%", height: "auto", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        role="img"
        aria-label={`Funnel plot for ${outcome.name}`}
      >
        {/* Title */}
        <text x={SVG_WIDTH / 2} y={28} fontSize={16} fontWeight={600} fill={COLORS.ink} textAnchor="middle">
          Funnel Plot — Publication Bias Visualization
        </text>
        <text x={SVG_WIDTH / 2} y={46} fontSize={11} fill={COLORS.subink} textAnchor="middle">
          {outcome.name} · {labelMeasure} ({outcome.model} model)
        </text>

        {/* Y-axis grid lines (inverted SE) */}
        {TICK_FRAC.map((f, i) => {
          const y = PLOT_TOP + f * PLOT_HEIGHT;
          return (
            <g key={`ygrid-${i}`}>
              <line x1={PLOT_LEFT} y1={y} x2={PLOT_RIGHT} y2={y} stroke={COLORS.grid} strokeWidth={1} />
              <text x={PLOT_LEFT - 8} y={y + 3} fontSize={10} fill={COLORS.subink} textAnchor="end">
                {(maxSE * (1 - f)).toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Funnel triangle fill */}
        <polygon
          points={`${pooledX},${apexY} ${leftBaseX},${baseY} ${rightBaseX},${baseY}`}
          fill={COLORS.funnelFill}
          fillOpacity={0.4}
          stroke="none"
        />

        {/* Pseudo 95% CI lines (two diagonals) */}
        <line x1={pooledX} y1={apexY} x2={leftBaseX} y2={baseY} stroke={COLORS.funnel} strokeWidth={1.2} strokeDasharray="4 3" />
        <line x1={pooledX} y1={apexY} x2={rightBaseX} y2={baseY} stroke={COLORS.funnel} strokeWidth={1.2} strokeDasharray="4 3" />

        {/* Pooled-effect vertical line */}
        <line x1={pooledX} y1={PLOT_TOP} x2={pooledX} y2={PLOT_BOTTOM} stroke={COLORS.pooled} strokeWidth={1.2} strokeDasharray="3 3" />

        {/* Per-study circles */}
        {effects.map((eff, i) => {
          const cx = toX(eff.theta);
          const cy = toY(eff.se);
          return (
            <g key={`pt-${i}`}>
              <circle cx={cx} cy={cy} r={4} fill={COLORS.study} fillOpacity={0.6} stroke={COLORS.studyStroke} strokeWidth={1} />
              <title>
                θ = {formatNumber(isLogScale ? eff.effect : eff.theta)}
                {isLogScale ? ` (log ${formatNumber(eff.theta, 3)})` : ""}
                {"\n"}
                SE = {formatNumber(eff.se, 3)}
              </title>
            </g>
          );
        })}

        {/* Plot frame */}
        <rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} fill="none" stroke={COLORS.rule} strokeWidth={1} />

        {/* X-axis ticks */}
        {xTicks.map((tick, i) => {
          const tickTheta = isLogScale ? Math.log(tick) : tick;
          if (tickTheta < xMin - 1e-9 || tickTheta > xMax + 1e-9) return null;
          const x = toX(tickTheta);
          const label = isLogScale ? formatNumber(tick, tick < 1 ? 3 : 2) : formatNumber(tick, 2);
          return (
            <g key={`xtick-${i}`}>
              <line x1={x} y1={PLOT_BOTTOM} x2={x} y2={PLOT_BOTTOM + 5} stroke={COLORS.rule} strokeWidth={1} />
              <text x={x} y={PLOT_BOTTOM + 18} fontSize={10} fill={COLORS.subink} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
        <text x={PLOT_LEFT + PLOT_WIDTH / 2} y={PLOT_BOTTOM + 40} fontSize={12} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
          {labelMeasure}{isLogScale ? " (log scale)" : ""}
        </text>

        {/* Y-axis label */}
        <text
          x={PLOT_LEFT - 50}
          y={PLOT_TOP + PLOT_HEIGHT / 2}
          fontSize={12}
          fontWeight={500}
          fill={COLORS.subink}
          textAnchor="middle"
          transform={`rotate(-90 ${PLOT_LEFT - 50} ${PLOT_TOP + PLOT_HEIGHT / 2})`}
        >
          Standard Error
        </text>

        {/* Legend */}
        <g transform={`translate(${PLOT_LEFT + 8}, ${PLOT_TOP + 8})`}>
          <circle cx={6} cy={6} r={4} fill={COLORS.study} fillOpacity={0.6} stroke={COLORS.studyStroke} strokeWidth={1} />
          <text x={16} y={9} fontSize={10} fill={COLORS.subink}>Study</text>
          <line x1={0} y1={22} x2={12} y2={22} stroke={COLORS.pooled} strokeWidth={1.2} strokeDasharray="3 3" />
          <text x={16} y={25} fontSize={10} fill={COLORS.subink}>Pooled effect</text>
          <line x1={0} y1={38} x2={12} y2={38} stroke={COLORS.funnel} strokeWidth={1.2} strokeDasharray="4 3" />
          <text x={16} y={41} fontSize={10} fill={COLORS.subink}>Pseudo 95% CI</text>
        </g>

        {/* Footer note */}
        <text x={PLOT_LEFT} y={PLOT_BOTTOM + 56} fontSize={10} fill={COLORS.faint}>
          Asymmetry (studies clustering outside the funnel) suggests potential publication bias.
        </text>
      </svg>
    </div>
  );
}

export default FunnelPlot;
