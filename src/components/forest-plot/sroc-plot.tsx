// src/components/forest-plot/sroc-plot.tsx — SROC (Summary Receiver Operating
// Characteristic) plot for diagnostic-test-accuracy reviews.
//
// X-axis: 1 − Specificity (false-positive rate, 0→1).
// Y-axis: Sensitivity (true-positive rate, 0→1).
// Each study is a circle whose radius scales with sqrt(sample size).
// The HSROC summary curve is sampled from `hsroc(studies)`: a smooth path
// showing the fitted `logit(TPR) = α + β·logit(FPR)` regression.
// The summary operating point comes from `univariateLogitSensitivity` +
// `univariateLogitSpecificity`, drawn with a crosshair and a rectangle
// representing the (simplified) 95% CI region.

"use client";

import * as React from "react";
import { useRef } from "react";
import {
  hsroc,
  univariateLogitSensitivity,
  univariateLogitSpecificity,
  type DtaStudy,
} from "@/lib/stats";
import type { Outcome, Study, DataPoint } from "@/lib/types";
import { useReviewStore } from "@/lib/project/state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  downloadPNG,
  downloadSVG,
  formatPercent,
  invLogit,
  slugify,
} from "./plot-utils";

export interface SrocPlotProps {
  outcome: Outcome;
  studies?: Study[];
}

const SVG_WIDTH = 640;
const SVG_HEIGHT = 680;
const MARGIN = { top: 60, right: 30, bottom: 60, left: 70 };
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
  curve: "#7c3aed",
  summary: "#dc2626",
  summaryStroke: "#991b1b",
  chance: "#94a3b8",
};

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

/** Sample the HSROC curve as a polyline path string. */
function buildHsrocPath(alpha: number, beta: number): string {
  const points: string[] = [];
  // Sample fpr from 0.005 to 0.995 — avoid log(0) at endpoints.
  for (let i = 0; i <= 100; i++) {
    const fpr = 0.005 + (0.99 * i) / 100;
    const logitFpr = Math.log(fpr / (1 - fpr));
    const logitSens = alpha + beta * logitFpr;
    const sens = invLogit(logitSens);
    points.push(`${fpr.toFixed(4)},${sens.toFixed(4)}`);
  }
  return points.join(" ");
}

interface StudyPoint {
  dp: DataPoint;
  study?: Study;
  sens: number;
  spec: number;
  sampleSize: number;
}

/** Build the per-study points from DTA data points. */
function buildStudyPoints(
  outcome: Outcome,
  studiesById: Map<string, Study>,
): StudyPoint[] {
  const points: StudyPoint[] = [];
  for (const dp of outcome.dataPoints ?? []) {
    const tp = dp.tp ?? 0;
    const fp = dp.fp ?? 0;
    const fn = dp.fn ?? 0;
    const tn = dp.tn ?? 0;
    const sensDenom = tp + fn;
    const specDenom = tn + fp;
    if (sensDenom === 0 || specDenom === 0) continue;
    points.push({
      dp,
      study: studiesById.get(dp.studyId),
      sens: tp / sensDenom,
      spec: tn / specDenom,
      sampleSize: tp + fp + fn + tn,
    });
  }
  return points;
}

