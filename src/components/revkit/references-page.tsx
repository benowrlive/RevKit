"use client";

import { useMemo, useRef, useState } from "react";
import { useReviewStore } from "@/lib/project/state";
import { EXCLUDE_REASONS, type Reference } from "@/lib/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Plus,
  Upload,
  Check,
  X,
  HelpCircle,
  Trash2,
  ChevronUp,
  UserPlus,
  ClipboardList,
  MoreHorizontal,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";


interface ParsedRisRecord {
  title: string;
  authors: string;
  year: number | null;
  journal: string | null;
  doi: string | null;
  rawRis: string;
}

function decisionBadgeClass(decision: string | null | undefined): string {
  switch (decision) {
    case "INCLUDE":
      return "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 border-teal-200 dark:border-teal-900";
    case "EXCLUDE":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-200 dark:border-rose-900";
    case "MAYBE":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function decisionLabel(decision: string | null | undefined): string {
  switch (decision) {
    case "INCLUDE":
      return "Included";
    case "EXCLUDE":
      return "Excluded";
    case "MAYBE":
      return "Maybe";
    default:
      return "Pending";
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ---- RIS parser ---------------------------------------------------------

/** Parse a raw RIS blob into structured records. */
function parseRis(content: string): ParsedRisRecord[] {
  // Split on end-of-record marker: "ER  -" at start of line (allow extra whitespace).
  const chunks = content.split(/^ER\s*-\s?/m).filter((c) => c.trim().length > 0);
  const records: ParsedRisRecord[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/);
    const tags: { tag: string; value: string }[] = [];
    let currentTag: string | null = null;
    let currentValue: string[] = [];
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9]{2})\s*-\s?(.*)$/);
      if (m) {
        if (currentTag) {
          tags.push({ tag: currentTag, value: currentValue.join(" ").trim() });
        }
        currentTag = m[1];
        currentValue = [m[2]];
      } else if (currentTag && line.trim().length > 0) {
        // Continuation line for the previous tag.
        currentValue.push(line.trim());
      }
    }
    if (currentTag) {
      tags.push({ tag: currentTag, value: currentValue.join(" ").trim() });
    }
    if (tags.length === 0) continue;

    const title =
      tags.find((t) => t.tag === "TI")?.value ??
      tags.find((t) => t.tag === "T1")?.value ??
      tags.find((t) => t.tag === "ST")?.value ??
      "";
    const authors = tags
      .filter((t) => t.tag === "AU" || t.tag === "A1" || t.tag === "A2" || t.tag === "A3")
      .map((t) => t.value)
      .filter(Boolean)
      .join("; ")
      .trim();
    const yearStr =
      tags.find((t) => t.tag === "PY")?.value ??
      tags.find((t) => t.tag === "Y1")?.value ??
      tags.find((t) => t.tag === "DA")?.value;
    let year: number | null = null;
    if (yearStr) {
      const match = yearStr.match(/(\d{4})/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n)) year = n;
      }
    }
    const journal =
      tags.find((t) => t.tag === "JO")?.value ??
      tags.find((t) => t.tag === "JF")?.value ??
      tags.find((t) => t.tag === "JA")?.value ??
      tags.find((t) => t.tag === "J1")?.value ??
      null;
    const doi = tags.find((t) => t.tag === "DO")?.value ?? null;

    if (!title && !authors && !doi) continue;

    records.push({
      title: title.trim() || "(untitled)",
      authors: authors || "Unknown",
      year,
      journal,
      doi,
      rawRis: chunk.trim(),
    });
  }
  return records;
}

// ---- Exclude dialog -----------------------------------------------------

