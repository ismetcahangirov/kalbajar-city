import type { Locale } from "@/i18n/routing";

import type { ApartmentListParams, ApartmentListQuery } from "./apartments";
import { withPriceVisibility, type PublicApartmentStatus } from "./catalogue-rules";

/**
 * The catalogue's public URL (`/menziller?otaq=2&sahe-min=60`). Query keys
 * and values are Azerbaijani like the route segments, so a shared link reads
 * the same in every locale. This module maps them to and from the API's
 * `ApartmentListQuery`; the page, the filter form and the empty state all go
 * through it, so the URL has one meaning.
 */
export const catalogueKeys = {
  rooms: "otaq",
  areaMin: "sahe-min",
  areaMax: "sahe-max",
  blocks: "blok",
  floorMin: "mertebe-min",
  floorMax: "mertebe-max",
  statuses: "status",
  priceMin: "qiymet-min",
  priceMax: "qiymet-max",
  sort: "sira",
  page: "sehife",
  view: "gorunus",
} as const;

const statusWords = {
  satisda: "available",
  rezerv: "reserved",
  satilib: "sold",
} as const satisfies Record<string, PublicApartmentStatus>;

export type StatusWord = keyof typeof statusWords;

const statusWordOf = Object.fromEntries(
  Object.entries(statusWords).map(([word, status]) => [status, word]),
) as Record<PublicApartmentStatus, StatusWord>;

const sortWords = {
  sahe: "area",
  "-sahe": "-area",
  mertebe: "floor",
  "-mertebe": "-floor",
  qiymet: "price",
  "-qiymet": "-price",
} as const satisfies Record<string, NonNullable<ApartmentListParams["sort"]>>;

export type CatalogueSort = keyof typeof sortWords;

export const catalogueSorts = Object.keys(sortWords) as CatalogueSort[];

export const priceSorts: readonly CatalogueSort[] = ["qiymet", "-qiymet"];

export type CatalogueView = "grid" | "list";

/** What the visitor chose. Prices are whole manat; the API takes minor units. */
export type CatalogueFilters = {
  rooms: number[];
  areaMin?: number;
  areaMax?: number;
  blocks: string[];
  floorMin?: number;
  floorMax?: number;
  statuses: PublicApartmentStatus[];
  priceMin?: number;
  priceMax?: number;
  sort?: CatalogueSort;
};

export type CatalogueState = CatalogueFilters & { page: number; view: CatalogueView };

export type SearchParams = Record<string, string | string[] | undefined>;

export const emptyFilters: CatalogueFilters = { rooms: [], blocks: [], statuses: [] };

/** Every value of a key, from repeated keys (`otaq=2&otaq=3`) or a comma list. */
function values(params: SearchParams, key: string): string[] {
  const raw = params[key];
  return (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

/** The first value of a one-value key, unsplit: `60,5` is a decimal comma here. */
function single(params: SearchParams, key: string): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
}

function integer(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || !/^-?\d{1,15}$/.test(value)) return undefined;
  const number = Number(value);
  return number >= min && number <= max ? number : undefined;
}

/** An area in m²; a decimal comma is accepted, as Azerbaijani writes it. */
function area(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d{1,6}([.,]\d{1,2})?$/.test(value)) return undefined;
  const number = Number(value.replace(",", "."));
  return number > 0 ? number : undefined;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Keeps a range only when it is a range: a maximum below the minimum is dropped. */
function range(min: number | undefined, max: number | undefined) {
  return { min, max: min !== undefined && max !== undefined && max < min ? undefined : max };
}

const maxManat = 1_000_000_000;

/**
 * Reads the catalogue's URL. Unknown keys, and values that do not parse or
 * are out of range, are dropped: a hand-edited or stale link shows the
 * catalogue with what still makes sense, never an error.
 */
