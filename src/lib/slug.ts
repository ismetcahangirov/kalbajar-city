/**
 * Slugs are Azerbaijani in every locale (`CLAUDE.md` §3), so they are made
 * from the `az` text. Azerbaijani letters that NFKD does not reduce to ASCII
 * are mapped by hand; the rest (ç, ş, ö, ü, ğ) would decompose, but mapping
 * them here keeps the rule in one visible table.
 */
const azerbaijani: Record<string, string> = {
  ə: "e",
  ğ: "g",
  ı: "i",
  ş: "s",
  ç: "c",
  ö: "o",
  ü: "u",
};

const maxLength = 96;

export function slugify(value: string): string {
  return (
    value
      // The Azerbaijani locale lowercases I to ı and İ to i.
      .toLocaleLowerCase("az")
      .replace(/[əğışçöü]/g, (char) => azerbaijani[char] ?? char)
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength)
      .replace(/-+$/g, "")
  );
}

/** A slug that is not in `taken`, suffixed `-2`, `-3`, ... when needed. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}
