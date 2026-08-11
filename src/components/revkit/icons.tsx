// src/components/revkit/icons.tsx — RevKit logo (teal variant).
//
// Compact dark-first design: solid teal tile with white meta-analysis
// "pooled effect" diamond. No decorative gradients.

export function RevKitLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Solid teal tile with 14px radius (squircle vibe) */}
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#14b8a6" />
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
      {/* Two study box markers — restrained */}
      <circle cx="22" cy="32" r="2.5" fill="white" opacity="0.85" />
      <circle cx="42" cy="32" r="2.5" fill="white" opacity="0.85" />
    </svg>
  );
}