export function parseCatalogueParams(params: SearchParams): CatalogueState {
  const k = catalogueKeys;
  const areas = range(area(single(params, k.areaMin)), area(single(params, k.areaMax)));
  const floors = range(
    integer(single(params, k.floorMin), -5, 200),
    integer(single(params, k.floorMax), -5, 200),
  );
  const prices = range(
    integer(single(params, k.priceMin), 0, maxManat),
    integer(single(params, k.priceMax), 0, maxManat),
  );
  const sort = single(params, k.sort);

  return {
    rooms: unique(
      values(params, k.rooms).flatMap((value) => {
        const rooms = integer(value, 1, 10);
        return rooms === undefined ? [] : [rooms];
      }),
    ).sort((a, b) => a - b),
    areaMin: areas.min,
    areaMax: areas.max,
    blocks: unique(
      values(params, k.blocks)
        .filter((value) => /^[A-Za-z0-9-]{1,8}$/.test(value))
        .map((value) => value.toUpperCase()),
    ).sort(),
    floorMin: floors.min,
    floorMax: floors.max,
    statuses: unique(
      values(params, k.statuses).flatMap((value) =>
        value in statusWords ? [statusWords[value as StatusWord]] : [],
      ),
    ).sort(),
    priceMin: prices.min,
    priceMax: prices.max,
    sort: sort !== undefined && sort in sortWords ? (sort as CatalogueSort) : undefined,
    page: integer(single(params, k.page), 1, 10_000) ?? 1,
    view: single(params, k.view) === "siyahi" ? "list" : "grid",
  };
}

/** Whole manat to the minor unit (qəpik) the API and the database use. */
function minor(manat: number | undefined): number | undefined {
  return manat === undefined ? undefined : manat * 100;
}

function defined<T extends object>(object: T): T {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as T;
}

/** The filters as the client-side API takes them (the live result count). */
export function toApartmentListParams(filters: CatalogueFilters): ApartmentListParams {
  return defined({
    rooms: filters.rooms.length ? filters.rooms : undefined,
    block: filters.blocks.length ? filters.blocks : undefined,
    status: filters.statuses.length ? filters.statuses : undefined,
    areaMin: filters.areaMin,
    areaMax: filters.areaMax,
    floorMin: filters.floorMin,
    floorMax: filters.floorMax,
    priceMin: minor(filters.priceMin),
    priceMax: minor(filters.priceMax),
    sort: filters.sort ? sortWords[filters.sort] : undefined,
  });
}

/**
 * The loader's query for a catalogue state. While prices are hidden the
 * price filter and price sort are left out (`withPriceVisibility`); the
 * loader applies the same rule again, so the API cannot be asked either.
 */
export function toApartmentListQuery(
  state: CatalogueState,
  options: { locale: Locale; pageSize: number; pricesVisible: boolean },
): ApartmentListQuery {
  const sort = state.sort ? sortWords[state.sort] : "number";
  const descending = sort.startsWith("-");
  const query: ApartmentListQuery = defined({
    page: state.page,
    pageSize: options.pageSize,
    locale: options.locale,
    rooms: state.rooms,
    block: state.blocks,
    status: state.statuses,
    areaMin: state.areaMin,
    areaMax: state.areaMax,
    floorMin: state.floorMin,
    floorMax: state.floorMax,
    priceMin: minor(state.priceMin),
    priceMax: minor(state.priceMax),
    sort: {
      field: (descending ? sort.slice(1) : sort) as ApartmentListQuery["sort"]["field"],
      direction: descending ? "desc" : "asc",
    },
  });
  return withPriceVisibility(query, options.pricesVisible);
}

/** Drops what hidden prices make meaningless, so URLs never carry it. */
export function withoutHiddenPrices<T extends CatalogueFilters>(
  filters: T,
  pricesVisible: boolean,
): T {
  if (pricesVisible) return filters;
  return {
    ...filters,
    priceMin: undefined,
    priceMax: undefined,
    sort: filters.sort && priceSorts.includes(filters.sort) ? undefined : filters.sort,
  };
}

