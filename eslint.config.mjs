import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // ─── TypeScript rules ─────────────────────────────────────────
    // Re-enabled (P1 cleanup pass):
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    }],
    "prefer-const": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-debugger": "error",
    "no-unreachable": "error",
    "no-useless-escape": "warn",

    // Still off — needs deeper refactors before enabling:
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // ─── React rules ──────────────────────────────────────────────
    // Still off — these rules don't fit the current state-management
    // patterns (Zustand store + Radix UI). Re-enabling requires real
    // refactors. Documented as tech debt.
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react-hooks/set-state-in-effect": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // ─── Next.js rules ────────────────────────────────────────────
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // ─── General JavaScript rules still off (low value) ────────────
    "no-unused-vars": "off", // covered by @typescript-eslint/no-unused-vars
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
  },
}, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "examples/**",
    "skills/**",
    "tests/**",
  ],
}];

export default eslintConfig;
