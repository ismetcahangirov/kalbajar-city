import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

import az from "@/i18n/messages/az.json";
import en from "@/i18n/messages/en.json";
import ru from "@/i18n/messages/ru.json";

type Tree = { [key: string]: string | Tree };

const catalogues = { az, en, ru } as Record<string, Tree>;

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const flat = Object.fromEntries(
  Object.entries(catalogues).map(([locale, tree]) => [locale, flatten(tree)]),
) as Record<string, Map<string, string>>;

const allKeys = [...new Set(Object.values(flat).flatMap((map) => [...map.keys()]))].sort();

// CLDR plural categories each locale needs for cardinal numbers.
const pluralCategories: Record<string, string[]> = {
  az: ["one", "other"],
  en: ["one", "other"],
  ru: ["one", "few", "many", "other"],
};

function plurals(elements: MessageFormatElement[]): Array<string[]> {
  return elements.flatMap((element) => {
    if (element.type === TYPE.plural) {
      return [
        Object.keys(element.options),
        ...Object.values(element.options).flatMap((option) => plurals(option.value)),
      ];
    }
    if (element.type === TYPE.select) {
      return Object.values(element.options).flatMap((option) => plurals(option.value));
    }
    if (element.type === TYPE.tag) return plurals(element.children);
    return [];
  });
}

function argumentNames(elements: MessageFormatElement[]): string[] {
  return elements.flatMap((element) => {
    if (element.type === TYPE.literal || element.type === TYPE.pound) return [];
    if (element.type === TYPE.tag) return argumentNames(element.children);
    const own = [element.value];
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      return [
        ...own,
        ...Object.values(element.options).flatMap((option) => argumentNames(option.value)),
      ];
    }
    return own;
  });
}

describe("message catalogues", () => {
  it.each(Object.keys(catalogues))("%s has every key and no extra ones", (locale) => {
    const keys = [...(flat[locale]?.keys() ?? [])].sort();
    expect(keys).toEqual(allKeys);
  });

  it.each(Object.keys(catalogues))("%s has no empty message", (locale) => {
    const empty = [...(flat[locale] ?? [])].filter(([, value]) => value.trim() === "");
    expect(empty).toEqual([]);
  });

  it.each(Object.keys(catalogues))("%s parses as ICU with the locale's plural forms", (locale) => {
    for (const [key, message] of flat[locale] ?? []) {
      const ast = parse(message, { requiresOtherClause: true });
      for (const categories of plurals(ast)) {
        for (const category of pluralCategories[locale] ?? []) {
          expect(categories, `${locale} ${key} lacks "${category}"`).toContain(category);
        }
      }
    }
  });

  it("uses the same arguments in every locale", () => {
    // From the parsed message, so a plural branch's text ("one {apartment}")
    // is not taken for an argument and a locale with more plural forms does
    // not count its arguments more than once.
    const argumentsOf = (message: string) =>
      [...new Set(argumentNames(parse(message, { requiresOtherClause: true })))].sort();
    for (const key of allKeys) {
      const expected = argumentsOf(flat.az?.get(key) ?? "");
      for (const locale of ["en", "ru"]) {
        expect(argumentsOf(flat[locale]?.get(key) ?? ""), `${locale} ${key}`).toEqual(expected);
      }
    }
  });
});
