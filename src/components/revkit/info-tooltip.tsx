"use client";

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Info } from "@phosphor-icons/react";

/**
 * InfoTooltip — the wizard-of-math "?" helper.
 *
 * Renders a small dashed-circle "?" icon next to a field label.
 * Hovering (or focusing via keyboard) opens a popover that EXPLAINS:
 *   - What to enter
 *   - Why it matters
 *   - The formula or example (when applicable)
 *
 * This is the contextual-help layer RevKit uses everywhere — every
 * stat, every dropdown, every RoB domain question, every outcome field.
 *
 * Usage:
 *   <label className="flex items-center gap-1">
 *     Effect Measure
 *     <InfoTooltip
 *       title="Effect Measure"
 *       what="The summary statistic for this outcome."
 *       why="Picks how study results are combined. Mismatched measures cause wrong pooling."
 *       example="OR for case-control; RR for cohort; MD for continuous outcomes."
 *     />
 *   </label>
 */
export interface InfoTooltipProps {
  /** Short title shown at top of popover (e.g. "Effect Measure") */
  title: string;
  /** What to enter — short imperative ("Pick the summary statistic…") */
  what?: string;
  /** Why it matters — 1 sentence on consequence of wrong choice */
  why?: string;
  /** Formula or example — monospace block, e.g. "OR = (a×d)/(b×c)" */
  formula?: string;
  /** Plain-language example ("OR for case-control; RR for cohort; MD for continuous.") */
  example?: string;
  /** Optional override for the trigger icon size (default 14px) */
  size?: number;
  /** Optional children to render instead of the default "?" trigger */
  children?: React.ReactNode;
  /** Side of the trigger to open on */
  side?: "top" | "right" | "bottom" | "left";
}

export function InfoTooltip({
  title,
  what,
  why,
  formula,
  example,
  size = 14,
  children,
  side = "top",
}: InfoTooltipProps) {
  const hasContent = Boolean(what || why || formula || example);

  if (!hasContent && !children) {
    // Nothing to show — render nothing so we don't tease an empty tooltip.
    return null;
  }

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children ?? (
            <button
              type="button"
              className="info-trigger align-middle"
              aria-label={`Help: ${title}`}
              style={{ width: size, height: size }}
            >
              <Info weight="duotone" style={{ width: size - 2, height: size - 2 }} />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="tooltip-origin max-w-[280px] p-3 text-xs leading-relaxed border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="space-y-1.5">
            <div className="font-semibold text-foreground text-[12px] tracking-tight">
              {title}
            </div>
            {what && (
              <div className="text-muted-foreground">
                <span className="text-fg-2 font-medium">What: </span>
                {what}
              </div>
            )}
            {why && (
              <div className="text-muted-foreground">
                <span className="text-fg-2 font-medium">Why: </span>
                {why}
              </div>
            )}
            {formula && (
              <div className="rounded-md bg-surface-hover border border-soft px-2 py-1.5 font-mono text-[11px] text-fg-2 tabular">
                {formula}
              </div>
            )}
            {example && (
              <div className="text-muted-foreground">
                <span className="text-fg-2 font-medium">e.g. </span>
                {example}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
