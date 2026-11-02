/**
 * A console list's page, sort and filters, kept in the URL so a reload, the
 * back button or a shared link shows the same view. Keys are Azerbaijani like
 * every console route (`?sehife=2&sira=-area&status=sold,reserved`); values
 * are the API's own, so they map onto the endpoint's query one to one.
 */

export const pageKey = "sehife";
export const sortKey = "sira";
/** How a list that has a grid shows its items (`?gorunus=siyahi`). */
export const viewKey = "gorunus";

/** The longest search text the URL keeps. */
export const searchTextMax = 100;

/**
 * The values a filter accepts: a list (several may be chosen), a test for a
 * free value such as a date, of which the URL keeps one, or `"text"`: a search,
 * kept whole, commas and all.
 */
export type FilterValues = readonly string[] | ((value: string) => boolean) | "text";

export type TableUrlSpec = {
  /** API sort fields the list accepts; `-field` sorts descending. */
  sortFields: readonly string[];
  defaultSort: string;
  /** Filter URL keys and the values each accepts. */
  filters: Readonly<Record<string, FilterValues>>;
  /** The ways the list can be shown, the default first. */
  views?: readonly string[];
};

export type TableState = {
  page: number;
  sort: string;
  filters: Record<string, string[]>;
  /** One of the spec's `views`, when it has any. */
  view?: string;
};

export type SortDirection = "asc" | "desc";

export function parseSort(sort: string): { field: string; direction: SortDirection } {
  return sort.startsWith("-")
    ? { field: sort.slice(1), direction: "desc" }
    : { field: sort, direction: "asc" };
}

function validSort(value: string | null, spec: TableUrlSpec): string {
  if (!value) return spec.defaultSort;
  return spec.sortFields.includes(parseSort(value).field) ? value : spec.defaultSort;
}

/** Every value of a key, whether repeated (`?a=1&a=2`) or comma-separated (`?a=1,2`). */
function valuesOf(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Reads the state from a query string. Anything unknown or invalid is dropped
 * rather than reported: a hand-edited or outdated link still opens a list.
 */
export function readTableState(params: URLSearchParams, spec: TableUrlSpec): TableState {
  const page = Number(params.get(pageKey));
  const filters: Record<string, string[]> = {};
  for (const [key, allowed] of Object.entries(spec.filters)) {
    if (allowed === "text") {
      const text = params.get(key)?.trim().slice(0, searchTextMax);
      if (text) filters[key] = [text];
      continue;
    }
    const given = [...new Set(valuesOf(params, key))];
    if (typeof allowed === "function") {
      const value = given.find(allowed);
      if (value) filters[key] = [value];
      continue;
    }
    const values = given.filter((value) => allowed.includes(value));
    if (values.length)
      filters[key] = values.sort((a, b) => allowed.indexOf(a) - allowed.indexOf(b));
  }
  const view = params.get(viewKey);
  return {
    page: Number.isInteger(page) && page > 1 ? page : 1,
    sort: validSort(params.get(sortKey), spec),
    filters,
    ...(spec.views?.length
      ? { view: view && spec.views.includes(view) ? view : spec.views[0] }
      : {}),
  };
}

/** The query string for a state, defaults left out: `""` for the plain list. */
export function tableSearch(state: TableState, spec: TableUrlSpec): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(spec.filters)) {
    const values = state.filters[key];
    if (values?.length) params.set(key, values.join(","));
  }
  if (state.sort !== spec.defaultSort) params.set(sortKey, state.sort);
  if (state.page > 1) params.set(pageKey, String(state.page));
  if (state.view && spec.views?.includes(state.view) && state.view !== spec.views[0]) {
    params.set(viewKey, state.view);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** A new filter selection starts again from the first page. */
export function withFilter(state: TableState, key: string, values: string[]): TableState {
  const filters = { ...state.filters };
  if (values.length) filters[key] = values;
  else delete filters[key];
  return { ...state, filters, page: 1 };
}

export function withoutFilters(state: TableState): TableState {
  return { ...state, filters: {}, page: 1 };
}

/** A new order starts again from the first page. */
export function withSort(state: TableState, sort: string): TableState {
  return { ...state, sort, page: 1 };
}

/**
 * Clicking a sortable column: ascending first, then descending, then
 * ascending again.
 */
export function nextSort(current: string, field: string): string {
  const { field: currentField, direction } = parseSort(current);
  return currentField === field && direction === "asc" ? `-${field}` : field;
}

/** Another view keeps the page: the same items, shown differently. */
export function withView(state: TableState, view: string): TableState {
  return { ...state, view };
}

export function withPage(state: TableState, page: number): TableState {
  return { ...state, page: Math.max(1, Math.floor(page)) };
}

export function hasFilters(state: TableState): boolean {
  return Object.keys(state.filters).length > 0;
}

/** A calendar day as a date input gives it, `2026-11-02`. */
export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
