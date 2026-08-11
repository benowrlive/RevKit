"use client";

// src/components/revkit/new-review-wizard.tsx
//
// Compact redesign — 4-step wizard dialog with wizard-of-math tooltips.
//
// Layout:
//   • Dialog: max-w-2xl, .modal-origin, rounded-[10px], p-6 (24px).
//   • Header (compact): eyebrow "STEP X OF 4 · <LABEL>" + H2 text-xl +
//     sub text-xs text-muted-fg.
//   • Step indicator: thin h-0.5 bg-surface-hover track with bg-accent fill.
//   • Step content: max-h-[60vh] overflow-y-auto.
//   • Footer: Cancel (ghost, text-only) | Back (secondary, CaretLeft) |
//     Next/Create (primary; Check for final step).
//
// All five steps use Phosphor icons. Note: this installed version of
// @phosphor-icons/react (v2.1.10) does NOT export bare names Activity,
// Layers, Settings2, ChevronLeft/ChevronRight, etc. Substitutes:
//   Activity → Pulse · Layers → Stack · Settings2 → Gear
//   ChevronLeft/Right → CaretLeft/CaretRight

import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pulse,
  Microscope,
  Flask,
  Stack,
  Gear,
  CaretLeft,
  CaretRight,
  Check,
} from "@phosphor-icons/react";
import { InfoTooltip } from "@/components/revkit/info-tooltip";
import {
  REVIEW_TYPES,
  REVIEW_SUBTYPES,
  type ReviewType,
  type ReviewSubType,
} from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    type: ReviewType;
    subType: ReviewSubType;
    researchQuestion: string;
  }) => void;
}

const TYPE_ICONS: Record<ReviewType, React.ElementType> = {
  INTERVENTION: Pulse,
  DTA: Microscope,
  METHODOLOGY: Flask,
  OVERVIEW: Stack,
  FLEXIBLE: Gear,
};

const SAMPLE_TITLES: Record<ReviewType, string> = {
  INTERVENTION: "Steroids for adult acute sinusitis",
  DTA: "Rapid diagnostic tests for uncomplicated P. falciparum malaria",
  METHODOLOGY: "Methodological quality of included studies",
  OVERVIEW: "Overview of reviews: antihypertensives in pregnancy",
  FLEXIBLE: "Custom review",
};

const STEP_LABELS = ["Choose type", "Sub-type", "Title & question", "Confirm"] as const;

const STEP_EYEBROWS = [
  "Step 1 of 4 · Choose type",
  "Step 2 of 4 · Sub-type",
  "Step 3 of 4 · Title & question",
  "Step 4 of 4 · Confirm",
] as const;

const STEP_DESCRIPTIONS = [
  "Pick the review type — this chooses your RoB tool and analysis engine.",
  "Optional tag that nudges suggested fields. Change later.",
  "Short title and PICO-formatted research question.",
  "Confirm and create. Defaults can be tweaked later in Settings.",
] as const;

