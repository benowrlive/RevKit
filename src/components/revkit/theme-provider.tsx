"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * ThemeProvider — wraps next-themes.
 *
 * Default: "dark" (RevKit is a power-user tool; dark is the expected default
 * for analysis software). User can switch to "light" or "system" via the
 * toggle in the workspace topbar or on the welcome screen.
 *
 * The `class` attribute strategy lets our CSS flip via `.light` / `.dark`
 * selectors (we override `:root` with `.light` in globals.css).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      themes={["dark", "light"]}
    >
      {children}
    </NextThemesProvider>
  );
}
