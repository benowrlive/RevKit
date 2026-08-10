"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  FlaskConical,
  Microscope,
  Layers,
  Settings2,
  ArrowRight,
  ArrowLeft,
  Check,
  FileText,
} from "lucide-react";
import { REVIEW_TYPES, REVIEW_SUBTYPES, type ReviewType, type ReviewSubType } from "@/lib/types";

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
  const progressPct = (step + 1) * (100 / totalSteps);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-emerald-600" />
            New Review Wizard
          </DialogTitle>
          <DialogDescription>
            Create a new systematic review. You can change most fields later in the
            Overview page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={progressPct} className="h-1" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{step === 0 ? "Choose type" : step === 1 ? "Sub-type" : step === 2 ? "Title & question" : "Confirm"}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <Label className="text-base font-medium">Which type of review do you want to create?</Label>
              <RadioGroup
                value={type ?? ""}
                onValueChange={(v) => setType(v as ReviewType)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {REVIEW_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t.value];
                  const checked = type === t.value;
                  return (
                    <label
                      key={t.value}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                        checked
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm"
                          : "border-border hover:border-emerald-300 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={t.value} className="mt-1" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Icon className="size-4 text-emerald-600" />
                            <span className="font-semibold">{t.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {t.usesRob2 && <Badge variant="secondary" className="text-[10px]">RoB 2</Badge>}
                            {t.usesRobinsI && <Badge variant="secondary" className="text-[10px]">ROBINS-I</Badge>}
                            {t.usesQuadas2 && <Badge variant="secondary" className="text-[10px]">QUADAS-2</Badge>}
                            {t.usesDta && <Badge variant="secondary" className="text-[10px]">DTA</Badge>}
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
              className="space-y-4"
            >
              <div>
                <Label className="text-base font-medium">Sub-type (optional)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Prognosis / Etiology / Qualitative reviews are implemented as a tag, not separate code paths.
                </p>
              </div>
              <Select
                value={subType ?? "none"}
                onValueChange={(v) => setSubType(v === "none" ? null : (v as ReviewSubType))}
              >
                <SelectTrigger>
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
              <Card className="p-4 bg-muted/40 border-dashed">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip:</strong> Choose <strong>None</strong> if you're unsure — you can change this later.
                  Sub-types mainly affect suggested data fields and defaults.
                </p>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="rev-title" className="text-base font-medium">Title</Label>
                <Input
                  id="rev-title"
                  placeholder={type ? SAMPLE_TITLES[type] : "Enter review title"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rev-rq" className="text-base font-medium">Research question (optional)</Label>
                <Textarea
                  id="rev-rq"
                  placeholder="e.g. In adults with acute sinusitis, do systemic corticosteroids improve symptom resolution compared to placebo?"
                  value={rq}
                  onChange={(e) => setRq(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  A clear PICO question (Population, Intervention, Comparator, Outcome) helps guide the review.
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
              className="space-y-3"
            >
              <Label className="text-base font-medium">Confirm and create</Label>
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    {REVIEW_TYPES.find((t) => t.value === type)?.label}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Sub-type</span>
                  <span className="text-sm">
                    {subType ? REVIEW_SUBTYPES.find((s) => s.value === subType)?.label : "None"}
                  </span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-muted-foreground shrink-0">Title</span>
                  <span className="text-sm font-medium text-right">{title || "(no title)"}</span>
                </div>
                {rq && (
                  <>
                    <Separator />
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-muted-foreground shrink-0">Research question</span>
                      <span className="text-xs text-right italic">{rq}</span>
                    </div>
                  </>
                )}
              </Card>
              <p className="text-xs text-muted-foreground">
                A fresh review starts in the <strong>Scoping</strong> phase. Use the phase stepper on the
                Overview page to advance through Screening → Extraction → Analysis → Writing → Complete.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="size-4 mr-1" />
                Back
              </Button>
            )}
            {step < 3 && (
              <Button
                onClick={next}
                disabled={step === 0 && !type}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Next
                <ArrowRight className="size-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={finish}
                disabled={!type || !title.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="size-4 mr-1" />
                Create review
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
