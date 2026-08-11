// src/lib/export/download.ts — browser-side file download helpers.
//
// Pure TypeScript (browser-only API usage at call-time). Safe to import from
// client components. Mirrors the helper shape used by `forest-plot/plot-utils.ts`
// but is intentionally self-contained so the export pipeline does not pull in
// the plot rendering modules.

/** Trigger a browser download of a Blob with the given filename. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke a tick so Safari/Edge have time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger a text-based download (CSV, JSON, HTML, plain text). */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([text], { type: mime });
  triggerDownload(blob, filename);
}

/**
 * Escape a single CSV cell.
 *
 * Rules (RFC 4180-ish):
 *  - If the value contains a comma, double-quote, newline, or carriage return,
 *    wrap it in double-quotes and escape any inner double-quotes by doubling.
 *  - Empty string is preserved (NOT quoted) so empty cells stay empty.
 *  - Numbers, booleans, and `null` are stringified.
 */
export function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from a 2D array of cell values. Each inner array is one
 * row; rows are joined with `\r\n` (Excel-friendly). `null` / `undefined`
 * become empty cells.
 */
export function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

/**
 * Slugify a string for use in a filename. Lowercases, collapses non
 * `[a-z0-9]+` runs to a single hyphen, trims leading/trailing hyphens. Falls
 * back to `"revkit"` if the result is empty.
 */
export function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "revkit";
}

/**
 * Serialize an SVG element and download it as a `.svg` file. Ensures the
 * serialized string carries the `xmlns` namespace so it renders standalone.
 */
export function downloadSVGElement(svg: SVGSVGElement, filename: string): void {
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
 * at 2× the SVG's viewBox dimensions for crisp output. Renders a white
 * background under the SVG so transparent areas don't end up black in the PNG.
 */
export function downloadPNGFromSVG(svg: SVGSVGElement, filename: string): void {
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
    const h = viewBox && viewBox.height ? viewBox.height : svg.clientHeight || 600;
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