export type CatalogueQuery = Record<string, string | string[]>;

/**
 * The URL query for a state, in a fixed key order, leaving out defaults
 * (first page, grid view, no filter). Several values become repeated keys,
 * as the filter form submits them without JavaScript.
 */
export function toCatalogueQuery(state: Partial<CatalogueState>): CatalogueQuery {
  const k = catalogueKeys;
  const query: CatalogueQuery = {};
  const set = (key: string, value: string | string[] | number | undefined) => {
    if (value === undefined || (Array.isArray(value) && !value.length)) return;
    query[key] = Array.isArray(value) ? value : String(value);
  };
  set(k.rooms, state.rooms?.map(String));
  set(k.areaMin, state.areaMin);
  set(k.areaMax, state.areaMax);
  set(k.blocks, state.blocks);
  set(k.floorMin, state.floorMin);
  set(k.floorMax, state.floorMax);
  set(
    k.statuses,
    state.statuses?.map((status) => statusWordOf[status]),
  );
  set(k.priceMin, state.priceMin);
  set(k.priceMax, state.priceMax);
  set(k.sort, state.sort);
  set(k.page, state.page && state.page > 1 ? state.page : undefined);
  set(k.view, state.view === "list" ? "siyahi" : undefined);
  return query;
}

/** The word a status takes in the URL (`satisda`), for form values. */
export function statusWord(status: PublicApartmentStatus): StatusWord {
  return statusWordOf[status];
}

/**
 * Only the catalogue itself and a single room count (`/menziller?otaq=2`)
 * are landing pages worth indexing; every other combination is a filtered
 * view of them and is `noindex, follow` with a canonical to `/menziller`.
 */
export function isIndexableCatalogue(params: SearchParams): boolean {
  const keys = Object.keys(params).filter((key) => params[key] !== undefined);
  if (keys.length === 0) return true;
  if (keys.length !== 1 || keys[0] !== catalogueKeys.rooms) return false;
  const value = params[catalogueKeys.rooms];
  return typeof value === "string" && integer(value, 1, 10) !== undefined;
}

/** The filter groups a visitor sets, in the order the form shows them. */
export const filterGroups = ["rooms", "area", "blocks", "floor", "statuses", "price"] as const;

export type FilterGroup = (typeof filterGroups)[number];

export function isGroupActive(filters: CatalogueFilters, group: FilterGroup): boolean {
  switch (group) {
    case "rooms":
    case "blocks":
    case "statuses":
      return filters[group].length > 0;
    case "area":
      return filters.areaMin !== undefined || filters.areaMax !== undefined;
    case "floor":
      return filters.floorMin !== undefined || filters.floorMax !== undefined;
    case "price":
      return filters.priceMin !== undefined || filters.priceMax !== undefined;
  }
}

export function activeGroups(filters: CatalogueFilters): FilterGroup[] {
  return filterGroups.filter((group) => isGroupActive(filters, group));
}

/** The filters with one group cleared: the empty state's "nearest match". */
export function withoutGroup<T extends CatalogueFilters>(filters: T, group: FilterGroup): T {
  switch (group) {
    case "rooms":
    case "blocks":
    case "statuses":
      return { ...filters, [group]: [] };
    case "area":
      return { ...filters, areaMin: undefined, areaMax: undefined };
    case "floor":
      return { ...filters, floorMin: undefined, floorMax: undefined };
    case "price":
      return { ...filters, priceMin: undefined, priceMax: undefined };
  }
}

/** Page numbers to show: the first, the last and two either side of the current one. */
export function pageWindow(current: number, count: number): Array<number | "gap"> {
  const pages = new Set([1, count, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= count - 2) [count - 3, count - 2, count - 1].forEach((page) => pages.add(page));
  const sorted = [...pages].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
  return sorted.flatMap((page, i) => {
    const previous = sorted[i - 1];
    return previous !== undefined && page - previous > 1 ? ["gap" as const, page] : [page];
  });
}