export function NewReviewWizard({ open, onClose, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ReviewType | null>(null);
  const [subType, setSubType] = useState<ReviewSubType>(null);
  const [title, setTitle] = useState("");
  const [rq, setRq] = useState("");

  function reset() {
    setStep(0);
    setType(null);
    setSubType(null);
    setTitle("");
    setRq("");
  }

  function close() {
    reset();
    onClose();
  }

  function next() {
    setStep((s) => Math.min(s + 1, 3));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function finish() {
    if (!type || !title.trim()) return;
    onCreate({
      title: title.trim(),
      type,
      subType,
      researchQuestion: rq.trim(),
    });
    reset();
  }

  const totalSteps = 4;
  const progressPct = ((step + 1) / totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent
        className="modal-origin max-w-2xl sm:max-w-2xl rounded-[10px] border border-border bg-background p-6 shadow-lg"
        showCloseButton={false}
      >
        {/* ─── Header: eyebrow + H2 title + description ─── */}
        <DialogHeader className="gap-1 text-left">
          <span className="eyebrow">{STEP_EYEBROWS[step]}</span>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-display">
            {STEP_LABELS[step]}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-muted-fg">
            {STEP_DESCRIPTIONS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step indicator: thin h-0.5 track with bg-accent fill ─── */}
        <div className="h-0.5 w-full rounded-full bg-surface-hover">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* ─── Step content (max-h-[60vh] overflow-y-auto) ───
            Each step is keyed so React remounts on step change, retriggering
            the .enter-pop animation. */}
        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          {step === 0 && (
            <div key="step0" className="enter-pop space-y-3">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium">
                  Which type of review do you want to create?
                </label>
                <InfoTooltip
                  title="Review type"
                  what="Pick the Cochrane review type. This determines your RoB tool, analysis engine, and default fields."
                  why="Each type has different statistics: Intervention uses MH/IV with OR/RR/MD; DTA uses sensitivity/specificity; Methodology assesses studies themselves; Overview summarizes other reviews."
                  example="Intervention = does X work better than Y? DTA = how accurate is test X for disease Y?"
                  side="right"
                />
              </div>
              <RadioGroup
                value={type ?? ""}
                onValueChange={(v) => setType(v as ReviewType)}
                className="grid grid-cols-1 gap-2"
              >
                {REVIEW_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t.value];
                  const checked = type === t.value;
                  return (
                    <label
                      key={t.value}
                      className={`stagger-item cursor-pointer rounded-[10px] border-2 p-3 transition-colors ${
                        checked
                          ? "border-accent bg-accent-subtle"
                          : "border-border hover:border-muted-fg hover:bg-surface-hover"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem
                          value={t.value}
                          className="sr-only"
                          tabIndex={-1}
                        />
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                            checked
                              ? "bg-accent-subtle text-accent"
                              : "bg-surface-hover text-fg-2"
                          }`}
                        >
                          <Icon size={16} weight="duotone" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="text-md font-medium">{t.label}</div>
                          <p className="text-xs text-muted-fg">{t.description}</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {t.usesRob2 && (
                              <span className="badge-tiny badge-neutral">RoB 2</span>
                            )}
                            {t.usesRobinsI && (
                              <span className="badge-tiny badge-neutral">ROBINS-I</span>
                            )}
                            {t.usesQuadas2 && (
                              <span className="badge-tiny badge-neutral">QUADAS-2</span>
                            )}
                            {t.usesDta && (
                              <span className="badge-tiny badge-neutral">DTA</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {step === 1 && (
            <div key="step1" className="enter-pop space-y-3">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium">Sub-type (optional)</label>
                <InfoTooltip
                  title="Sub-type"
                  what="Sub-types are tags that affect suggested fields."
                  why="Prognosis, Etiology, and Qualitative are implemented as a tag rather than a separate code path."
                  example="Pick None if unsure — you can change later in Settings."
                  side="right"
                />
              </div>
              <Select
                value={subType ?? "none"}
                onValueChange={(v) =>
                  setSubType(v === "none" ? null : (v as ReviewSubType))
                }
              >
                <SelectTrigger className="input-compact h-8 w-full justify-between font-normal">
                  <SelectValue placeholder="None (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (default)</SelectItem>
                  {REVIEW_SUBTYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-fg">
                Sub-types are tags that affect suggested fields. You can change
                later.
              </p>
            </div>
          )}

          {step === 2 && (
            <div key="step2" className="enter-pop space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="rev-title" className="text-sm font-medium">
                    Title
                  </label>
                  <InfoTooltip
                    title="Title"
                    what="Short descriptive title."
                    why="Appears in exports and as the filename."
                    example="Aspirin for secondary prevention of cardiovascular events"
                    side="right"
                  />
                </div>
                <input
                  id="rev-title"
                  placeholder={type ? SAMPLE_TITLES[type] : "Enter review title"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-compact"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="rev-rq" className="text-sm font-medium">
                    Research question
                  </label>
                  <InfoTooltip
                    title="Research question"
                    what="PICO format recommended."
                    why="A clear PICO question guides the comparison and outcome structure."
                    formula="P + I + C + O"
                    example="In adults with prior MI [P], does aspirin [I] vs placebo [C] reduce all-cause mortality [O]?"
                    side="right"
                  />
                </div>
                <textarea
                  id="rev-rq"
                  placeholder="In adults with prior MI, does aspirin reduce all-cause mortality vs placebo?"
                  value={rq}
                  onChange={(e) => setRq(e.target.value)}
                  rows={4}
                  className="input-compact min-h-[80px] resize-y"
                />
                <p className="text-xs text-muted-fg">
                  PICO breakdown:{" "}
                  <span className="text-accent">P</span>opulation ·{" "}
                  <span className="text-accent">I</span>ntervention ·{" "}
                  <span className="text-accent">C</span>omparator ·{" "}
                  <span className="text-accent">O</span>utcome.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div key="step3" className="enter-pop space-y-3">
              <label className="text-sm font-medium">Confirm and create</label>
              <div className="card-compact space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow">Type</span>
                  <span className="text-sm font-medium">
                    {REVIEW_TYPES.find((t) => t.value === type)?.label}
                  </span>
                </div>
                <div className="border-t border-soft" />
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow">Sub-type</span>
                  <span className="text-sm font-medium">
                    {subType
                      ? REVIEW_SUBTYPES.find((s) => s.value === subType)?.label
                      : "None"}
                  </span>
                </div>
                <div className="border-t border-soft" />
                <div className="flex items-start justify-between gap-3">
                  <span className="eyebrow mt-0.5 shrink-0">Title</span>
                  <span className="text-right text-sm font-medium">
                    {title || "(no title)"}
                  </span>
                </div>
                {rq && (
                  <>
                    <div className="border-t border-soft" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="eyebrow mt-0.5 shrink-0">
                        Research question
                      </span>
                      <span className="text-right text-xs italic text-muted-fg">
                        {rq}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-fg">
                <span className="font-medium text-fg-2">Defaults:</span> OR · MH ·
                fixed-effect · 95% CI — change later in Settings.
              </p>
            </div>
          )}
        </div>

        {/* ─── Footer: Cancel | Back | Next/Create ─── */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <button type="button" onClick={close} className="btn-compact btn-ghost">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="btn-compact btn-secondary"
              >
                <CaretLeft size={14} weight="bold" />
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={next}
                disabled={step === 0 && !type}
                className="btn-compact btn-primary"
              >
                Next
                <CaretRight size={14} weight="bold" />
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={finish}
                disabled={!type || !title.trim()}
                className="btn-compact btn-primary"
              >
                <Check size={14} weight="bold" />
                Create review
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
