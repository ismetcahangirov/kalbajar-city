import { formatArea, formatNumber, unitSymbol } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { SettingsValue } from "@/shared/settings";

export type ComplexFacts = Omit<SettingsValue<"complex">, "amenities">;

/** The sentences of the facts block, in order; keys of `About.facts` in the catalogues. */
export const factSentenceKeys = ["developer", "homes", "area", "land", "parking"] as const;

export type FactSentenceKey = (typeof factSentenceKeys)[number];

export type FactSentence = { key: FactSentenceKey; values: Record<string, string | number> };

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
): FactSentence[] {
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
  ];
  return sentences.filter((sentence): sentence is FactSentence => sentence !== null);
}
