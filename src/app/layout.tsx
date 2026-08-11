import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/revkit/theme-provider";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RevKit — Modern RevMan Clone",
  description:
    "RevKit is an open-source web app for building Cochrane-style systematic reviews. Compact, dense, data-first. Supports all 5 review types with meta-analysis, risk-of-bias, PRISMA flow, and Word/CSV export.",
  keywords: ["RevKit", "RevMan", "systematic review", "meta-analysis", "Cochrane", "PRISMA", "RoB 2", "ROBINS-I", "QUADAS-2"],
  authors: [{ name: "RevKit Contributors" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
          <SonnerToaster
            richColors
            position="top-right"
            theme="system"
            toastOptions={{
              style: {
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
