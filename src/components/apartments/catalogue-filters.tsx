"use client";

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Localized } from "@/components/home/localized";
import { Checkbox } from "@/components/ui/checkbox";
import { RangeHairline } from "@/components/ui/range-hairline";
import { Segmented } from "@/components/ui/segmented";
import type { Localized as LocalizedValue } from "@/i18n/content";
import { formatNumber } from "@/i18n/format";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { publicApartmentStatuses } from "@/shared/apartments";
import {
  activeGroups,
  catalogueKeys as keys,
  emptyFilters,
  parseCatalogueParams,
  statusWord,
  toCatalogueQuery,
  withoutHiddenPrices,
  type CatalogueQuery,
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

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])";

/** The caps buttons of the filter bar: show (cream) and reset (outlined). */
const barButton =
  "flex min-h-[3.125rem] items-center justify-center px-u text-center text-label uppercase";

/**
 * The catalogue's filters in the hairline language (ui-kit.md → Segmented,
 * RangeHairline, Checkbox): the left third of the page from `lg`, and below
 * it a fixed "FİLTR" button opening a full-screen dialog with a sticky,
 * blurred bar ("N MƏNZİL GÖSTƏR" | "SIFIRLA"). Both are one native GET form
 * with the URL's own keys, so they work without JavaScript. With it, the
 * result count for the choice being edited comes from the API (debounced)
 * before it is applied, and applying navigates to the clean URL. Filters
 * and results never animate. Sorting is in the results' header
 * (`CatalogueSort`); the form carries the applied sort along.
 *
 * The count needs Redux and RTK Query, which would weigh more than the rest
 * of the page's own script (CLAUDE.md §5), so `CatalogueCount` is imported
 * only on the visitor's first interaction with the filters: focus, input or
 * opening the dialog. Until it answers, the apply button reads "Show".
 */
const CatalogueCount = dynamic(() => import("./catalogue-count"), { ssr: false });

