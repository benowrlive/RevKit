"use client";

import { useState } from "react";
import { useReviewStore } from "@/lib/project/state";
import { STUDY_DESIGNS, type Study } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  FileText,
  Microscope,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

interface StudyFormState {
  label: string;
  year: string;
  authors: string;
  doi: string;
  design: string;
  indexTest: string;
  referenceStandard: string;
  notes: string;
  status: string;
}

const EMPTY_FORM: StudyFormState = {
  label: "",
  year: "",
  authors: "",
  doi: "",
  design: "",
  indexTest: "",
  referenceStandard: "",
  notes: "",
  status: "included",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "included":
      return "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 border-teal-200 dark:border-teal-900";
    case "excluded":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-900";
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function doiUrl(doi: string): string {
  const trimmed = doi.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://doi.org/${trimmed}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function initFormFromStudy(study: Study | null): StudyFormState {
  if (!study) return { ...EMPTY_FORM };
  return {
    label: study.label ?? "",
    year: study.year != null ? String(study.year) : "",
    authors: study.authors ?? "",
    doi: study.doi ?? "",
    design: study.design ?? "",
    indexTest: study.indexTest ?? "",
    referenceStandard: study.referenceStandard ?? "",
    notes: study.notes ?? "",
    status: study.status ?? "included",
  };
}

function StudyFormDialog({
  open,
  study,
  onClose,
}: {
  open: boolean;
  study: Study | null;
  onClose: () => void;
}) {
  const review = useReviewStore((s) => s.review);
  const addStudy = useReviewStore((s) => s.addStudy);
  const updateStudy = useReviewStore((s) => s.updateStudy);

  const isDta = review?.type === "DTA";
  const isEdit = study !== null;
  // The parent supplies a `key` that changes between add/edit transitions so
  // the form state is re-initialized via the useState initializer on each mount.
  const [form, setForm] = useState<StudyFormState>(() => initFormFromStudy(study));
  const [errors, setErrors] = useState<{ label?: string; year?: string }>({});

  function update<K extends keyof StudyFormState>(key: K, value: StudyFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: { label?: string; year?: string } = {};
    if (!form.label.trim()) {
      next.label = "Label is required.";
    }
    const yearNum = form.year.trim() === "" ? null : Number(form.year);
    const currentYear = new Date().getFullYear();
    if (yearNum !== null) {
      if (!Number.isFinite(yearNum) || !Number.isInteger(yearNum)) {
        next.year = "Year must be a whole number.";
      } else if (yearNum < 1900 || yearNum > currentYear + 1) {
        next.year = `Year must be between 1900 and ${currentYear + 1}.`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const yearNum = form.year.trim() === "" ? null : Number(form.year);
    const payload = {
      label: form.label.trim(),
      year: yearNum,
      authors: form.authors.trim() || null,
      doi: form.doi.trim() || null,
      pdfPath: study?.pdfPath ?? null,
      status: form.status || "included",
      excludeReason: study?.excludeReason ?? null,
      design: form.design || null,
      picos: study?.picos ?? null,
      indexTest: form.indexTest.trim() || null,
      referenceStandard: form.referenceStandard.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (isEdit && study) {
      updateStudy(study.id, payload);
      toast.success("Study updated", { description: payload.label });
    } else {
      addStudy(payload);
      toast.success("Study added", { description: payload.label });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {isEdit ? "Edit study" : "Add study"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the study metadata. Changes are saved to the in-memory review."
              : "Create a new study record. You can add data points and RoB assessments later."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="study-label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="study-label"
                value={form.label}
                onChange={(e) => update("label", e.target.value)}
                placeholder="e.g. Smith 2020 — Aspirin vs placebo"
                aria-invalid={!!errors.label}
              />
              {errors.label && (
                <p className="text-xs text-destructive">{errors.label}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="study-year">Year</Label>
              <Input
                id="study-year"
                type="number"
                value={form.year}
                onChange={(e) => update("year", e.target.value)}
                placeholder="2020"
                aria-invalid={!!errors.year}
              />
              {errors.year && (
                <p className="text-xs text-destructive">{errors.year}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="study-design">Design</Label>
              <Select
                value={form.design || "__none__"}
                onValueChange={(v) => update("design", v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="study-design" className="w-full">
                  <SelectValue placeholder="Select design" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(unspecified)</SelectItem>
                  {STUDY_DESIGNS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="study-authors">Authors</Label>
              <Input
                id="study-authors"
                value={form.authors}
                onChange={(e) => update("authors", e.target.value)}
                placeholder="Smith J, Doe A, et al."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="study-doi">DOI</Label>
              <Input
                id="study-doi"
                value={form.doi}
                onChange={(e) => update("doi", e.target.value)}
                placeholder="10.1234/abc"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="study-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update("status", v)}
              >
                <SelectTrigger id="study-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="included">Included</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="study-index-test">Index test</Label>
                {isDta && (
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-900">
                    <Microscope className="size-2.5" />
                    DTA-specific
                  </Badge>
                )}
              </div>
              <Input
                id="study-index-test"
                value={form.indexTest}
                onChange={(e) => update("indexTest", e.target.value)}
                placeholder={isDta ? "e.g. Rapid antigen test" : "(optional)"}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="study-ref-standard">Reference standard</Label>
                {isDta && (
                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 border-sky-200 dark:border-sky-900">
                    <Microscope className="size-2.5" />
                    DTA-specific
                  </Badge>
                )}
              </div>
              <Input
                id="study-ref-standard"
                value={form.referenceStandard}
                onChange={(e) => update("referenceStandard", e.target.value)}
                placeholder={isDta ? "e.g. PCR confirmation" : "(optional)"}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="study-notes">Notes</Label>
              <Textarea
                id="study-notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                placeholder="Internal notes, PICOS summary, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white">
              {isEdit ? "Save changes" : "Add study"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StudiesPage() {
  const review = useReviewStore((s) => s.review);
  const deleteStudy = useReviewStore((s) => s.deleteStudy);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudy, setEditingStudy] = useState<Study | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!review) return null;

  const studies = review.studies;
  const studyToDelete = studies.find((s) => s.id === deleteId) ?? null;

  function openAdd() {
    setEditingStudy(null);
    setDialogOpen(true);
  }
  function openEdit(study: Study) {
    setEditingStudy(study);
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditingStudy(null);
  }

  function handleDelete() {
    if (!deleteId) return;
    const label = studyToDelete?.label ?? "this study";
    deleteStudy(deleteId);
    setDeleteId(null);
    toast.success("Study deleted", { description: label });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="size-6 text-teal-600" />
            Studies
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Included studies for data extraction and risk-of-bias assessment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-7 px-2.5">
            {studies.length} {studies.length === 1 ? "study" : "studies"}
          </Badge>
          <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="size-4" />
            Add study
          </Button>
        </div>
      </div>

      {/* Table or empty state */}
      {studies.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/20">
          <div className="mx-auto max-w-md space-y-3">
            <div className="mx-auto size-12 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center">
              <FileText className="size-6 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold">No studies yet</h3>
            <p className="text-sm text-muted-foreground">
              Add a study manually, or promote included references from the
              References page once you&apos;ve completed title/abstract screening.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Plus className="size-4" />
                Add study
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="min-w-[180px]">Label</TableHead>
                <TableHead className="w-20">Year</TableHead>
                <TableHead className="min-w-[140px] hidden md:table-cell">Design</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="min-w-[160px] hidden lg:table-cell">DOI</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.map((study) => (
                <TableRow key={study.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="truncate max-w-[260px] sm:max-w-md">
                        {study.label}
                      </span>
                      {study.authors && (
                        <span className="text-xs text-muted-foreground truncate max-w-[260px] sm:max-w-md">
                          {study.authors}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {study.year ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {study.design ? (
                      <span className="text-xs">{study.design}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(study.status)}>
                      {statusLabel(study.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {study.doi ? (
                      <a
                        href={doiUrl(study.doi)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-400 hover:underline"
                        title={study.doi}
                      >
                        {truncate(study.doi, 24)}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(study)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(study.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <StudyFormDialog
        key={editingStudy?.id ?? "__new__"}
        open={dialogOpen}
        study={editingStudy}
        onClose={closeDialog}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete study?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{studyToDelete?.label ?? "this study"}&quot;
              from the review, along with all of its data points and risk-of-bias
              assessments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="size-4" />
              Delete study
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
