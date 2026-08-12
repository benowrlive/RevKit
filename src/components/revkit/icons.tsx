// src/components/revkit/icons.tsx — RevKit logo components.
//
// Two variants:
//   - RevKitLogo: the full logo image (large, for hero sections)
//   - RevKitIcon: the R icon only (small, for topbar/favicon)

export function RevKitLogo({ className }: { className?: string }) {
  return (
    <img
      src="/revkit-logo.png"
      alt="RevKit — Systematic Reviews · Meta-Analysis · Evidence Synthesis"
      className={className}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}

/** Small R icon — for topbar, favicon, compact contexts. */
export function RevKitIcon({ className }: { className?: string }) {
  return (
    <img
      src="/r-logo.png"
      alt="RevKit"
      className={className}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}
