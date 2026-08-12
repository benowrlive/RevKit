// src/lib/team/store.ts — Zustand store for the local team + user profile.
//
// Backed by SQLite via the /api/team endpoints. State is loaded once on
// mount (in page.tsx) and cached client-side; mutations write through
// to the server.

"use client";

import { create } from "zustand";

export interface TeamMember {
  id: string;
  name: string;
  email?: string | null;
  role: TeamRole;
  initials: string;
  color: string;
  isCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TeamRole =
  | "lead_reviewer"
  | "reviewer"
  | "methodologist"
  | "statistician"
  | "librarian"
  | "consumer";

export const TEAM_ROLES: { value: TeamRole; label: string; description: string }[] = [
  { value: "lead_reviewer", label: "Lead reviewer", description: "Owns the review, makes final calls on disputes." },
  { value: "reviewer", label: "Reviewer", description: "Screens references, extracts data, runs RoB assessments." },
  { value: "methodologist", label: "Methodologist", description: "Designs the search strategy + analysis plan." },
  { value: "statistician", label: "Statistician", description: "Reviews the meta-analysis + heterogeneity plan." },
  { value: "librarian", label: "Librarian", description: "Runs the literature search + dedup." },
  { value: "consumer", label: "Consumer", description: "Patient / public representative. Reviews plain-language summary." },
];

export const TEAM_COLORS = [
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#ec4899", // pink
  "#84cc16", // lime
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f97316", // orange
];

export interface UserProfile {
  density: "compact" | "default" | "dense";
  fontScale: "small" | "medium" | "large";
  reduceMotion: boolean;
  tooltipsEnabled: boolean;
  tooltipsDensity: "minimal" | "detailed";
  defaultEffectMeasure: string;
  defaultMethod: string;
  defaultModel: "fixed" | "random";
  defaultConfidence: number;
  decimalPlaces: number;
  autoBackupMinutes: number;
  maxRecentFiles: number;
}

export const DEFAULT_PROFILE: UserProfile = {
  density: "compact",
  fontScale: "medium",
  reduceMotion: false,
  tooltipsEnabled: true,
  tooltipsDensity: "detailed",
  defaultEffectMeasure: "OR",
  defaultMethod: "MH",
  defaultModel: "fixed",
  defaultConfidence: 0.95,
  decimalPlaces: 2,
  autoBackupMinutes: 15,
  maxRecentFiles: 20,
};

interface TeamState {
  members: TeamMember[];
  currentMember: TeamMember | null;
  profile: UserProfile;
  loading: boolean;

  setMembers: (members: TeamMember[]) => void;
  setCurrentMember: (m: TeamMember | null) => void;
  setProfile: (p: UserProfile) => void;
  setLoading: (b: boolean) => void;

  addMember: (input: Omit<TeamMember, "id" | "createdAt" | "updatedAt">) => Promise<TeamMember | null>;
  updateMember: (id: string, patch: Partial<TeamMember>) => Promise<boolean>;
  deleteMember: (id: string) => Promise<boolean>;
  setCurrent: (id: string) => Promise<boolean>;
  saveProfile: (p: UserProfile) => Promise<boolean>;
}

function randomColor(): string {
  return TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)] ?? "#14b8a6";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  currentMember: null,
  profile: DEFAULT_PROFILE,
  loading: true,

  setMembers: (members) => {
    set({ members, currentMember: members.find((m) => m.isCurrentUser) ?? null });
  },
  setCurrentMember: (m) => set({ currentMember: m }),
  setProfile: (p) => set({ profile: p }),
  setLoading: (b) => set({ loading: b }),

  addMember: async (input) => {
    try {
      const payload = {
        name: input.name,
        email: input.email ?? null,
        role: input.role,
        initials: input.initials || initialsFromName(input.name),
        color: input.color || randomColor(),
        isCurrentUser: input.isCurrentUser,
      };
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { member: TeamMember };
      set((s) => {
        const members = input.isCurrentUser
          ? [data.member, ...s.members.map((m) => ({ ...m, isCurrentUser: false }))]
          : [...s.members, data.member];
        return {
          members,
          currentMember: input.isCurrentUser ? data.member : s.currentMember,
        };
      });
      return data.member;
    } catch (e) {
      console.error("addMember failed", e);
      return null;
    }
  },

  updateMember: async (id, patch) => {
    try {
      const res = await fetch("/api/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set((s) => ({
        members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        currentMember:
          s.currentMember?.id === id
            ? { ...s.currentMember, ...patch }
            : s.currentMember,
      }));
      return true;
    } catch (e) {
      console.error("updateMember failed", e);
      return false;
    }
  },

  deleteMember: async (id) => {
    try {
      const res = await fetch(`/api/team?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set((s) => ({
        members: s.members.filter((m) => m.id !== id),
        currentMember: s.currentMember?.id === id ? null : s.currentMember,
      }));
      return true;
    } catch (e) {
      console.error("deleteMember failed", e);
      return false;
    }
  },

  setCurrent: async (id) => {
    const ok = await get().updateMember(id, { isCurrentUser: true });
    if (ok) {
      set((s) => ({
        members: s.members.map((m) => ({
          ...m,
          isCurrentUser: m.id === id,
        })),
        currentMember: s.members.find((m) => m.id === id) ?? null,
      }));
    }
    return ok;
  },

  saveProfile: async (p) => {
    try {
      const res = await fetch("/api/team/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set({ profile: p });
      return true;
    } catch (e) {
      console.error("saveProfile failed", e);
      return false;
    }
  },
}));

export function initialsFrom(member: { name: string; initials?: string } | null | undefined): string {
  if (!member) return "?";
  if (member.initials && member.initials.length > 0) return member.initials.toUpperCase();
  return initialsFromName(member.name);
}
