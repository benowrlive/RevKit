// src/components/forest-plot/plot-utils.ts — shared helpers for the SVG plot
// components: download serialization (SVG + PNG via canvas), Wilson proportion
// CI, log/linear tick generators, number/p-value formatters, DTA continuity
// correction, and the logistic back-transform.
//
// Pure TypeScript — no React, no DOM access (download helpers use the browser
// `document`/`XMLSerializer` API at call-time only, so they're safe to import
// from client components but must only be called inside event handlers).

import type { DtaStudy } from "@/lib/stats";

/** 95% z multiplier. */
export const Z95 = 1.959963984540054;

/** Logistic back-transform: 1 / (1 + e^-x). Clamps extreme exponents. */
export function invLogit(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

/**
 * Apply 0.5 continuity correction to a DTA 2x2 study if any cell is zero.
 * Mirrors the private helper inside lib/stats/dta.ts so DTA plot components
 * can recompute per-study logit/SE for weight derivation.
 */
export function withDtaCc(s: DtaStudy): DtaStudy {
  if (s.tp === 0 || s.fp === 0 || s.fn === 0 || s.tn === 0) {
    return { tp: s.tp + 0.5, fp: s.fp + 0.5, fn: s.fn + 0.5, tn: s.tn + 0.5 };
  }
  return s;
}

/**
 * Wilson score 95% CI for a binomial proportion.
 *
 * Returns {p, lower, upper} with all three on the 0..1 scale. If n==0 the
 * returned values are NaN. Used by DTA forest plot panels (per-study
 * sensitivity / specificity) where RevMan convention prefers Wilson over
 * the simpler normal-approximation interval.
 */
export function wilsonCI(
  x: number,
  n: number,
  z: number = Z95,
): { p: number; lower: number; upper: number } {
  if (n <= 0) return { p: NaN, lower: NaN, upper: NaN };
  const p = x / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    p,
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

/** Candidate log-scale tick values for ratio-effect forest plots. */
const LOG_TICK_CANDIDATES = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];

/**
 * Pick log-scale ticks (powers of 2) that fall inside [minVal, maxVal] on the
 * *original* (exp-scale) axis. Returns the tick values in original units so
 * callers can format labels and compute positions via `Math.log(tick)`.
 */
export function logTicksOriginal(
  minVal: number,
  maxVal: number,
): number[] {
  if (minVal <= 0 || maxVal <= 0 || !Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return [1];
  }
  const logMin = Math.log(minVal);
  const logMax = Math.log(maxVal);
  return LOG_TICK_CANDIDATES.filter((t) => {
    const lt = Math.log(t);
    return lt >= logMin - 1e-9 && lt <= logMax + 1e-9;
  });
}

/** Snap a log-scale range to enclosing powers of 2 (with a 1-power pad). */
export function snapLogRange(
  minVal: number,
  maxVal: number,
): { xMin: number; xMax: number } {
  if (minVal <= 0 || maxVal <= 0) {
    return { xMin: Math.log(0.25), xMax: Math.log(4) };
  }
  const lo = Math.log(minVal);
  const hi = Math.log(maxVal);
  // Pad outward by ~15% of the log-range.
  const pad = (hi - lo) * 0.15 || Math.log(2) * 2;
  const paddedLo = lo - pad;
  const paddedHi = hi + pad;
  // Snap to nearest power of 2 outside the padded range.
  let snapLo = Math.floor(paddedLo / Math.log(2)) * Math.log(2);
  let snapHi = Math.ceil(paddedHi / Math.log(2)) * Math.log(2);
  // Guarantee at least 4 powers of 2 between min and max so the axis isn't cramped.
  while (snapHi - snapLo < Math.log(2) * 4) {
    snapLo -= Math.log(2);
    snapHi += Math.log(2);
  }
  return { xMin: snapLo, xMax: snapHi };
}

/**
 * Generate ~5–8 "nice" linear ticks inside [minVal, maxVal]. Picks a step from
 * {1, 2, 2.5, 5} × 10^k so the labels stay readable. Returns the tick values.
 */
export function linearTicks(minVal: number, maxVal: number): number[] {
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal === maxVal) {
    return [minVal];
  }
  const span = maxVal - minVal;
  const rawStep = span / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const ticks: number[] = [];
  const start = Math.ceil(minVal / step) * step;
  for (let v = start; v <= maxVal + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(12)));
  }
  return ticks;
}

/** Snap a linear range outward by ~10% and round to a "nice" boundary. */
export function snapLinearRange(
  minVal: number,
  maxVal: number,
): { xMin: number; xMax: number } {
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return { xMin: -1, xMax: 1 };
  }
  if (minVal === maxVal) {
    return { xMin: minVal - 1, xMax: maxVal + 1 };
  }
  const span = maxVal - minVal;
  const pad = span * 0.1;
  return { xMin: minVal - pad, xMax: maxVal + pad };
}

/**
 * Format a number for axis labels or table cells.
 *  - |v| < 0.01 or |v| >= 1000 → exponential.
 *  - Otherwise: 2 decimals (configurable via `decimals`).
 */
export function formatNumber(v: number, decimals = 2): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs < 0.01 || abs >= 1000) {
    return v.toExponential(2);
  }
  return v.toFixed(decimals);
}

/** Format a percentage (0..1 → "0.0%"). */
export function formatPercent(v: number, decimals = 1): string {
  if (!Number.isFinite(v)) return "—";
  return (v * 100).toFixed(decimals) + "%";
}

/** Format a p-value: "<0.001" for very small, otherwise 3 decimals. */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

/** Format an effect + 95% CI as "1.23 [0.98, 1.55]" or "0.85 [0.70, 1.04]". */
export function formatEffectWithCI(
  effect: number,
  ciLower: number,
  ciUpper: number,
  decimals = 2,
): string {
  const e = formatNumber(effect, decimals);
  const lo = formatNumber(ciLower, decimals);
  const hi = formatNumber(ciUpper, decimals);
  return `${e} [${lo}, ${hi}]`;
}

/** Trigger a browser download of a Blob with the given filename. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Serialize an SVG element and download it as an `.svg` file. Ensures the
 * serialized string carries the `xmlns` namespace so it renders standalone.
 */
export function downloadSVG(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svgStr], {
    type: "image/svg+xml;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

/**
 * Rasterize an SVG element to a PNG and download it. Uses an offscreen canvas
 * at 2× the SVG's rendered pixel dimensions for crisp output.
 */
export function downloadPNG(svg: SVGSVGElement, filename: string): void {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const viewBox = svg.viewBox?.baseVal;
    const w = viewBox && viewBox.width ? viewBox.width : svg.clientWidth || 800;
    const h =
      viewBox && viewBox.height ? viewBox.height : svg.clientHeight || 600;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

/** Build a slug-safe filename stem from an arbitrary title. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "plot"
  );
}