function ExcludeDialog({
  open,
  reference,
  onClose,
}: {
  open: boolean;
  reference: Reference | null;
  onClose: () => void;
}) {
  const updateReference = useReviewStore((s) => s.updateReference);
  const [reason, setReason] = useState<string>(
    () => reference?.excludeReason ?? EXCLUDE_REASONS[0] ?? ""
  );

  function handleConfirm() {
    if (!reference) return;
    updateReference(reference.id, {
      decision: "EXCLUDE",
      stage: "title_abstract",
      excludeReason: reason || (EXCLUDE_REASONS[0] ?? null),
    });
    toast.success("Reference excluded", {
      description: truncate(reference.title, 60),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="size-4 text-rose-600" />
            Exclude reference
          </DialogTitle>
          <DialogDescription>
            Choose a reason for excluding &quot;{reference ? truncate(reference.title, 60) : ""}&quot;.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="exclude-reason">Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="exclude-reason" className="w-full">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {EXCLUDE_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            <X className="size-4" />
            Exclude
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Import dialog ------------------------------------------------------

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addReferences = useReviewStore((s) => s.addReferences);
  const [tab, setTab] = useState<"paste" | "manual">("paste");
  const [pasteContent, setPasteContent] = useState("");
  const [parsed, setParsed] = useState<ParsedRisRecord[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual form state
  const [mTitle, setMTitle] = useState("");
  const [mAuthors, setMAuthors] = useState("");
  const [mYear, setMYear] = useState("");
  const [mJournal, setMJournal] = useState("");
  const [mDoi, setMDoi] = useState("");

  function handleParse(content: string) {
    setPasteContent(content);
    if (!content.trim()) {
      setParsed(null);
      setParseError(null);
      return;
    }
    try {
      const records = parseRis(content);
      if (records.length === 0) {
        setParsed(null);
        setParseError("No records found. Make sure each entry ends with 'ER  -'.");
        return;
      }
      setParsed(records);
      setParseError(null);
    } catch {
      setParsed(null);
      setParseError("Failed to parse RIS content.");
    }
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      handleParse(text);
      toast.success("File loaded", { description: file.name });
    } catch {
      toast.error("Failed to read file");
    }
  }

  function handleConfirmImport() {
    if (!parsed || parsed.length === 0) return;
    const before = parsed.length;
    const added = addReferences(
      parsed.map((r) => ({
        title: r.title,
        authors: r.authors,
        year: r.year,
        journal: r.journal,
        doi: r.doi,
        pmid: null,
        rawRis: r.rawRis,
        stage: "title_abstract",
        decision: null,
        excludeReason: null,
      }))
    );
    const skipped = before - added;
    toast.success("Import complete", {
      description: `Imported ${added} record${added === 1 ? "" : "s"}, ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped.`,
    });
    onClose();
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    const yearNum = mYear.trim() === "" ? null : Number(mYear);
    const added = addReferences([
      {
        title: mTitle.trim(),
        authors: mAuthors.trim() || "Unknown",
        year: Number.isFinite(yearNum as number) ? (yearNum as number) : null,
        journal: mJournal.trim() || null,
        doi: mDoi.trim() || null,
        pmid: null,
        rawRis: null,
        stage: "title_abstract",
        decision: null,
        excludeReason: null,
      },
    ]);
    if (added > 0) {
      toast.success("Reference added", { description: truncate(mTitle.trim(), 60) });
    } else {
      toast.info("Duplicate skipped", {
        description: "A reference with the same title and year already exists.",
      });
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Import references
          </DialogTitle>
          <DialogDescription>
            Paste RIS content exported from PubMed, EndNote, or Zotero, or add a
            single reference manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "paste" | "manual")}>
          <TabsList>
            <TabsTrigger value="paste">
              <ClipboardList className="size-3.5" />
              Paste RIS
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Plus className="size-3.5" />
              Manual entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-3 mt-2">
            {/* Drag-drop / file upload area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                isDragging
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                  : "border-muted-foreground/30 hover:border-teal-400 hover:bg-muted/40"
              }`}
            >
              <FileUp className="size-6 mx-auto text-muted-foreground" />
              <p className="text-sm mt-1.5">
                <span className="text-teal-700 dark:text-teal-400 font-medium">
                  Click to upload
                </span>{" "}
                or drag &amp; drop a .ris file
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Accepts .ris and .txt exports
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ris,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ris-paste">RIS content</Label>
              <Textarea
                id="ris-paste"
                value={pasteContent}
                onChange={(e) => handleParse(e.target.value)}
                rows={10}
                placeholder={`TY  - JOUR\nTI  - Title of article\nAU  - Author One\nAU  - Author Two\nPY  - 2023\nJO  - Journal Name\nDO  - 10.1234/abc\nER  -`}
                className="font-mono text-xs"
              />
            </div>

            {parseError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <X className="size-3.5" />
                {parseError}
              </p>
            )}

            {parsed && parsed.length > 0 && (
              <Card className="p-3 bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900">
                <div className="flex items-start gap-2">
                  <Check className="size-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-teal-900 dark:text-teal-100">
                      Parsed {parsed.length} record{parsed.length === 1 ? "" : "s"}.
                    </p>
                    <p className="text-muted-foreground">
                      First: {truncate(parsed[0].title, 70)}
                    </p>
                    {parsed.length > 1 && (
                      <p className="text-muted-foreground mt-0.5">
                        Last: {truncate(parsed[parsed.length - 1].title, 70)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={!parsed || parsed.length === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Check className="size-4" />
                Import {parsed ? parsed.length : 0} record{!parsed || parsed.length === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="manual" className="mt-2">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="m-title"
                  value={mTitle}
                  onChange={(e) => setMTitle(e.target.value)}
                  placeholder="Article title"
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="m-authors">Authors</Label>
                  <Input
                    id="m-authors"
                    value={mAuthors}
                    onChange={(e) => setMAuthors(e.target.value)}
                    placeholder="Smith J; Doe A"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-year">Year</Label>
                  <Input
                    id="m-year"
                    type="number"
                    value={mYear}
                    onChange={(e) => setMYear(e.target.value)}
                    placeholder="2023"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="m-journal">Journal</Label>
                  <Input
                    id="m-journal"
                    value={mJournal}
                    onChange={(e) => setMJournal(e.target.value)}
                    placeholder="Journal name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-doi">DOI</Label>
                  <Input
                    id="m-doi"
                    value={mDoi}
                    onChange={(e) => setMDoi(e.target.value)}
                    placeholder="10.1234/abc"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Plus className="size-4" />
                  Add reference
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main page ----------------------------------------------------------

type FilterValue = "all" | "included" | "excluded" | "maybe" | "pending";

function matchesFilter(ref: Reference, filter: FilterValue): boolean {
  switch (filter) {
    case "all":
      return true;
    case "included":
      return ref.decision === "INCLUDE";
    case "excluded":
      return ref.decision === "EXCLUDE";
    case "maybe":
      return ref.decision === "MAYBE";
    case "pending":
      return ref.decision === null || ref.decision === undefined;
  }
}

export function ReferencesPage() {
  const review = useReviewStore((s) => s.review);
  const updateReference = useReviewStore((s) => s.updateReference);
  const deleteReference = useReviewStore((s) => s.deleteReference);
  const promoteReferenceToStudy = useReviewStore((s) => s.promoteReferenceToStudy);

  const [importOpen, setImportOpen] = useState(false);
  const [excludeRef, setExcludeRef] = useState<Reference | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>("all");

  const references = review?.references ?? [];
  const filtered = useMemo(
    () => references.filter((r) => matchesFilter(r, filter)),
    [references, filter]
  );

  const refToDelete = references.find((r) => r.id === deleteId) ?? null;

  if (!review) return null;

  function handleInclude(ref: Reference) {
    updateReference(ref.id, { decision: "INCLUDE", stage: "title_abstract" });
    toast.success("Marked as included", { description: truncate(ref.title, 60) });
  }
  function handleMaybe(ref: Reference) {
    updateReference(ref.id, { decision: "MAYBE", stage: "title_abstract" });
    toast.success("Marked as maybe", { description: truncate(ref.title, 60) });
  }
  function handlePromote(ref: Reference) {
    const studyId = promoteReferenceToStudy(ref.id);
    if (studyId) {
      toast.success("Promoted to study", {
        description: truncate(ref.title, 60),
      });
    } else {
      toast.error("Could not promote reference");
    }
  }
  function handleDelete() {
    if (!deleteId) return;
    const title = refToDelete?.title ?? "this reference";
    deleteReference(deleteId);
    setDeleteId(null);
    toast.success("Reference deleted", { description: truncate(title, 60) });
  }

  const counts = {
    all: references.length,
    included: references.filter((r) => r.decision === "INCLUDE").length,
    excluded: references.filter((r) => r.decision === "EXCLUDE").length,
    maybe: references.filter((r) => r.decision === "MAYBE").length,
    pending: references.filter((r) => r.decision === null || r.decision === undefined).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="size-6 text-teal-600" />
            References
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Screening and management of imported citations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-7 px-2.5">
            {references.length} {references.length === 1 ? "reference" : "references"}
          </Badge>
          <Button onClick={() => setImportOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Upload className="size-4" />
            Import references
          </Button>
        </div>
      </div>

      {/* Screening filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Filter:</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({counts.all})</SelectItem>
            <SelectItem value="included">Included ({counts.included})</SelectItem>
            <SelectItem value="excluded">Excluded ({counts.excluded})</SelectItem>
            <SelectItem value="maybe">Maybe ({counts.maybe})</SelectItem>
            <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table or empty state */}
      {references.length === 0 ? (
        <Card className="p-10 text-center border-dashed bg-muted/20">
          <div className="mx-auto max-w-md space-y-3">
            <div className="mx-auto size-12 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center">
              <FileText className="size-6 text-teal-600" />
            </div>
            <h3 className="text-lg font-semibold">No references yet</h3>
            <p className="text-sm text-muted-foreground">
              Import citations from PubMed, EndNote, or Zotero via an RIS export,
              or add a single reference manually.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button onClick={() => setImportOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                <Upload className="size-4" />
                Import references
              </Button>
            </div>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No references match the current filter.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="min-w-[260px]">Title</TableHead>
                <TableHead className="min-w-[160px] hidden md:table-cell">Authors</TableHead>
                <TableHead className="w-20 hidden sm:table-cell">Year</TableHead>
                <TableHead className="min-w-[140px] hidden lg:table-cell">Journal</TableHead>
                <TableHead className="w-28">Decision</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ref) => (
                <TableRow key={ref.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      {ref.title.length > 70 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium cursor-help truncate max-w-[260px] sm:max-w-[420px]">
                              {truncate(ref.title, 70)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            {ref.title}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="font-medium">{ref.title}</span>
                      )}
                      {ref.doi && (
                        <a
                          href={`https://doi.org/${ref.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-teal-700 dark:text-teal-400 hover:underline"
                        >
                          doi:{ref.doi}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    <span className="text-xs line-clamp-2 max-w-[220px]">
                      {ref.authors || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell tabular-nums text-muted-foreground">
                    {ref.year ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    <span className="text-xs line-clamp-1 max-w-[180px]">
                      {ref.journal ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={decisionBadgeClass(ref.decision)}>
                      {decisionLabel(ref.decision)}
                    </Badge>
                    {ref.excludeReason && ref.decision === "EXCLUDE" && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 max-w-[140px]">
                        {ref.excludeReason}
                      </div>
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
                      <DropdownMenuContent align="end" className="min-w-[180px]">
                        <DropdownMenuItem onClick={() => handleInclude(ref)}>
                          <Check className="size-4 text-teal-600" />
                          Include
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMaybe(ref)}>
                          <HelpCircle className="size-4 text-amber-600" />
                          Maybe
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setExcludeRef(ref)}>
                          <X className="size-4 text-rose-600" />
                          Exclude…
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handlePromote(ref)}>
                          <UserPlus className="size-4" />
                          Promote to study
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteId(ref.id)}
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

      {/* Summary footer */}
      {references.length > 0 && (
        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <Check className="size-3 inline mr-1 text-teal-600" />
            {counts.included} included
          </span>
          <span>
            <HelpCircle className="size-3 inline mr-1 text-amber-600" />
            {counts.maybe} maybe
          </span>
          <span>
            <X className="size-3 inline mr-1 text-rose-600" />
            {counts.excluded} excluded
          </span>
          <span>
            <ChevronUp className="size-3 inline mr-1 text-muted-foreground" />
            {counts.pending} pending
          </span>
        </div>
      )}

      <ImportDialog
        key={importOpen ? "open" : "closed"}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <ExcludeDialog
        key={excludeRef?.id ?? "__closed__"}
        open={excludeRef !== null}
        reference={excludeRef}
        onClose={() => setExcludeRef(null)}
      />
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reference?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{refToDelete ? truncate(refToDelete.title, 60) : "this reference"}&quot;
              from the review. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="size-4" />
              Delete reference
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
