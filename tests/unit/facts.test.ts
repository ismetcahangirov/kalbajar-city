import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import * as seed from "@/db/seed/data";
import az from "@/i18n/messages/az.json";
import en from "@/i18n/messages/en.json";
import ru from "@/i18n/messages/ru.json";
import type { Locale } from "@/i18n/routing";
import { factSentences, type ComplexFacts } from "@/lib/facts";

const facts: ComplexFacts = seed.settings.complex;
const catalogues = { az, en, ru };

/** The sentences as the about page renders them, through the real catalogue. */
function render(locale: Locale, input: ComplexFacts = facts, developer = "InCity Projects") {
  const t = createTranslator({ locale, messages: catalogues[locale], namespace: "About.facts" });
  return factSentences(input, developer, locale).map((sentence) =>
    t(sentence.key, sentence.values as never),
  );
}

describe("the facts block", () => {
  it("states each fact as a sentence that names the complex", () => {
    // Numbers keep their units with a no-break space; compared here as plain spaces.
    expect(render("en").map((sentence) => sentence.replaceAll("\u00a0", " "))).toEqual([
      "Kalbajar City is a residential complex in Kalbajar, Azerbaijan, developed by InCity Projects.",
      "Kalbajar City has 143 apartments in 6 residential buildings with 9 blocks.",
      "The total area of Kalbajar City is 22,634 m², including 14,192 m² of residential space and 3,603 m² of non-residential space.",
      "Kalbajar City stands on 1.13 ha of land.",
      "Kalbajar City has an underground car park with 160 spaces.",
    ]);
  });

  it("formats numbers per locale, grouping Azerbaijani thousands with a space", () => {
    const [, homes, area, land] = render("az");
    expect(homes).toBe("Kalbajar City-də 6 yaşayış binasında, 9 blokda 143 mənzil var.");
    expect(area).toContain("22\u00a0634\u00a0m²");
    expect(land).toBe("Kalbajar City 1,13\u00a0ha torpaq sahəsində yerləşir.");
  });

  it("uses the Russian plural forms", () => {
    const sentences = render("ru", {
      ...facts,
      apartments: 142,
      buildings: 1,
      blocks: 5,
      parkingSpaces: 21,
    });
    expect(sentences[1]).toBe("В Kalbajar City 142 квартиры в 1 жилом доме, 5 блоков.");
    expect(sentences[4]).toBe("В Kalbajar City есть подземный паркинг на 21 место.");
    expect(sentences[2]).toContain("22\u00a0634\u00a0м²");
  });

  it("leaves out a fact that is not known yet", () => {
    const sentences = factSentences(
      { ...facts, parkingSpaces: 0, landHectares: "0", apartments: 0 },
      "InCity Projects",
      "en",
    );
    expect(sentences.map((sentence) => sentence.key)).toEqual(["developer", "area"]);
  });

  it("gives every sentence the arguments its message uses, in every locale", () => {
    for (const locale of ["az", "en", "ru"] as const) {
      for (const sentence of render(locale)) {
        expect(sentence, locale).not.toMatch(/[{}]|About\.facts/);
      }
    }
  });
});
