import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { pageNamespaces, pickMessages, shellMessages } from "@/i18n/client-messages";
import az from "@/i18n/messages/az.json";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

const read = (file: string) => readFileSync(file, "utf8");
const isClient = (file: string) => /^\s*["']use client["']/.test(read(file));

function resolve(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join("src", specifier.slice(2))
    : specifier.startsWith(".")
      ? join(dirname(from), specifier)
      : null;
  if (!base) return null;
  return (
    [".ts", ".tsx", "/index.ts", "/index.tsx"].map((end) => base + end).find(existsSync) ?? null
  );
}

/** The modules `roots` import, themselves included. */
function closure(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, specifier] of read(file).matchAll(/(?:from\s+|import\s*\(\s*)"([^"]+)"/g)) {
      const target = resolve(file, specifier!);
      if (target) queue.push(target);
    }
  }
  return seen;
}

const publicFiles = sources("src").filter((file) => !file.includes("/admin/"));
/** Every module in the public client bundle. */
const clientModules = closure(publicFiles.filter(isClient));

/** The namespaces a set of modules reads with `useTranslations`. */
function namespacesIn(files: Iterable<string>): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    for (const [, name] of read(file).matchAll(/useTranslations\(\s*"([^".]+)/g)) names.add(name!);
  }
  return names;
}

const sentByShell = new Set(shellMessages.map((name) => name.split(".")[0]!));
const allowed = new Set<string>([...sentByShell, ...pageNamespaces]);

describe("the messages sent to the client", () => {
  it("include every namespace a client component reads", () => {
    const needed = [...namespacesIn(clientModules)];
    expect(needed.length).toBeGreaterThan(0);
    expect(needed.filter((name) => !allowed.has(name))).toEqual([]);
  });

  it("are only read by a literal namespace, so the checks here see them all", () => {
    const dynamic = [...clientModules].filter((file) => {
      const code = read(file);
      return /useTranslations\(\s*[^"\s]/.test(code) || /useMessages\(/.test(code);
    });
    expect(dynamic).toEqual([]);
  });

  it("are sent around a page's islands by every page that shows them", () => {
    const pages = publicFiles.filter((file) => file.endsWith("/page.tsx"));
    for (const page of pages) {
      const reachable = closure([page]);
      const client = closure([...reachable].filter(isClient));
      const needed = [...namespacesIn(client)].filter(
        (name) => !sentByShell.has(name) && (pageNamespaces as readonly string[]).includes(name),
      );
      const sent = new Set(
        [...reachable].flatMap((file) =>
          [...read(file).matchAll(/<PageMessages namespaces=\{\[([^\]]*)\]\}/g)].flatMap(
            ([, list]) => [...list!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!),
          ),
        ),
      );
      expect(
        needed.filter((name) => !sent.has(name)),
        page,
      ).toEqual([]);
    }
  });

  it("cover each key the form reads", () => {
    const code = read("src/components/leads/lead-form.tsx");
    const keys = [...code.matchAll(/\bt(?:\.rich)?\(\s*[`"]([a-zA-Z]+)/g)].map(
      (match) => match[1]!,
    );
    expect(keys.length).toBeGreaterThan(10);
    expect(
      keys.filter((key) => !(shellMessages as readonly string[]).includes(`LeadForm.${key}`)),
    ).toEqual([]);
  });

  it("cover each key the shell reads from a namespace it sends in part", () => {
    const keys = [...read("src/components/shell/page-transition.tsx").matchAll(/\bt\("([^"]+)"/g)];
    expect(
      keys
        .map(([, key]) => `Shell.${key}`)
        .filter((key) => !shellMessages.some((name) => name === key)),
    ).toEqual([]);
  });

  it("name parts that exist, and leave the rest of the catalogue out", () => {
    const shell = pickMessages(az, shellMessages);
    expect(Object.keys(shell).sort()).toEqual(["ErrorPage", "LeadForm", "LocaleSwitcher", "Shell"]);
    expect(shell.Shell).toEqual({ brand: az.Shell.brand });
    expect(
      Object.keys(az.LeadForm)
        .filter((key) => !(key in (shell.LeadForm as object)))
        .sort(),
    ).toEqual(["heading", "intro"]);
    const pages = pickMessages(az, pageNamespaces);
    for (const namespace of pageNamespaces) expect(pages[namespace]).toBeDefined();
    expect(JSON.stringify(shell).length).toBeLessThan(JSON.stringify(az).length / 5);
  });
});
