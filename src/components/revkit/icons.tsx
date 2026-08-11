// src/components/revkit/icons.tsx — RevKit logo + small inline icons.

import type { SVGProps } from "react";

export function RevKitLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="revkit-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.55 0.18 154)" />
          <stop offset="100%" stopColor="oklch(0.45 0.18 190)" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="12" fill="url(#revkit-grad)" />
      {/* Diamond — the classic meta-analysis "pooled effect" symbol */}
      <polygon points="32,18 46,32 32,46 18,32" fill="white" opacity="0.95" />
      <line x1="14" y1="32" x2="50" y2="32" stroke="white" strokeWidth="1.5" opacity="0.4" />
      <circle cx="20" cy="32" r="3" fill="white" opacity="0.8" />
      <circle cx="44" cy="32" r="3" fill="white" opacity="0.8" />
    </svg>
  );
}

export function ForestIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeDasharray="2 2" />
      <rect x="4" y="6" width="6" height="2" fill="currentColor" />
      <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" />
      <rect x="6" y="11" width="8" height="2" fill="currentColor" />
      <line x1="5" y1="12" x2="15" y2="12" stroke="currentColor" />
      <rect x="9" y="16" width="6" height="2" fill="currentColor" />
      <line x1="8" y1="17" x2="16" y2="17" stroke="currentColor" />
      <polygon points="6,20 12,18 18,20 12,22" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export function TestTubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M9 2v15a3 3 0 0 0 6 0V2" strokeLinecap="round" />
      <line x1="9" y1="2" x2="15" y2="2" strokeLinecap="round" />
      <line x1="10" y1="8" x2="14" y2="8" strokeLinecap="round" />
    </svg>
  );
}
