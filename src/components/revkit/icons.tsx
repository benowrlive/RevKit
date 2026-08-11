// src/components/revkit/icons.tsx — RevKit logo + small inline icons.
//
// Apple-inspired aesthetic: precision geometry, single accent color,
// no decorative gradients. The diamond is the classic meta-analysis
// "pooled effect" symbol — kept minimal per Apple's restraint principle.

import type { SVGProps } from "react";

export function RevKitLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Solid Apple-blue tile with 14px radius (Apple squircle vibe) */}
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#0071e3" />
      {/* White diamond — the meta-analysis pooled-effect symbol */}
      <polygon
        points="32,16 48,32 32,48 16,32"
        fill="white"
        opacity="0.96"
      />
      {/* Whisper-thin reference line at null effect (x=1 for ratios) */}
      <line
        x1="14"
        y1="32"
        x2="50"
        y2="32"
        stroke="white"
        strokeWidth="1"
        opacity="0.35"
      />
      {/* Two study box markers — restrained, Apple-style */}
      <circle cx="22" cy="32" r="2.5" fill="white" opacity="0.85" />
      <circle cx="42" cy="32" r="2.5" fill="white" opacity="0.85" />
    </svg>
  );
}

export function ForestIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeDasharray="2 2" opacity="0.4" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M9 2v15a3 3 0 0 0 6 0V2" strokeLinecap="round" />
      <line x1="9" y1="2" x2="15" y2="2" strokeLinecap="round" />
      <line x1="10" y1="8" x2="14" y2="8" strokeLinecap="round" />
    </svg>
  );
}
