// Fails when a colour or easing literal appears outside the token files.
// Every colour comes from src/styles/tokens.css (docs/ui-kit.md); motion
// constants also live in src/lib/motion/tokens.ts (docs/motion-system.md).
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const allowed = new Set(["src/styles/tokens.css", "src/lib/motion/tokens.ts"]);
const extensions = /\.(css|ts|tsx|mts|mjs|js|jsx)$/;

const rules = [
  {
    name: "hex colour",
    pattern: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  },
  { name: "colour function", pattern: /\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/g },
  { name: "easing curve", pattern: /\bcubic-bezier\(/g },
  // `--spacing-block` makes Tailwind emit an `inline-<spacing>` size utility
  // named `inline-block` (inline-size: 4rem) next to the display utility, so
  // the class squeezes its element to 64 px. Use `inline-grid` or
  // `inline-flex` (found in #17: the stat numerals overlapped their unit).
  {
    name: "inline-block class, collides with --spacing-block",
    // Not after a colon: `display: inline-block` in CSS is fine.
    pattern: /(?<![\w-])(?<!:\s*)inline-block(?![\w-])/g,
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (extensions.test(entry.name)) yield path;
  }
}

const failures = [];
for (const file of walk(join(root, "src"))) {
  const rel = relative(root, file).split(sep).join("/");
  if (allowed.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const { name, pattern } of rules) {
      for (const match of line.matchAll(pattern)) {
        failures.push(`${rel}:${index + 1}:${match.index + 1}  ${name} "${match[0]}"`);
      }
    }
  });
}

if (failures.length) {
  console.error("Literals outside the token files (use a token from src/styles/tokens.css):");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("check-tokens: no colour or easing literals outside the token files");
