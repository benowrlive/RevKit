// src/components/revkit/icons.tsx — RevKit logo.
//
// Uses the uploaded RevKit Logo.png as the primary brand image.
// Falls back to the SVG component if the image fails to load.

export function RevKitLogo({ className }: { className?: string }) {
  return (
    <img
      src="/revkit-logo.png"
      alt="RevKit — Systematic Reviews · Meta-Analysis · Evidence Synthesis"
      className={className}
      style={{
        objectFit: "contain",
      }}
      draggable={false}
    />
  );
}
