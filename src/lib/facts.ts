import { formatArea, formatNumber, unitSymbol } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { SettingsValue } from "@/shared/settings";

export type ComplexFacts = Omit<SettingsValue<"complex">, "amenities">;

/** The sentences of the facts block, in order; keys of `About.facts` in the catalogues. */
export const factSentenceKeys = [
  "developer",
  "homes",
  "layouts",
  "area",
  "land",
  "parking",
  "address",
] as const;

export type FactSentenceKey = (typeof factSentenceKeys)[number];

export type FactSentence = { key: FactSentenceKey; values: Record<string, string | number> };

/** The layout types the console lists, reduced to what a sentence states. */
export type LayoutFacts = { rooms: number[]; areaMin: number; areaMax: number };

/** Facts that live outside `settings.complex`: the layouts and, once confirmed (#7), the address. */
export type ExtraFacts = { layouts?: LayoutFacts | null; address?: string | null };

/**
 * The room counts of the layouts, from `layout_types`, with their area range;
 * null while the console lists no layout.
 */
export function layoutFacts(
  layouts: Array<{ rooms: number; areaTotal: string }>,
): LayoutFacts | null {
  if (!layouts.length) return null;
  const areas = layouts.map((layout) => Number(layout.areaTotal));
  return {
    rooms: [...new Set(layouts.map((layout) => layout.rooms))].sort((a, b) => a - b),
    areaMin: Math.min(...areas),
    areaMax: Math.max(...areas),
  };
}

/**
 * Room counts as a list to put before "-room" / "-комнатные": `1-, 2- and 3`
 * in English and Russian, `1, 2 və 3` in Azerbaijani, which writes no hyphen.
 */
function roomList(rooms: number[], locale: Locale): string {
  const hyphen = locale !== "az";
  const items = rooms.map((value, i) => {
    const text = formatNumber(value, locale);
    return hyphen && i < rooms.length - 1 ? `${text}-` : text;
  });
  return new Intl.ListFormat(locale, { type: "conjunction" }).format(items);
}

/**
 * The complex's facts as plain, self-contained sentences that search and
 * answer engines can quote: each names the complex or its subject, so it reads
 * correctly on its own. Counts go to ICU twice, as a number for the plural
 * form and as a string formatted with `@/i18n/format` for the text, because
 * ICU's `#` would group thousands the CLDR way (`22.634`) in Azerbaijani.
 * A count of zero means the fact is not known yet; its sentence is left out.
 */
export function factSentences(
  facts: ComplexFacts,
  developer: string,
  locale: Locale,
  extra: ExtraFacts = {},
): FactSentence[] {
  const { layouts, address } = extra;
  const count = (value: number) => formatNumber(value, locale);
  const area = (value: string) => formatArea(Number(value), locale);
  const sentences: Array<FactSentence | null> = [
    { key: "developer", values: { developer } },
    facts.apartments && facts.buildings && facts.blocks
      ? {
          key: "homes",
          values: {
            apartments: facts.apartments,
            apartmentsText: count(facts.apartments),
            buildings: facts.buildings,
            buildingsText: count(facts.buildings),
            blocks: facts.blocks,
            blocksText: count(facts.blocks),
          },
        }
      : null,
    layouts
      ? {
          key: "layouts",
          values: {
            rooms: roomList(layouts.rooms, locale),
            range: layouts.areaMin === layouts.areaMax ? "single" : "range",
            min: formatArea(layouts.areaMin, locale),
            max: formatArea(layouts.areaMax, locale),
          },
        }
      : null,
    Number(facts.totalArea) > 0
      ? {
          key: "area",
          values: {
            total: area(facts.totalArea),
            residential: area(facts.residentialArea),
            nonResidential: area(facts.nonResidentialArea),
          },
        }
      : null,
    Number(facts.landHectares) > 0
      ? {
          key: "land",
          values: {
            land: `${formatNumber(Number(facts.landHectares), locale, { maximumFractionDigits: 2 })}\u00a0${unitSymbol("ha", locale)}`,
          },
        }
      : null,
    facts.parkingSpaces
      ? {
          key: "parking",
          values: { parking: facts.parkingSpaces, parkingText: count(facts.parkingSpaces) },
        }
      : null,
    address ? { key: "address", values: { address } } : null,
  ];
  return sentences.filter((sentence): sentence is FactSentence => sentence !== null);
}
