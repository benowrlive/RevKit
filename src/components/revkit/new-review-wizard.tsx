"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Activity,
  FlaskConical,
  Microscope,
  Layers,
  Settings2,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
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
  INTERVENTION: Activity,
  DTA: Microscope,
  METHODOLOGY: FlaskConical,
  OVERVIEW: Layers,
  FLEXIBLE: Settings2,
};

const SAMPLE_TITLES: Record<ReviewType, string> = {
  INTERVENTION: "Steroids for adult acute sinusitis",
  DTA: "Rapid diagnostic tests for uncomplicated P. falciparum malaria",
  METHODOLOGY: "Methodological quality of included studies",
  OVERVIEW: "Overview of reviews: antihypertensives in pregnancy",
  FLEXIBLE: "Custom review",
};

// Apple's signature decelerate-then-settle easing curve.
const APPLE_EASE: [number, number, number, number] = [0.28, 0, 0.22, 1];

const STEP_LABELS = [
  "Choose type",
  "Sub-type",
  "Title & question",
  "Confirm",
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
        className="max-w-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-[18px] border border-border bg-background p-8 shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
      >
        {/* ─── Header: eyebrow + display title + description ─── */}
        <DialogHeader className="gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0071e3]">
            New Review
          </span>
          <DialogTitle className="font-display text-2xl font-semibold tracking-display">
            Create a systematic review
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-fg-2">
            Walk through four quick steps. You can refine every field later on
            the Overview page.
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step indicator: Apple progress bar + meta label ─── */}
        <div className="space-y-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-apple">
            <div
              className="h-full rounded-full bg-[#0071e3] transition-apple-slow"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em] text-meta">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{STEP_LABELS[step]}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: APPLE_EASE }}
              className="space-y-4"
            >
              <label className="block font-display text-sm font-semibold tracking-display text-foreground">
                Which type of review do you want to create?
              </label>
              <RadioGroup
                value={type ?? ""}
                onValueChange={(v) => setType(v as ReviewType)}
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                {REVIEW_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t.value];
                  const checked = type === t.value;
                  return (
                    <label
                      key={t.value}
                      className={`group cursor-pointer rounded-[18px] border-2 p-5 transition-apple ${
                        checked
                          ? "border-[#0071e3] bg-[#0071e3]/5"
                          : "border-border hover:border-[#0071e3]/40 hover:bg-surface-warm"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem
                          value={t.value}
                          className="sr-only"
                          tabIndex={-1}
                        />
                        <div
                          className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-apple ${
                            checked
                              ? "bg-[#0071e3]/10 text-[#0071e3]"
                              : "bg-surface-apple text-fg-2"
                          }`}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="font-display text-sm font-semibold tracking-display text-foreground">
                            {t.label}
                          </div>
                          <p className="mt-0.5 text-xs text-fg-2">
                            {t.description}
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {t.usesRob2 && (
                              <span className="rounded-full bg-surface-apple px-1.5 py-0.5 text-[10px] text-meta">
                                RoB 2
                              </span>
                            )}
                            {t.usesRobinsI && (
                              <span className="rounded-full bg-surface-apple px-1.5 py-0.5 text-[10px] text-meta">
                                ROBINS-I
                              </span>
                            )}
                            {t.usesQuadas2 && (
                              <span className="rounded-full bg-surface-apple px-1.5 py-0.5 text-[10px] text-meta">
                                QUADAS-2
                              </span>
                            )}
                            {t.usesDta && (
                              <span className="rounded-full bg-surface-apple px-1.5 py-0.5 text-[10px] text-meta">
                                DTA
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: APPLE_EASE }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-meta">
                  Sub-type (optional)
                </label>
                <p className="text-xs text-fg-2">
                  Prognosis, Etiology, and Qualitative reviews are implemented
                  as a tag rather than a separate code path.
                </p>
              </div>
              <Select
                value={subType ?? "none"}
                onValueChange={(v) =>
                  setSubType(v === "none" ? null : (v as ReviewSubType))
                }
              >
                <SelectTrigger className="field-apple focus-halo h-auto w-full justify-between rounded-[8px] border-border bg-background px-3.5 py-3 text-[17px] shadow-none focus-visible:ring-0">
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
              <div className="rounded-[12px] border border-dashed border-border bg-surface-warm p-4">
                <p className="text-xs text-fg-2">
                  <span className="font-semibold text-foreground">Tip:</span>{" "}
                  Choose <span className="font-medium">None</span> if you're
                  unsure — sub-types only nudge suggested fields and defaults.
                </p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: APPLE_EASE }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <label
                  htmlFor="rev-title"
                  className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-meta"
                >
                  Title
                </label>
                <input
                  id="rev-title"
                  placeholder={type ? SAMPLE_TITLES[type] : "Enter review title"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="field-apple focus-halo"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="rev-rq"
                  className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-meta"
                >
                  Research question (optional)
                </label>
                <textarea
                  id="rev-rq"
                  placeholder="e.g. In adults with acute sinusitis, do systemic corticosteroids improve symptom resolution compared to placebo?"
                  value={rq}
                  onChange={(e) => setRq(e.target.value)}
                  rows={4}
                  className="field-apple focus-halo min-h-[80px] resize-y"
                />
                <p className="mt-2 text-xs text-meta">
                  A clear PICO question (Population, Intervention, Comparator,
                  Outcome) helps guide the review.
                </p>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: APPLE_EASE }}
              className="space-y-4"
            >
              <label className="block font-display text-sm font-semibold tracking-display text-foreground">
                Confirm and create
              </label>
              <div className="card-apple space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.08em] text-meta">
                    Type
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {REVIEW_TYPES.find((t) => t.value === type)?.label}
                  </span>
                </div>
                <div className="border-t border-[var(--border-soft)]" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.08em] text-meta">
                    Sub-type
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {subType
                      ? REVIEW_SUBTYPES.find((s) => s.value === subType)?.label
                      : "None"}
                  </span>
                </div>
                <div className="border-t border-[var(--border-soft)]" />
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 text-xs uppercase tracking-[0.08em] text-meta">
                    Title
                  </span>
                  <span className="text-right text-sm font-medium text-foreground">
                    {title || "(no title)"}
                  </span>
                </div>
                {rq && (
                  <>
                    <div className="border-t border-[var(--border-soft)]" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="shrink-0 text-xs uppercase tracking-[0.08em] text-meta">
                        Research question
                      </span>
                      <span className="text-right text-xs italic text-fg-2">
                        {rq}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-meta">
                A fresh review starts in the{" "}
                <span className="font-medium text-foreground">Scoping</span>{" "}
                phase. Use the phase stepper on the Overview page to advance
                through Screening → Extraction → Analysis → Writing → Complete.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Footer: Cancel (text-only) + Back (ring) + Next/Create (pill) ─── */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={close}
            className="text-sm font-medium text-fg-2 transition-apple hover:text-foreground focus-visible:outline-none"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                className="btn-pill-secondary font-display tracking-display"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={next}
                disabled={step === 0 && !type}
                className="btn-pill font-display tracking-display"
              >
                Next
                <ArrowRight className="size-4" />
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={finish}
                disabled={!type || !title.trim()}
                className="btn-pill font-display tracking-display"
              >
                <Check className="size-4" />
                Create review
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
