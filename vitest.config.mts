import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // next-intl's navigation imports `next/navigation` without an extension,
    // which Node's ESM resolver rejects; Vite resolves it when it inlines them.
    server: { deps: { inline: ["next-intl"] } },
  },
});
