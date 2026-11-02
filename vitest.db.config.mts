import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Database tests: `pnpm test:db`, against a throwaway `<name>_test` database. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server modules (getDb, getAuth) are tested directly, outside React.
      "server-only": fileURLToPath(new URL("./tests/db/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/db/global-setup.ts"],
    // One database: files must not interleave their transactions' locks.
    fileParallelism: false,
  },
});
