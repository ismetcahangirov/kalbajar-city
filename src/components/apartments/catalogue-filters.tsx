"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Localized } from "@/components/home/localized";
import { Button, buttonClass, Checkbox, Icon, Input, Select } from "@/components/ui";
import type { Localized as LocalizedValue } from "@/i18n/content";
import { formatNumber } from "@/i18n/format";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useApartmentsQuery } from "@/store/endpoints/apartments";
import { StoreProvider } from "@/store/provider";
import { publicApartmentStatuses } from "@/shared/apartments";
import {
  activeGroups,
  catalogueKeys as keys,
  catalogueSorts,
  parseCatalogueParams,
  priceSorts,
  statusWord,
  toApartmentListParams,
  toCatalogueQuery,
  withoutHiddenPrices,
  type CatalogueQuery,
  type CatalogueSort,
  type CatalogueState,
} from "@/shared/catalogue";

/** What the filters can offer, from `getCatalogueFacets` (serialisable). */
export type FilterFacets = {
  rooms: number[];
  blocks: Array<{ code: string; name: LocalizedValue }>;
  floors: number[];
  area: { min: number; max: number } | null;
  price: { min: number; max: number } | null;
  pricesVisible: boolean;
};

type Props = {
  facets: FilterFacets;
  /** The state the page was rendered with: what the URL says. */
  applied: CatalogueState;
  /** Matches for `applied`, as the server counted them. */
  total: number;
  locale: Locale;
};

const sortLabels: Record<CatalogueSort, string> = {
  sahe: "areaAsc",
  "-sahe": "areaDesc",
  mertebe: "floorAsc",
  "-mertebe": "floorDesc",
  qiymet: "priceAsc",
  "-qiymet": "priceDesc",
};

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])";

/**
 * The catalogue's filters: a sidebar from `lg`, a full-screen drawer below.
 * Both are one native GET form with the URL's own keys, so they work without
 * JavaScript. With it, the result count for the choice being edited comes
 * from the API (debounced) before it is applied, and applying navigates to
 * the clean URL. Forms never animate.
 */
export function CatalogueFilters(props: Props) {
  return (
    <StoreProvider>
      <Filters {...props} />
    </StoreProvider>
  );
}

/** The value after it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** The filter part of a state as form values, keyed like the URL. */
function draftOf(state: CatalogueState, pricesVisible: boolean): CatalogueQuery {
  return toCatalogueQuery(
    withoutHiddenPrices({ ...state, page: 1, view: "grid" as const }, pricesVisible),
  );
}

