"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InfoTooltip } from "@/components/revkit/info-tooltip";

/**
 * PresetSelect — a Select dropdown with grouped, explained presets.
 *
 * Solves the "what should I pick?" problem. Instead of a bare dropdown
 * with cryptic values, PresetSelect groups options into preset groups
 * (e.g. "Effect measures", "Common methods") and pairs each option with
 * an inline InfoTooltip explaining when to use it.
 *
 * Usage:
 *   <PresetSelect
 *     value={method}
 *     onValueChange={setMethod}
 *     groups={[
 *       {
 *         label: "Pooling methods",
 *         options: [
 *           { value: "MH", label: "Mantel-Haenszel", info: { title: "MH",
 *             what: "Use for dichotomous outcomes with rare events.",
 *             why: "Better than Peto when effect sizes are heterogeneous." } },
 *           ...
 *         ]
 *       }
 *     ]}
 *   />
 */
export interface PresetOption {
  value: string;
  label: string;
  description?: string; // short helper text under the label
  info?: {
    title?: string;
    what?: string;
    why?: string;
    formula?: string;
    example?: string;
  };
}

export interface PresetGroup {
  label: string;
  options: PresetOption[];
}

export interface PresetSelectProps {
  value: string;
  onValueChange: (v: string) => void;
  groups: PresetGroup[];
  placeholder?: string;
  /** Optional helper tooltip shown next to the trigger */
  triggerInfo?: {
    title: string;
    what?: string;
    why?: string;
    formula?: string;
    example?: string;
  };
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export function PresetSelect({
  value,
  onValueChange,
  groups,
  placeholder = "Select…",
  triggerInfo,
  className,
  id,
  ...aria
}: PresetSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`flex items-center gap-1 ${className ?? ""}`}>
      <Select value={value} onValueChange={onValueChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger
          id={id}
          aria-label={aria["aria-label"]}
          className="input-compact h-8 w-full font-normal text-[13px]"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="popover-origin min-w-[220px] max-w-[320px]">
          {groups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-fg font-semibold">
                {group.label}
              </SelectLabel>
              {group.options.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="py-1.5 text-[13px]"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-[11px] text-muted-fg truncate">{opt.description}</div>
                      )}
                    </div>
                    {opt.info && (
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <InfoTooltip
                          title={opt.info.title ?? opt.label}
                          what={opt.info.what}
                          why={opt.info.why}
                          formula={opt.info.formula}
                          example={opt.info.example}
                          size={12}
                          side="right"
                        />
                      </div>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {triggerInfo && (
        <InfoTooltip
          title={triggerInfo.title}
          what={triggerInfo.what}
          why={triggerInfo.why}
          formula={triggerInfo.formula}
          example={triggerInfo.example}
        />
      )}
    </div>
  );
}