export function CatalogueFilters(props: Props) {
  return <Filters {...props} />;
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
  const [engaged, setEngaged] = useState(false);
  const [live, setLive] = useState<{ key: string; total: number }>();
  const onCount = useCallback((result: { key: string; total: number }) => setLive(result), []);
  const engage = () => setEngaged(true);
  const count = draftKey === appliedKey ? total : live?.key === draftKey ? live.total : undefined;

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

  /** Clears every filter in the draft; the sort and the view stay. */
  function clear() {
    setDraft(
      draftOf(
        { ...emptyFilters, sort: applied.sort, page: 1, view: applied.view },
        facets.pricesVisible,
      ),
    );
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
  const resetHref = {
    pathname: "/menziller" as const,
    query: toCatalogueQuery({ ...emptyFilters, sort: applied.sort, page: 1, view: applied.view }),
  };
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
      onEngage={engage}
      onClear={clear}
    />
  );

  return (
    <>
      {engaged && (
        <CatalogueCount
          queryKey={settledKey}
          skip={settledKey === appliedKey}
          locale={locale}
          onCount={onCount}
        />
      )}

      <button
        type="button"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
          engage();
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="catalogue-filters"
        data-print-hidden=""
        data-filter-button=""
        className={cx(
          "fixed inset-x-0 bottom-(--floating-bottom) z-30 mx-auto flex min-h-[3.125rem] w-max min-w-[6.8125rem] items-center justify-center gap-2 px-u2",
          "bg-ink text-label text-cream uppercase lg:hidden",
          // Over the dark page and the cream cards alike: the ring sits inside.
          "focus-visible:-outline-offset-4 focus-visible:outline-cream",
        )}
      >
        {t("filters.heading")}
        {active > 0 && (
          <>
            <span aria-hidden>({formatNumber(active, locale)})</span>
            <span className="sr-only">{t("filters.active", { count: active })}</span>
          </>
        )}
      </button>

      <aside
        aria-labelledby="catalogue-filters-title"
        className="hidden lg:block"
        data-print-hidden=""
      >
        <div className="flex items-center justify-between gap-u border-b border-(--t-line) pb-u">
          <h2 id="catalogue-filters-title" className="text-label text-(--t-small) uppercase">
            {t("filters.heading")}
          </h2>
          <Link
            href={resetHref}
            className="-me-[0.9375rem] flex min-h-target items-center px-[0.9375rem] text-label text-(--t-small) uppercase hover:text-(--t-text)"
          >
            {t("filters.resetShort")}
          </Link>
        </div>
        {form("sidebar")}
      </aside>

      <dialog
        id="catalogue-filters"
        ref={dialog}
        aria-labelledby="catalogue-filters-dialog-title"
        data-scroll-lock=""
        data-lenis-prevent=""
        data-theme="dark"
        onClose={() => setOpen(false)}
        onKeyDown={trapFocus}
        className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-ink bg-(image:--gradient-curtain) p-0 text-(--t-text) [--t-small:var(--t-text)] backdrop:bg-transparent lg:hidden"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex items-center justify-between gap-u border-b border-(--t-line) px-layout py-u2">
            <h2
              id="catalogue-filters-dialog-title"
              className="text-title text-(--t-primary) uppercase"
            >
              {t("filters.heading")}
            </h2>
            <button
              type="button"
              autoFocus
              onClick={() => dialog.current?.close()}
              aria-label={t("filters.close")}
              className="grid size-target shrink-0 place-items-center border border-(--t-control) text-(--t-text)"
            >
              <X width={20} height={20} strokeWidth={1} aria-hidden focusable={false} />
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
  /** The first focus or input: time to load the live count. */
  onEngage: () => void;
  /** Clears the draft's filters (the dialog's "Reset"). */
  onClear: () => void;
};

function listOf(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function textOf(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** A slider step of about a hundredth of the span, rounded to 1, 10, 100… */
function niceStep(bounds: { min: number; max: number } | null): number {
  if (!bounds) return 1;
  const raw = (bounds.max - bounds.min) / 100;
  return raw <= 1 ? 1 : 10 ** Math.floor(Math.log10(raw));
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
  onEngage,
  onClear,
}: FormProps) {
  const t = useTranslations("Catalogue.filters");
  const status = useTranslations("Status");
  const prefix = `${variant}-${useId().replace(/:/g, "")}`;
  const id = (name: string) => `${prefix}-${name}`;
  const drawer = variant === "drawer";
  const number = (value: number) => formatNumber(value, locale, { maximumFractionDigits: 0 });
  const floors = facets.floors.length
    ? { min: Math.min(...facets.floors), max: Math.max(...facets.floors) }
    : null;
  const sliderLabels = (legend: string) => ({
    min: `${legend}: ${t("from")}`,
    max: `${legend}: ${t("to")}`,
    sliderMin: `${legend}: ${t("sliderFrom")}`,
    sliderMax: `${legend}: ${t("sliderTo")}`,
  });
  const range = (
    legend: string,
    minKey: string,
    maxKey: string,
    bounds: { min: number; max: number } | null,
    options: { inputMode: "decimal" | "numeric"; format: (value: number) => string },
  ) => (
    <RangeHairline
      legend={legend}
      idPrefix={id("range")}
      names={[minKey, maxKey]}
      value={[textOf(draft[minKey]), textOf(draft[maxKey])]}
      bounds={bounds}
      step={niceStep(bounds)}
      fieldStep={options.inputMode === "decimal" ? "0.01" : "1"}
      inputMode={options.inputMode}
      labels={sliderLabels(legend)}
      format={options.format}
      onChange={(bound, value) => onSet(bound === 0 ? minKey : maxKey, value)}
    />
  );
  const sort = textOf(draft[keys.sort]);

  return (
    <form
      method="get"
      action={getPathname({ href: "/menziller", locale })}
      onSubmit={onSubmit}
      onFocus={onEngage}
      onInput={onEngage}
      onPointerDown={onEngage}
      className={drawer ? "flex flex-1 flex-col" : "flex flex-col gap-u3 pt-u2"}
    >
      <div className={drawer ? "flex flex-col gap-u3 px-layout py-u2" : "contents"}>
        {facets.blocks.length > 0 && (
          <Segmented
            legend={t("blocks")}
            name={keys.blocks}
            idPrefix={id(keys.blocks)}
            value={listOf(draft[keys.blocks])}
            options={facets.blocks.map((block) => ({
              value: block.code,
              // The code fits a cell; the full name is what is read out.
              label: (
                <>
                  <span aria-hidden>{block.code}</span>
                  <span className="sr-only">
                    <Localized text={block.name} />
                  </span>
                </>
              ),
            }))}
            onChange={(value, on) => onToggle(keys.blocks, value, on)}
          />
        )}

        {facets.rooms.length > 0 && (
          <Segmented
            legend={t("rooms")}
            name={keys.rooms}
            idPrefix={id(keys.rooms)}
            value={listOf(draft[keys.rooms])}
            options={facets.rooms.map((rooms) => ({
              value: String(rooms),
              label: number(rooms),
            }))}
            onChange={(value, on) => onToggle(keys.rooms, value, on)}
          />
        )}

        {range(t("area"), keys.areaMin, keys.areaMax, facets.area, {
          inputMode: "decimal",
          // Whole numbers: browsers without Azerbaijani number data format
          // decimals differently from the server, which breaks hydration.
          format: number,
        })}

        {facets.pricesVisible &&
          range(t("price"), keys.priceMin, keys.priceMax, facets.price, {
            inputMode: "numeric",
            format: number,
          })}

        {floors &&
          range(t("floor"), keys.floorMin, keys.floorMax, floors, {
            inputMode: "numeric",
            format: number,
          })}

        <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
          <legend className="mb-u p-0 text-label-xs text-(--t-small) uppercase">
            {t("statuses")}
          </legend>
          {publicApartmentStatuses.map((value) => {
            const word = statusWord(value);
            return (
              <Checkbox
                key={value}
                size="filter"
                id={id(`${keys.statuses}-${word}`)}
                name={keys.statuses}
                value={word}
                label={status(value)}
                checked={listOf(draft[keys.statuses]).includes(word)}
                onChange={(event) => onToggle(keys.statuses, word, event.currentTarget.checked)}
              />
            );
          })}
        </fieldset>

        {/* Kept from the results' header, so applying does not lose them. */}
        {sort && <input type="hidden" name={keys.sort} value={sort} />}
        {view === "list" && <input type="hidden" name={keys.view} value="siyahi" />}
      </div>

      <div
        className={
          drawer
            ? "sticky bottom-0 mt-auto grid grid-cols-[3fr_2fr] bg-ink/60 px-layout pt-u2 pb-(--safe-bottom) backdrop-blur-[10px]"
            : "flex flex-col"
        }
      >
        <button
          type="submit"
          aria-describedby={id("count")}
          className={cx(barButton, "bg-cream text-ink")}
        >
          {count === undefined ? t("applyPending") : t("apply", { count })}
        </button>
        {drawer && (
          <button
            type="button"
            onClick={onClear}
            className={cx(barButton, "border border-(--t-control) text-(--t-text)")}
          >
            {t("resetShort")}
          </button>
        )}
        <p id={id("count")} role="status" className="sr-only">
          {count === undefined ? "" : t("matches", { count })}
        </p>
      </div>
    </form>
  );
}