function Filters({ facets, applied, total, locale }: Props) {
  const t = useTranslations("Catalogue");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // The form edits a draft; a new URL (applied, back, a link) replaces it.
  const appliedDraft = draftOf(applied, facets.pricesVisible);
  const appliedKey = JSON.stringify(appliedDraft);
  const [draft, setDraft] = useState(appliedDraft);
  const [syncedKey, setSyncedKey] = useState(appliedKey);
  if (syncedKey !== appliedKey) {
    setSyncedKey(appliedKey);
    setDraft(appliedDraft);
  }

  const filters = useMemo(
    () =>
      withoutHiddenPrices(
        { ...parseCatalogueParams(draft), page: 1, view: applied.view },
        facets.pricesVisible,
      ),
    [draft, applied.view, facets.pricesVisible],
  );
  const draftKey = JSON.stringify(draftOf(filters, facets.pricesVisible));
  const settledKey = useDebounced(draftKey, 300);
  const changed = settledKey !== appliedKey;
  const params = useMemo(
    () => toApartmentListParams(parseCatalogueParams(JSON.parse(settledKey) as CatalogueQuery)),
    [settledKey],
  );
  const { currentData, isFetching } = useApartmentsQuery(
    { ...params, pageSize: 1, locale },
    { skip: !changed },
  );
  const count =
    draftKey === appliedKey
      ? total
      : draftKey === settledKey && !isFetching
        ? currentData?.total
        : undefined;

  useEffect(() => {
    const desktop = window.matchMedia("(width >= 64rem)");
    const onChange = () => {
      if (desktop.matches) dialog.current?.close();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  function set(key: string, value: string | string[]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: string, value: string, on: boolean) {
    setDraft((current) => {
      const raw = current[key];
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return { ...current, [key]: on ? [...list, value] : list.filter((v) => v !== value) };
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dialog.current?.close();
    router.push({ pathname: "/menziller", query: toCatalogueQuery(filters) });
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) return;
    const edge = event.shiftKey ? first : last;
    if (document.activeElement === edge) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  const active = activeGroups(parseCatalogueParams(appliedDraft)).length;
  const form = (variant: "sidebar" | "drawer") => (
    <FilterForm
      variant={variant}
      facets={facets}
      draft={draft}
      view={applied.view}
      count={count}
      locale={locale}
      onSet={set}
      onToggle={toggle}
      onSubmit={submit}
    />
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 lg:hidden" data-print-hidden="">
        <Button
          variant="secondary"
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="catalogue-filters"
          leadingIcon={<Icon icon={SlidersHorizontal} />}
        >
          {t("filters.open")}
          {active > 0 && (
            <span className="grid min-w-6 place-items-center rounded-full bg-action px-1.5 text-small text-action-text">
              <span aria-hidden>{formatNumber(active, locale)}</span>
              <span className="sr-only">{t("filters.active", { count: active })}</span>
            </span>
          )}
        </Button>
      </div>

      <aside
        aria-labelledby="catalogue-filters-title"
        className="hidden lg:block"
        data-print-hidden=""
      >
        <h2 id="catalogue-filters-title" className="mb-6 text-title">
          {t("filters.title")}
        </h2>
        {form("sidebar")}
      </aside>

      <dialog
        id="catalogue-filters"
        ref={dialog}
        aria-labelledby="catalogue-filters-dialog-title"
        data-scroll-lock=""
        data-lenis-prevent=""
        onClose={() => setOpen(false)}
        onKeyDown={trapFocus}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-surface p-0 text-text backdrop:bg-transparent lg:hidden"
      >
        <div className="flex min-h-full flex-col">
          <div className="sticky top-0 z-10 flex min-h-(--header-height) items-center justify-between gap-4 border-b border-border bg-surface px-page">
            <h2 id="catalogue-filters-dialog-title" className="text-title">
              {t("filters.title")}
            </h2>
            <button
              type="button"
              autoFocus
              onClick={() => dialog.current?.close()}
              aria-label={t("filters.close")}
              className="-me-2.5 grid size-target shrink-0 place-items-center rounded-full"
            >
              <Icon icon={X} size={24} />
            </button>
          </div>
          {open && form("drawer")}
        </div>
      </dialog>
    </>
  );
}

type FormProps = {
  variant: "sidebar" | "drawer";
  facets: FilterFacets;
  draft: CatalogueQuery;
  view: CatalogueState["view"];
  count: number | undefined;
  locale: Locale;
  onSet: (key: string, value: string | string[]) => void;
  onToggle: (key: string, value: string, on: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function listOf(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function textOf(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-small font-medium text-text">{legend}</legend>
      {children}
    </fieldset>
  );
}

function FilterForm({
  variant,
  facets,
  draft,
  view,
  count,
  locale,
  onSet,
  onToggle,
  onSubmit,
}: FormProps) {
  const t = useTranslations("Catalogue.filters");
  const status = useTranslations("Status");
  const prefix = `${variant}-${useId().replace(/:/g, "")}`;
  const id = (name: string) => `${prefix}-${name}`;
  const drawer = variant === "drawer";
  const sorts = catalogueSorts.filter((sort) => facets.pricesVisible || !priceSorts.includes(sort));
  const number = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 0 });

  const checkboxes = (
    key: string,
    options: Array<{ value: string; label: ReactNode }>,
    columns: string,
  ) => {
    const selected = listOf(draft[key]);
    return (
      <div className={columns}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            id={id(`${key}-${option.value}`)}
            name={key}
            value={option.value}
            label={option.label}
            checked={selected.includes(option.value)}
            onChange={(event) => onToggle(key, option.value, event.currentTarget.checked)}
          />
        ))}
      </div>
    );
  };

  const range = (
    minKey: string,
    maxKey: string,
    bounds: { min: number; max: number } | null,
    inputMode: "decimal" | "numeric",
  ) => (
    <div className="grid grid-cols-2 gap-3">
      {[
        { key: minKey, label: t("from"), placeholder: bounds?.min },
        { key: maxKey, label: t("to"), placeholder: bounds?.max },
      ].map((field) => (
        <Input
          key={field.key}
          id={id(field.key)}
          name={field.key}
          label={field.label}
          type="number"
          inputMode={inputMode}
          min={0}
          step={inputMode === "decimal" ? "0.01" : "1"}
          placeholder={field.placeholder !== undefined ? number(field.placeholder) : undefined}
          value={textOf(draft[field.key])}
          onChange={(event) => onSet(field.key, event.currentTarget.value)}
        />
      ))}
    </div>
  );

  return (
    <form
      method="get"
      action={getPathname({ href: "/menziller", locale })}
      onSubmit={onSubmit}
      className={drawer ? "flex flex-1 flex-col" : "flex flex-col gap-8"}
    >
      <div className={drawer ? "flex flex-col gap-8 py-block px-page" : "contents"}>
        <Select
          id={id(keys.sort)}
          name={keys.sort}
          label={t("sort")}
          value={textOf(draft[keys.sort])}
          onChange={(event) => onSet(keys.sort, event.currentTarget.value)}
        >
          <option value="">{t("sortDefault")}</option>
          {sorts.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sortOptions.${sortLabels[sort]}` as "sortOptions.areaAsc")}
            </option>
          ))}
        </Select>

        {facets.rooms.length > 0 && (
          <Group legend={t("rooms")}>
            {checkboxes(
              keys.rooms,
              facets.rooms.map((rooms) => ({ value: String(rooms), label: number(rooms) })),
              "flex flex-wrap gap-x-4",
            )}
          </Group>
        )}

        <Group legend={t("area")}>
          {range(keys.areaMin, keys.areaMax, facets.area, "decimal")}
        </Group>

        {facets.floors.length > 0 && (
          <Group legend={t("floor")}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: keys.floorMin, label: t("floorFrom") },
                { key: keys.floorMax, label: t("floorTo") },
              ].map((field) => (
                <Select
                  key={field.key}
                  id={id(field.key)}
                  name={field.key}
                  label={field.label}
                  value={textOf(draft[field.key])}
                  onChange={(event) => onSet(field.key, event.currentTarget.value)}
                >
                  <option value="">{t("any")}</option>
                  {facets.floors.map((floor) => (
                    <option key={floor} value={floor}>
                      {formatNumber(floor, locale)}
                    </option>
                  ))}
                </Select>
              ))}
            </div>
          </Group>
        )}

        {facets.blocks.length > 0 && (
          <Group legend={t("blocks")}>
            {checkboxes(
              keys.blocks,
              facets.blocks.map((block) => ({
                value: block.code,
                label: <Localized text={block.name} />,
              })),
              "grid grid-cols-2 gap-x-4",
            )}
          </Group>
        )}

        <Group legend={t("statuses")}>
          {checkboxes(
            keys.statuses,
            publicApartmentStatuses.map((value) => ({
              value: statusWord(value),
              label: status(value),
            })),
            "flex flex-col",
          )}
        </Group>

        {facets.pricesVisible && (
          <Group legend={t("price")}>
            {range(keys.priceMin, keys.priceMax, facets.price, "numeric")}
          </Group>
        )}

        {view === "list" && <input type="hidden" name={keys.view} value="siyahi" />}
      </div>

      <div
        className={
          drawer
            ? "sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-border bg-surface pt-4 px-page pb-(--action-bar-inset)"
            : "flex flex-col gap-2"
        }
      >
        <Button type="submit" size="lg" aria-describedby={id("count")}>
          {count === undefined ? t("applyPending") : t("apply", { count })}
        </Button>
        <Link
          href={{
            pathname: "/menziller",
            query: view === "list" ? { [keys.view]: "siyahi" } : {},
          }}
          className={buttonClass({ variant: "link", className: "self-center" })}
        >
          {t("reset")}
        </Link>
        <p id={id("count")} role="status" className="sr-only">
          {count === undefined ? "" : t("matches", { count })}
        </p>
      </div>
    </form>
  );
}
