import { homeSections as seedSections } from "@/db/seed/data";
import {
  homeSectionContentSchemas,
  homeSectionKeys,
  type HomeSectionKey,
  type ParsedHomeSection,
} from "@/shared/home-sections";

export type HomeSectionRow = {
  key: HomeSectionKey;
  sortOrder: number;
  visible: boolean;
  content: unknown;
};

export type ResolvedHomeSection = ParsedHomeSection & { sortOrder: number; visible: boolean };

/**
 * Every home section in the site's order, whatever the database holds: a key
 * with no row shows the seed's text in its default place, and a row whose
 * content no longer matches its schema falls back to the same text rather
 * than take the home page down. The hero is always first and shown, so a row
 * edited by hand cannot leave the page without its `h1` and LCP image, nor
 * the scene that slides under the one before it (`underPrevious`) with
 * nothing above.
 */
export function resolveHomeSections(rows: readonly HomeSectionRow[]): ResolvedHomeSection[] {
  const saved = new Map(rows.map((row) => [row.key, row]));
  return homeSectionKeys
    .map((key, index) => {
      const row = saved.get(key);
      const parsed = homeSectionContentSchemas[key].safeParse(row?.content);
      if (row && !parsed.success) {
        console.error(`Home section "${key}" has invalid content; showing its default.`);
      }
      const hero = key === "hero";
      return {
        index,
        section: {
          key,
          content: parsed.success ? parsed.data : seedSections[key],
          sortOrder: hero ? Number.NEGATIVE_INFINITY : (row?.sortOrder ?? index),
          visible: hero || (row?.visible ?? true),
        } as ResolvedHomeSection,
      };
    })
    .sort((a, b) => a.section.sortOrder - b.section.sortOrder || a.index - b.index)
    .map(({ section }) => section);
}
