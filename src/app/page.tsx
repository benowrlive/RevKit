"use client";

import { useEffect, useState } from "react";
import { WelcomeScreen } from "@/components/revkit/welcome-screen";
import { WorkspaceShell, OverviewPage, type WorkspaceTab } from "@/components/revkit/workspace-shell";
import { StudiesPage } from "@/components/revkit/studies-page";
import { ReferencesPage } from "@/components/revkit/references-page";
import { ComparisonsPage } from "@/components/revkit/comparisons-page";
import { RobPage } from "@/components/revkit/rob-page";
import { PrismaPage } from "@/components/revkit/prisma-page";
import { ExportPage } from "@/components/revkit/export-page";
import { SettingsPage } from "@/components/revkit/settings-page";
import { useReviewStore } from "@/lib/project/state";
import type { ReviewType, ReviewSubType } from "@/lib/types";
import { toast } from "sonner";

export default function Home() {
  const [view, setView] = useState<"welcome" | "workspace">("welcome");
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [welcomeRefreshKey, setWelcomeRefreshKey] = useState(0);

  const review = useReviewStore((s) => s.review);
  const setReview = useReviewStore((s) => s.setReview);
  const newReviewAction = useReviewStore((s) => s.newReview);

  async function handleNew(input: {
    title: string;
    type: ReviewType;
    subType: ReviewSubType;
    researchQuestion: string;
  }) {
    newReviewAction(input);
    setView("workspace");
    setTab("overview");
    toast.success("New review created", { description: input.title });
  }

  async function handleOpen(id: string) {
    try {
      const res = await fetch(`/api/reviews/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { review: Parameters<typeof setReview>[0] };
      if (data.review) {
        setReview(data.review);
        useReviewStore.setState({ dbId: id });
        setView("workspace");
        setTab("overview");
      }
    } catch (e) {
      toast.error("Failed to open review", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  function handleExit() {
    if (useReviewStore.getState().isDirty) {
      if (!confirm("You have unsaved changes. Exit to library anyway?")) return;
    }
    setView("welcome");
    setWelcomeRefreshKey((k) => k + 1);
    setReview(null);
    useReviewStore.setState({ dbId: null });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (view !== "workspace") return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === "s") {
        e.preventDefault();
        // Find and click save button
        const btn = document.querySelector<HTMLButtonElement>("[data-save-btn]");
        btn?.click();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  if (view === "welcome" || !review) {
    return <WelcomeScreen onNew={handleNew} onOpen={handleOpen} refreshKey={welcomeRefreshKey} />;
  }

  return (
    <WorkspaceShell active={tab} onTabChange={setTab} onExit={handleExit}>
      {tab === "overview" && <OverviewPage />}
      {tab === "studies" && <StudiesPage />}
      {tab === "references" && <ReferencesPage />}
      {tab === "comparisons" && <ComparisonsPage />}
      {tab === "rob" && <RobPage />}
      {tab === "prisma" && <PrismaPage />}
      {tab === "export" && <ExportPage />}
      {tab === "settings" && <SettingsPage />}
    </WorkspaceShell>
  );
}
