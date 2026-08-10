// src/lib/project/id.ts — id + recent-files helpers (browser-side)

export function newId(prefix = ""): string {
  const uuid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
}

const RECENT_FILES_KEY = "revkit:recent-files";
const MAX_RECENT = 10;

export interface RecentFileEntry {
  id: string;
  title: string;
  type: string;
  savedAt: string;
}

export function loadRecentFiles(): RecentFileEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFileEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function addRecentFile(entry: RecentFileEntry): RecentFileEntry[] {
  if (typeof window === "undefined") return [];
  const existing = loadRecentFiles().filter((r) => r.id !== entry.id);
  const next = [entry, ...existing].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function removeRecentFile(id: string): RecentFileEntry[] {
  if (typeof window === "undefined") return [];
  const next = loadRecentFiles().filter((r) => r.id !== id);
  window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(next));
  return next;
}
