import { describe, expect, it } from "vitest";

import { fieldMessage, issueMessage } from "@/components/admin/form/messages";
import * as seed from "@/db/seed/data";
import type { Locale } from "@/i18n/routing";
import { faqFactValues, publicFaqItems, type FaqFacts } from "@/lib/faq-facts";
import {
  faqCreateSchema,
  faqPlaceholders,
  faqUpdateSchema,
  unknownFaqPlaceholders,
} from "@/shared/faq";

const facts: FaqFacts = {
  complex: seed.settings.complex,
  layouts: seed.layouts.map(({ rooms, areaTotal }) => ({ rooms, areaTotal })),
  phone: seed.settings.contacts.phones[0]!,
};

/** What the public site prints for the seeded FAQ in a locale, as plain text. */
function answers(locale: Locale, input: FaqFacts = facts): string[] {
  return publicFaqItems(seed.faq, locale, input).map((item) =>
    item.answer.value.replaceAll(" ", " "),
  );
}

describe("FAQ placeholders", () => {
  it("fills every placeholder from the facts, formatted per locale", () => {
    expect(faqFactValues(facts, "az")).toEqual({
      apartments: "143",
      buildings: "6",
      blocks: "9",
      parking: "160",
      totalArea: "22 634 m²",
      layouts: "10",
      roomsMin: "1",
      roomsMax: "4",
      areaMin: "62,09 m²",
      areaMax: "186,9 m²",
      phone: "+994 12 434 32 32",
    });
    expect(Object.keys(faqFactValues(facts, "en")).sort()).toEqual([...faqPlaceholders].sort());
    expect(faqFactValues(facts, "en").totalArea).toBe("22,634 m²");
    expect(faqFactValues(facts, "ru").areaMin).toBe("62,09 м²");
  });

  it("says in the seeded answers what the facts say, in each locale", () => {
    const [homes, layouts, parking] = answers("az");
    expect(homes).toBe("Kalbajar City-də 6 yaşayış binasında, 9 blokda 143 mənzil var.");
    expect(layouts).toBe(
      "1 otaqlıdan 4 otaqlıya qədər 10 plan var: sahəsi 62,09 m²-dən 186,9 m²-ə qədər.",
    );
    expect(parking).toBe("Bəli, kompleksdə 160 yerlik yeraltı qaraj var.");
    expect(answers("en").slice(0, 3)).toEqual([
      "Kalbajar City has 143 apartments in 6 residential buildings with 9 blocks.",
      "There are 10 layouts with 1 to 4 rooms, from 62.09 m² to 186.9 m².",
      "Yes, the complex has an underground car park with 160 spaces.",
    ]);
    // The viewing answer quotes the main line the call buttons dial, not a typed number (#29).
    expect(answers("en").at(-1)).toBe(
      "Choose a time for a viewing in the form on this site, or call +994 12 434 32 32.",
    );
    expect(answers("ru")[1]).toBe(
      "Планировок — 10: от 1- до 4-комнатных, площадью от 62,09 м² до 186,9 м².",
    );
  });

  it("follows a changed fact, grouping Azerbaijani thousands with a space", () => {
    const changed: FaqFacts = { ...facts, complex: { ...facts.complex!, apartments: 1250 } };
    expect(answers("az", changed)[0]).toBe(
      "Kalbajar City-də 6 yaşayış binasında, 9 blokda 1 250 mənzil var.",
    );
    expect(answers("en", changed)[0]).toContain("1,250 apartments");
  });

  it("formats a fallback to the Azerbaijani text the Azerbaijani way", () => {
    const rows = [{ question: { az: "Sahə?" }, answer: { az: "Ümumi sahə {totalArea}-dir." } }];
    const [item] = publicFaqItems(rows, "en", facts);
    expect(item?.answer).toEqual({
      value: "Ümumi sahə 22 634 m²-dir.",
      locale: "az",
      fallback: true,
    });
  });

  it("leaves out a question whose fact is not known yet, keeping the rest", () => {
    const unknown: FaqFacts = {
      complex: { ...facts.complex!, parkingSpaces: 0, totalArea: "0" },
      layouts: [],
      phone: null,
    };
    const shown = publicFaqItems(seed.faq, "en", unknown).map((item) => item.question.value);
    expect(shown).not.toContain("Is there parking?");
    expect(shown).not.toContain("Which layouts are available?");
    expect(shown).toContain("How many apartments are there?");
    expect(shown).toContain("Who is the developer?");
    // Without the complex's settings, only the questions quoting no fact remain.
    expect(
      publicFaqItems(seed.faq, "az", { complex: null, layouts: [], phone: null }),
    ).toHaveLength(2);
  });

  it("leaves out a question with a placeholder the site does not know, in its question too", () => {
    const rows = [
      { question: { az: "{apartments} mənzil?" }, answer: { az: "Bəli." } },
      { question: { az: "Sual?" }, answer: { az: "{nope} cavab." } },
    ];
    expect(publicFaqItems(rows, "az", facts).map((item) => item.question.value)).toEqual([
      "143 mənzil?",
    ]);
  });
});

describe("the FAQ schemas and placeholders", () => {
  it("accepts known placeholders and lists the unknown ones once", () => {
    expect(unknownFaqPlaceholders("{apartments} və {areaMax}")).toEqual([]);
    expect(unknownFaqPlaceholders("{Apartments}, {area min}, {Apartments}, {}")).toEqual([
      "{Apartments}",
      "{area min}",
      "{}",
    ]);
    expect(
      faqCreateSchema.safeParse({
        question: { az: "Neçə mənzil var?" },
        answer: { az: "{apartments} mənzil.", en: "{apartments} homes.", ru: "{apartments}." },
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown placeholder on its field, naming it in the console's words", () => {
    const result = faqUpdateSchema.safeParse(
      { answer: { az: "Yaxşı.", ru: "Всего {flats} и {floors}." } },
      { error: issueMessage },
    );
    expect(result.success).toBe(false);
    const [issue] = result.error!.issues;
    expect(issue?.path).toEqual(["answer", "ru"]);
    expect(fieldMessage({ type: issue?.code, message: issue?.message })).toBe(
      "Naməlum dəyişən: {flats}, {floors}. Yalnız siyahıdakı dəyişənlərdən istifadə edin.",
    );
    expect(
      faqCreateSchema.safeParse({ question: { az: "{nope}?" }, answer: { az: "x" } }).error
        ?.issues[0]?.path,
    ).toEqual(["question", "az"]);
  });
});
