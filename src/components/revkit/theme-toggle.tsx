"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Moon, Sun, Desktop } from "@phosphor-icons/react";

// useSyncExternalStore replaces the useState+useEffect "mounted" pattern.
// Returns false during SSR (server snapshot) and true after hydration
// (client snapshot) — no setState in effect, so no cascading render warning.
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * ThemeToggle — compact 3-state theme switcher.
 *
 * Three buttons in a tiny segmented control: Light / Dark / System.
 * Active state shows the teal accent. Uses next-themes under the hood.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Avoid hydration mismatch — next-themes reads localStorage in effect.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) {
    return <div className="h-7 w-[88px]" aria-hidden />; // placeholder to prevent layout shift
  }

  const current = theme ?? "dark";

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex h-7 items-center rounded-md border border-border bg-surface p-0.5"
    >
      {(["light", "dark", "system"] as const).map((t) => {
        const Icon = t === "light" ? Sun : t === "dark" ? Moon : Desktop;
        const active = current === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={active}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
            className={`inline-flex h-6 w-7 items-center justify-center rounded transition-colors ${
              active
                ? "bg-accent-subtle text-accent"
                : "text-muted-fg hover:text-fg-2 hover:bg-surface-hover"
            }`}
          >
            <Icon weight={active ? "fill" : "regular"} size={14} />
          </button>
        );
      })}
    </div>
  );
}
