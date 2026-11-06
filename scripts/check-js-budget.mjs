// Checks the JavaScript budget of every public route (CLAUDE.md §5) from
// the production build in .next, so it needs neither a server nor a
// database. Run it after `pnpm build`.
//
// What a route's first load costs is the scripts its HTML loads:
//   - the framework's root chunks (`rootMainFiles` in build-manifest.json),
//     loaded on every page of the site;
//   - the client chunks of every segment in the route's tree (layouts, the
//     page, error and not-found boundaries), listed per entry in the
//     route's client reference manifest (`entryJSFiles`).
// The polyfill chunk is left out: it is `nomodule`, so browsers that run
// modules never fetch it. Chunks behind `next/dynamic` or `import()` are
// left out too: they are not part of the first load, which is the point
// of deferring them.
//
// Each chunk is counted once per route, gzipped at level 9.
//
// Two budgets, because they are fixed by different decisions:
//   - shared: the chunks every public route loads (framework plus the
//     locale layout). A route cannot shed them, and a browser caches them
//     after the first page, so they are budgeted once for the whole site.
//   - route: what a route loads on top of the shared chunks. This is what
//     a page's own components cost, and what a change to a page moves.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

// Console-only code must never reach a public route: the rich-text editor
// (TipTap on ProseMirror, #25) is the heaviest of it. A public route chunk
// that carries it fails the check whatever its size.

const KB = 1024;
/** CLAUDE.md §5. Change them there and here together. */
export const budgets = { shared: 160 * KB, route: 40 * KB };

const root = fileURLToPath(new URL("..", import.meta.url));
const next = join(root, ".next");
const publicApp = join(next, "server", "app", "[locale]");

/** The page's client reference manifest, as the server loads it. */
function readManifest(file) {
  const sandbox = {};
  runInNewContext(readFileSync(file, "utf8"), sandbox);
  return sandbox.__RSC_MANIFEST;
}

/** Every public page's manifest: each `page_client-reference-manifest.js` under `[locale]`. */
function* pageManifests(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* pageManifests(path);
    else if (entry.name === "page_client-reference-manifest.js") yield path;
  }
}

/**
 * The entries whose chunks the route's HTML loads: the route's segments and
 * the boundaries around them, Next's built-in ones included. Metadata routes
 * (`--metadata`) render images, not pages, and `global-not-found` replaces
 * the whole tree for an unmatched URL, so neither is part of a route's page.
 * Checked against the `<script src>` tags of the served HTML while building
 * this (#30): the two agree chunk for chunk.
 */
function isPageEntry(key) {
  return !key.endsWith("--metadata") && !key.endsWith("/src/app/global-not-found");
}

const gzipCache = new Map();
function gzipSize(chunk) {
  let size = gzipCache.get(chunk);
  if (size === undefined) {
    size = gzipSync(readFileSync(join(next, chunk)), { level: 9 }).length;
    gzipCache.set(chunk, size);
  }
  return size;
}

/** Marks code only the console may load; ProseMirror names its DOM classes so. */
const consoleOnly = /ProseMirror/;

const leakCache = new Map();
function leaks(chunk) {
  let found = leakCache.get(chunk);
  if (found === undefined) {
    found = consoleOnly.test(readFileSync(join(next, chunk), "utf8"));
    leakCache.set(chunk, found);
  }
  return found;
}

const sum = (chunks) => [...chunks].reduce((total, chunk) => total + gzipSize(chunk), 0);
const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

export function measure() {
  const buildManifest = JSON.parse(readFileSync(join(next, "build-manifest.json"), "utf8"));
  const framework = buildManifest.rootMainFiles;

  const routes = [];
  for (const file of pageManifests(publicApp)) {
    const manifest = readManifest(file);
    const route =
      "/" +
      relative(join(next, "server", "app"), file)
        .split(sep)
        .slice(0, -1)
        .join("/");
    const entries = manifest[`${route}/page`]?.entryJSFiles;
    if (!entries) throw new Error(`No entry for ${route}/page in ${relative(root, file)}`);
    const chunks = new Set(framework);
    for (const [key, files] of Object.entries(entries)) {
      if (isPageEntry(key)) for (const chunk of files) chunks.add(chunk);
    }
    routes.push({ route, chunks });
  }
  if (routes.length === 0) throw new Error("No public route found in the build.");

  const shared = new Set(routes[0].chunks);
  for (const { chunks } of routes)
    for (const chunk of shared) if (!chunks.has(chunk)) shared.delete(chunk);

  return {
    shared: sum(shared),
    routes: routes
      .map(({ route, chunks }) => ({
        route,
        total: sum(chunks),
        own: sum([...chunks].filter((chunk) => !shared.has(chunk))),
        consoleOnly: [...chunks].filter(leaks),
      }))
      .sort((a, b) => a.route.localeCompare(b.route)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(next, "build-manifest.json"))) {
    console.error("No production build in .next. Run `pnpm build` first.");
    process.exit(1);
  }
  const { shared, routes } = measure();
  const failures = [];

  console.log(`Shared by every public route: ${kb(shared)} (budget ${kb(budgets.shared)})`);
  if (shared > budgets.shared)
    failures.push(`shared chunks: ${kb(shared)} > ${kb(budgets.shared)}`);
  console.log("");
  console.log(`${"Route".padEnd(36)}${"own".padStart(10)}${"total".padStart(10)}`);
  for (const { route, own, total, consoleOnly: leaked } of routes) {
    for (const chunk of leaked) failures.push(`${route}: console-only code (editor) in ${chunk}`);
    const over = own > budgets.route;
    console.log(
      `${route.padEnd(36)}${kb(own).padStart(10)}${kb(total).padStart(10)}${over ? "  OVER" : ""}`,
    );
    if (over) failures.push(`${route}: ${kb(own)} > ${kb(budgets.route)}`);
  }
  console.log("");
  console.log(`Route budget: ${kb(budgets.route)} on top of the shared chunks (gzip -9).`);

  if (failures.length > 0) {
    console.error(`\nJS budget exceeded (CLAUDE.md §5):\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
}