export function SrocPlot({ outcome, studies: studiesProp }: SrocPlotProps) {
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
        <div className="text-sm font-medium">SROC plot not available</div>
        <div className="mt-1 text-xs opacity-70">
          The SROC plot requires a diagnostic outcome (DTA_2x2 data type).
        </div>
      </Card>
    );
  }

  const studyPoints = buildStudyPoints(outcome, studiesById);
  if (studyPoints.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <div className="text-sm font-medium">No DTA data yet</div>
        <div className="mt-1 text-xs opacity-70">
          Add studies and 2×2 data (TP / FP / FN / TN) to see the SROC plot.
        </div>
      </Card>
    );
  }

  // DTA studies for the stats engine.
  const dtaStudies: DtaStudy[] = studyPoints.map((p) => {
    const tp = p.dp.tp ?? 0;
    const fp = p.dp.fp ?? 0;
    const fn = p.dp.fn ?? 0;
    const tn = p.dp.tn ?? 0;
    return { tp, fp, fn, tn };
  });

  const isRandom = outcome.model === "random";
  const sensPool = univariateLogitSensitivity(dtaStudies, isRandom);
  const specPool = univariateLogitSpecificity(dtaStudies, isRandom);
  const hsrocFit = hsroc(dtaStudies);

  const summaryX = 1 - specPool.pooled.spec; // FPR
  const summaryY = sensPool.pooled.sens;     // TPR

  // 95% CI rectangle bounds.
  const summaryXLo = 1 - specPool.pooled.ciUpper;
  const summaryXHi = 1 - specPool.pooled.ciLower;
  const summaryYLo = sensPool.pooled.ciLower;
  const summaryYHi = sensPool.pooled.ciUpper;

  // Coordinate transforms: (fpr, sens) → (xPixel, yPixel).
  const toX = (fpr: number) => PLOT_LEFT + fpr * PLOT_WIDTH;
  const toY = (sens: number) => PLOT_TOP + (1 - sens) * PLOT_HEIGHT;

  // Sample-size proportional circle radius.
  const maxN = Math.max(...studyPoints.map((p) => p.sampleSize), 1);
  const radiusFor = (n: number) => 3 + 9 * Math.sqrt(n / maxN);

  const curvePath = buildHsrocPath(hsrocFit.alpha, hsrocFit.beta);
  // Convert curve path (in fpr,sens coordinates) to SVG pixel coordinates.
  const curvePoints = curvePath
    .split(" ")
    .map((pt) => {
      const [fpr, sens] = pt.split(",").map(Number);
      return `${toX(fpr).toFixed(1)},${toY(sens).toFixed(1)}`;
    })
    .join(" ");

  const filename = slugify(`sroc-${outcome.name}`);

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
        aria-label={`SROC plot for ${outcome.name}`}
      >
        {/* Title */}
        <text x={SVG_WIDTH / 2} y={28} fontSize={16} fontWeight={600} fill={COLORS.ink} textAnchor="middle">
          SROC Plot — HSROC Summary Curve
        </text>
        <text x={SVG_WIDTH / 2} y={46} fontSize={11} fill={COLORS.subink} textAnchor="middle">
          {outcome.name} · {isRandom ? "Random effects" : "Fixed effect"}
        </text>

        {/* Grid lines */}
        {TICKS.map((t, i) => (
          <g key={`grid-${i}`}>
            <line x1={toX(t)} y1={PLOT_TOP} x2={toX(t)} y2={PLOT_BOTTOM} stroke={COLORS.grid} strokeWidth={1} />
            <line x1={PLOT_LEFT} y1={toY(t)} x2={PLOT_RIGHT} y2={toY(t)} stroke={COLORS.grid} strokeWidth={1} />
          </g>
        ))}

        {/* Plot frame */}
        <rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} fill="none" stroke={COLORS.rule} strokeWidth={1} />

        {/* Chance diagonal (0,0) → (1,1) */}
        <line x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)} stroke={COLORS.chance} strokeWidth={1.2} strokeDasharray="5 4" />
        <text x={toX(0.95)} y={toY(0.05) - 4} fontSize={10} fill={COLORS.faint} textAnchor="end">
          chance line
        </text>

        {/* HSROC curve */}
        <polyline
          points={curvePoints}
          fill="none"
          stroke={COLORS.curve}
          strokeWidth={2}
        />
        <text x={toX(0.5)} y={PLOT_TOP - 8} fontSize={10} fill={COLORS.curve} textAnchor="middle">
          HSROC curve (α={hsrocFit.alpha.toFixed(2)}, β={hsrocFit.beta.toFixed(2)})
        </text>

        {/* Per-study circles */}
        {studyPoints.map((p) => {
          const cx = toX(1 - p.spec);
          const cy = toY(p.sens);
          const r = radiusFor(p.sampleSize);
          const label = p.study?.label ?? "Study";
          return (
            <g key={p.dp.id}>
              <circle cx={cx} cy={cy} r={r} fill={COLORS.study} fillOpacity={0.45} stroke={COLORS.studyStroke} strokeWidth={1} />
              <title>
                {label}
                {"\n"}
                Sens: {formatPercent(p.sens)} · Spec: {formatPercent(p.spec)} · n={p.sampleSize}
              </title>
            </g>
          );
        })}

        {/* Summary operating point: 95% CI rectangle */}
        <rect
          x={toX(Math.min(summaryXLo, summaryXHi))}
          y={toY(Math.max(summaryYLo, summaryYHi))}
          width={Math.abs(toX(summaryXHi) - toX(summaryXLo))}
          height={Math.abs(toY(summaryYHi) - toY(summaryYLo))}
          fill={COLORS.summary}
          fillOpacity={0.12}
          stroke={COLORS.summaryStroke}
          strokeWidth={1}
          strokeDasharray="3 2"
        />

        {/* Crosshair */}
        <line
          x1={toX(summaryX)}
          y1={PLOT_TOP}
          x2={toX(summaryX)}
          y2={PLOT_BOTTOM}
          stroke={COLORS.summary}
          strokeWidth={0.8}
          strokeDasharray="2 3"
          opacity={0.6}
        />
        <line
          x1={PLOT_LEFT}
          y1={toY(summaryY)}
          x2={PLOT_RIGHT}
          y2={toY(summaryY)}
          stroke={COLORS.summary}
          strokeWidth={0.8}
          strokeDasharray="2 3"
          opacity={0.6}
        />

        {/* Summary point marker */}
        <circle cx={toX(summaryX)} cy={toY(summaryY)} r={6} fill={COLORS.summary} stroke={COLORS.summaryStroke} strokeWidth={1.5} />
        <text x={toX(summaryX) + 10} y={toY(summaryY) - 8} fontSize={10} fontWeight={600} fill={COLORS.summaryStroke}>
          Summary ({formatPercent(summaryY)}, {formatPercent(1 - summaryX)} FPR)
        </text>

        {/* X-axis ticks + label */}
        {TICKS.map((t, i) => (
          <g key={`xtick-${i}`}>
            <line x1={toX(t)} y1={PLOT_BOTTOM} x2={toX(t)} y2={PLOT_BOTTOM + 5} stroke={COLORS.rule} strokeWidth={1} />
            <text x={toX(t)} y={PLOT_BOTTOM + 18} fontSize={10} fill={COLORS.subink} textAnchor="middle">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        <text x={PLOT_LEFT + PLOT_WIDTH / 2} y={PLOT_BOTTOM + 40} fontSize={12} fontWeight={500} fill={COLORS.subink} textAnchor="middle">
          1 − Specificity (False Positive Rate)
        </text>

        {/* Y-axis ticks + label */}
        {TICKS.map((t, i) => (
          <g key={`ytick-${i}`}>
            <line x1={PLOT_LEFT - 5} y1={toY(t)} x2={PLOT_LEFT} y2={toY(t)} stroke={COLORS.rule} strokeWidth={1} />
            <text x={PLOT_LEFT - 10} y={toY(t) + 4} fontSize={10} fill={COLORS.subink} textAnchor="end">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={PLOT_LEFT - 50}
          y={PLOT_TOP + PLOT_HEIGHT / 2}
          fontSize={12}
          fontWeight={500}
          fill={COLORS.subink}
          textAnchor="middle"
          transform={`rotate(-90 ${PLOT_LEFT - 50} ${PLOT_TOP + PLOT_HEIGHT / 2})`}
        >
          Sensitivity (True Positive Rate)
        </text>

        {/* Legend */}
        <g transform={`translate(${PLOT_LEFT + 8}, ${PLOT_TOP + 8})`}>
          <circle cx={6} cy={6} r={5} fill={COLORS.study} fillOpacity={0.45} stroke={COLORS.studyStroke} strokeWidth={1} />
          <text x={16} y={9} fontSize={10} fill={COLORS.subink}>Study (∝ n)</text>
          <line x1={0} y1={22} x2={12} y2={22} stroke={COLORS.curve} strokeWidth={2} />
          <text x={16} y={25} fontSize={10} fill={COLORS.subink}>HSROC curve</text>
          <circle cx={6} cy={38} r={5} fill={COLORS.summary} stroke={COLORS.summaryStroke} strokeWidth={1} />
          <text x={16} y={41} fontSize={10} fill={COLORS.subink}>Summary point + 95% CI</text>
        </g>
      </svg>
    </div>
  );
}

export default SrocPlot;
