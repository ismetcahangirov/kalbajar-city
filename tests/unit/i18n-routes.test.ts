import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { pathnames } from "@/i18n/routing";

const localeRoot = fileURLToPath(new URL("../../src/app/[locale]", import.meta.url));

/** Routes under src/app/[locale], as the internal paths routing.ts lists. */
function pageRoutes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pageRoutes(path);
    if (entry.name !== "page.tsx") return [];
    const segments = relative(localeRoot, dir)
      .split(sep)
      .filter((segment) => segment && !/^\(.*\)$/.test(segment));
    return [`/${segments.join("/")}`];
  });
}

const routes = pageRoutes(localeRoot).filter((route) => !route.includes("[...rest]"));

describe("public routes", () => {
  it("lists every page in routing.ts and nothing else", () => {
    expect(routes.sort()).toEqual(Object.keys(pathnames).sort());
  });

  it("keeps route segments Azerbaijani in every locale", () => {
    for (const [internal, external] of Object.entries(pathnames)) {
      expect(external, internal).toBe(internal);
    }
  });
});
