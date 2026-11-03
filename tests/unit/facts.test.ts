import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import * as seed from "@/db/seed/data";
import az from "@/i18n/messages/az.json";
import en from "@/i18n/messages/en.json";
import ru from "@/i18n/messages/ru.json";
import type { Locale } from "@/i18n/routing";
import { factSentences, layoutFacts, type ComplexFacts, type ExtraFacts } from "@/lib/facts";

const facts: ComplexFacts = seed.settings.complex;
const catalogues = { az, en, ru };

/** The sentences as the about page renders them, through the real catalogue. */
function render(locale: Locale, input: ComplexFacts = facts, developer = "InCity Projects") {
  const t = createTranslator({ locale, messages: catalogues[locale], namespace: "About.facts" });
  return factSentences(input, developer, locale).map((sentence) =>
    t(sentence.key, sentence.values as never),
  );
}

/** With the facts from outside `settings.complex`: layouts and address. */
const allExtra: ExtraFacts = {
  layouts: { rooms: [1, 2, 3], areaMin: 45, areaMax: 120 },
  address: "Kalbajar",
};

function renderAll(locale: Locale, extra: ExtraFacts = allExtra) {
  const t = createTranslator({ locale, messages: catalogues[locale], namespace: "About.facts" });
  return factSentences(facts, "InCity Projects", locale, extra).map((sentence) =>
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
      for (const sentence of renderAll(locale)) {
        expect(sentence, locale).not.toMatch(/[{}]|About\.facts/);
      }
    }
  });

  it("states the layouts' room counts and area range, from the layout types", () => {
    const layouts = layoutFacts([
      { rooms: 3, areaTotal: "98.40" },
      { rooms: 1, areaTotal: "45.10" },
      { rooms: 2, areaTotal: "67.00" },
      { rooms: 2, areaTotal: "72.50" },
    ]);
    expect(layouts).toEqual({ rooms: [1, 2, 3], areaMin: 45.1, areaMax: 98.4 });
    const plain = (s: string) => s.replaceAll("\u00a0", " ");
    expect(plain(renderAll("en", { layouts })[2]!)).toBe(
      "Kalbajar City has 1-, 2-, and 3-room apartments from 45.1 m² to 98.4 m².",
    );
    expect(plain(renderAll("az", { layouts })[2]!)).toBe(
      "Kalbajar City-də 1, 2 və 3 otaqlı mənzillər var; sahələri 45,1 m² ilə 98,4 m² arasındadır.",
    );
    expect(plain(renderAll("ru", { layouts })[2]!)).toBe(
      "В Kalbajar City есть 1-, 2- и 3-комнатные квартиры площадью от 45,1 м² до 98,4 м².",
    );
    const single = layoutFacts([{ rooms: 2, areaTotal: "67.00" }]);
    expect(plain(renderAll("en", { layouts: single })[2]!)).toBe(
      "Kalbajar City has 2-room apartments of 67 m².",
    );
    expect(layoutFacts([])).toBeNull();
  });

  it("states the address once it is set, and not before", () => {
    expect(renderAll("en", { address: null }).some((s) => s.includes("address"))).toBe(false);
    expect(renderAll("en", { address: "Istisu street 1, Kalbajar" }).at(-1)).toBe(
      "The address of Kalbajar City is Istisu street 1, Kalbajar.",
    );
  });
});
