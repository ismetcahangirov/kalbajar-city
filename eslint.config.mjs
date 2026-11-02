import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Client-side application data goes through RTK Query (`src/store`), never
  // an ad-hoc fetch in a page or component (CLAUDE.md → Data and state).
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Use an RTK Query endpoint from src/store instead." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "fetch", message: "Use an RTK Query endpoint." },
        { object: "globalThis", property: "fetch", message: "Use an RTK Query endpoint." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local browser-automation scratch files (gitignored).
    ".playwright-mcp/**",
  ]),
]);

export default eslintConfig;
