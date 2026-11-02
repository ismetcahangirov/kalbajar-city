"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";

import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Skeleton } from "@/components/admin/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { apiErrorMessage } from "@/lib/admin/api-error";
import { t } from "@/lib/admin/messages";
import {
  hasFilters,
  isDay,
  nextSort,
  parseSort,
  readTableState,
  tableSearch,
  withFilter,
  withoutFilters,
  withPage,
  withSort,
  type TableState,
  type TableUrlSpec,
} from "@/lib/admin/table-state";
import { cn } from "@/lib/admin/utils";
import type { Page } from "@/shared/api";

import {
  DateFilter,
  FilterMenu,
  isDateFilter,
  SortSelect,
  type DataTableAnyFilter,
} from "./controls";

declare module "@tanstack/react-table" {
  // The generics are TanStack's; the console only adds fields.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** The column's name: the header, and the label on a mobile card. */
    label: string;
    /** The API sort field; the header becomes a sort button. */
    sortField?: string;
    /** Numbers are right-aligned so their units line up (docs/ui-kit.md). */
    align?: "start" | "end";
    /** The card's title under `md`. */
    primary?: boolean;
  }
}

/** The part of an RTK Query hook's result the table reads. */
export type ListResult<T> = {
  data?: Page<T>;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => unknown;
};

export type DataTableProps<T, P> = {
  /** Names the table for screen readers. */
  caption: string;
  columns: ColumnDef<T>[];
  filters?: DataTableAnyFilter[];
  /** Sort fields beyond the sortable columns' own. */
  sortFields?: readonly string[];
  defaultSort: string;
  pageSize?: number;
  /** The list endpoint's RTK Query hook, e.g. `useAdminApartmentsQuery`. */
  useList: (params: P) => ListResult<T>;
  /** The URL state as the endpoint's parameters. */
  toParams: (state: TableState & { pageSize: number }) => P;
  getRowId: (item: T) => string;
  /** Marks rows out, e.g. new leads; pair it with text, never colour alone. */
  rowClassName?: (item: T) => string | undefined;
  /** Row selection, e.g. for bulk actions: a checkbox per row and one for the page. */
  selection?: DataTableSelection<T>;
};

/**
 * Selected rows, held by the caller by id with their data, so a selection
 * survives paging and filtering and a bulk action can preview its result.
 */
export type DataTableSelection<T> = {
  selected: ReadonlyMap<string, T>;
  onChange: (next: Map<string, T>) => void;
  /** The row's name in its checkbox's accessible label, e.g. `A-101`. */
  label: (item: T) => string;
};

const skeletonRows = 6;

/** A checkbox inside a 44 px target, so it is easy to hit on a phone. */
function SelectBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean | "indeterminate";
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="-m-2 inline-flex min-h-target min-w-target items-center justify-center">
      <Checkbox
        aria-label={label}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="size-5"
      />
    </span>
  );
}

/**
 * A server-paginated list for every console module: declare the columns,
 * the filters and the endpoint, and it renders a table from `md` up and
 * cards below, with page, sort and filters kept in the URL
 * (`@/lib/admin/table-state`) and loading, empty and error states.
 */
export function DataTable<T, P>({
  caption,
  columns,
  filters = [],
  sortFields = [],
  defaultSort,
  pageSize = 20,
  useList,
  toParams,
  getRowId,
  rowClassName,
  selection,
}: DataTableProps<T, P>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const spec = useMemo<TableUrlSpec>(
    () => ({
      sortFields: [
        ...new Set([
          ...columns.flatMap((column) => (column.meta?.sortField ? [column.meta.sortField] : [])),
          ...sortFields,
        ]),
      ],
      defaultSort,
      filters: Object.fromEntries(
        filters.map((filter) => [
          filter.key,
          isDateFilter(filter) ? isDay : filter.options.map((option) => option.value),
        ]),
      ),
    }),
    [columns, sortFields, defaultSort, filters],
  );

  const state = useMemo(
    () => readTableState(new URLSearchParams(searchParams.toString()), spec),
    [searchParams, spec],
  );

  // pushState keeps the list in the browser: Next syncs useSearchParams with
  // it without asking the server for the page again, and RTK Query fetches.
  const navigate = useCallback(
    (next: TableState) => {
      window.history.pushState(null, "", `${pathname}${tableSearch(next, spec)}`);
    },
    [pathname, spec],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useList(
    toParams({ ...state, pageSize }),
  );

  // TanStack Table's API returns new functions each render, which the React
  // Compiler cannot memoise; the table is cheap to rebuild.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount: data?.total ?? 0,
    state: { pagination: { pageIndex: state.page - 1, pageSize } },
  });

  const sort = parseSort(state.sort);
  const sortable = columns.filter((column) => column.meta?.sortField);
  const rows = table.getRowModel().rows;
  const filtered = hasFilters(state);
  const pageCount = data?.pageCount ?? 0;

  const pageItems = data?.items ?? [];
  const selectedOnPage = pageItems.filter((item) => selection?.selected.has(getRowId(item)));
  const pageChecked: boolean | "indeterminate" =
    pageItems.length > 0 && selectedOnPage.length === pageItems.length
      ? true
      : selectedOnPage.length > 0
        ? "indeterminate"
        : false;
  const toggleRow = (item: T, checked: boolean) => {
    if (!selection) return;
    const next = new Map(selection.selected);
    if (checked) next.set(getRowId(item), item);
    else next.delete(getRowId(item));
    selection.onChange(next);
  };
  const togglePage = (checked: boolean) => {
    if (!selection) return;
    const next = new Map(selection.selected);
    for (const item of pageItems) {
      if (checked) next.set(getRowId(item), item);
      else next.delete(getRowId(item));
    }
    selection.onChange(next);
  };
  const rowBox = (item: T) =>
    selection ? (
      <SelectBox
        label={t("table.select", { name: selection.label(item) })}
        checked={selection.selected.has(getRowId(item))}
        onChange={(checked) => toggleRow(item, checked)}
      />
    ) : null;

  const status = isLoading
    ? t("table.loading")
    : data
      ? t("table.results", { total: data.total })
      : "";

  const sortButton = (label: string, field: string) => {
    const active = sort.field === field;
    const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 font-medium"
        onClick={() => navigate(withSort(state, nextSort(state.sort, field)))}
      >
        {label}
        <Icon aria-hidden className={cn(!active && "text-muted-foreground")} />
        <span className="sr-only">{t("table.sortBy", { column: label })}</span>
      </Button>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) =>
          isDateFilter(filter) ? (
            <DateFilter
              key={filter.key}
              filter={filter}
              value={state.filters[filter.key]?.[0]}
              onChange={(value) => navigate(withFilter(state, filter.key, value ? [value] : []))}
            />
          ) : (
            <FilterMenu
              key={filter.key}
              filter={filter}
              selected={state.filters[filter.key] ?? []}
              onChange={(values) => navigate(withFilter(state, filter.key, values))}
            />
          ),
        )}
        {filtered ? (
          <Button type="button" variant="ghost" onClick={() => navigate(withoutFilters(state))}>
            {t("table.clearFilters")}
          </Button>
        ) : null}
        {sortable.length ? (
          <SortSelect
            className="md:hidden"
            value={state.sort}
            options={sortable.flatMap((column) => {
              const { label, sortField } = column.meta!;
              return [
                { value: sortField!, label: t("table.sortAsc", { column: label }) },
                { value: `-${sortField}`, label: t("table.sortDesc", { column: label }) },
              ];
            })}
            onChange={(value) => navigate(withSort(state, value))}
          />
        ) : null}
        <p role="status" className="text-sm text-muted-foreground ml-auto">
          {status}
        </p>
      </div>

      {isError && !data ? (
        <div
          role="alert"
          className="border-destructive flex flex-col items-start gap-3 rounded-md border p-4"
        >
          <p className="text-destructive">
            {t("table.error")} {apiErrorMessage(error)}
          </p>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            <RotateCw aria-hidden />
            {t("ui.retry")}
          </Button>
        </div>
      ) : !isLoading && rows.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6">
          <p>{filtered ? t("table.emptyFiltered") : t("table.empty")}</p>
          {filtered ? (
            <Button type="button" variant="outline" onClick={() => navigate(withoutFilters(state))}>
              {t("table.clearFilters")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          aria-busy={isFetching}
          className={cn(isFetching && !isLoading && "opacity-60 motion-safe:transition-opacity")}
        >
          {/* From md: a table. */}
          <div className="bg-card hidden rounded-md border md:block">
            <Table>
              <TableCaption className="sr-only">{caption}</TableCaption>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {selection ? (
                      <TableHead className="w-12">
                        <SelectBox
                          label={t("table.selectPage")}
                          checked={pageChecked}
                          onChange={togglePage}
                        />
                      </TableHead>
                    ) : null}
                    {group.headers.map((header) => {
                      const meta = header.column.columnDef.meta;
                      const field = meta?.sortField;
                      return (
                        <TableHead
                          key={header.id}
                          scope="col"
                          aria-sort={
                            field && sort.field === field
                              ? sort.direction === "asc"
                                ? "ascending"
                                : "descending"
                              : undefined
                          }
                          className={cn(meta?.align === "end" && "text-right")}
                        >
                          {field && meta ? sortButton(meta.label, field) : meta?.label}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: skeletonRows }, (_, index) => (
                      <TableRow key={index}>
                        {(selection ? [null, ...columns] : columns).map((_column, cell) => (
                          <TableCell key={cell}>
                            <Skeleton className="h-4 w-full max-w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={rowClassName?.(row.original)}
                        data-state={selection?.selected.has(row.id) ? "selected" : undefined}
                      >
                        {selection ? <TableCell>{rowBox(row.original)}</TableCell> : null}
                        {row.getVisibleCells().map((cell) => {
                          const meta = cell.column.columnDef.meta;
                          const content = flexRender(cell.column.columnDef.cell, cell.getContext());
                          return meta?.primary ? (
                            <TableHead
                              key={cell.id}
                              scope="row"
                              className="text-foreground font-medium"
                            >
                              {content}
                            </TableHead>
                          ) : (
                            <TableCell
                              key={cell.id}
                              className={cn(meta?.align === "end" && "text-right")}
                            >
                              {content}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>

          {/* Below md: one card per row. */}
          {selection && pageItems.length ? (
            <div className="mb-3 flex items-center gap-3 px-4 md:hidden">
              <SelectBox
                label={t("table.selectPage")}
                checked={pageChecked}
                onChange={togglePage}
              />
              <span aria-hidden className="text-sm text-muted-foreground">
                {t("table.selectPage")}
              </span>
            </div>
          ) : null}
          <ul aria-label={caption} className="flex flex-col gap-3 md:hidden">
            {isLoading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <li key={index} className="bg-card rounded-md border p-4">
                    <Skeleton className="mb-3 h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </li>
                ))
              : rows.map((row) => {
                  const cells = row.getVisibleCells();
                  const primary = cells.find((cell) => cell.column.columnDef.meta?.primary);
                  return (
                    <li
                      key={row.id}
                      className={cn("bg-card rounded-md border p-4", rowClassName?.(row.original))}
                    >
                      {primary || selection ? (
                        <div className="mb-2 flex items-center gap-3">
                          {rowBox(row.original)}
                          {primary ? (
                            <p className="font-medium">
                              {flexRender(primary.column.columnDef.cell, primary.getContext())}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                        {cells
                          .filter((cell) => cell !== primary)
                          .map((cell) => (
                            <CardField key={cell.id} label={cell.column.columnDef.meta?.label}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </CardField>
                          ))}
                      </dl>
                    </li>
                  );
                })}
          </ul>
        </div>
      )}

      {pageCount > 1 ? (
        <nav aria-label={t("table.pagination")} className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={state.page <= 1}
            onClick={() => navigate(withPage(state, state.page - 1))}
          >
            <ChevronLeft aria-hidden />
            {t("table.previous")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("table.page", { page: state.page, pageCount })}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={state.page >= pageCount}
            onClick={() => navigate(withPage(state, state.page + 1))}
          >
            {t("table.next")}
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function CardField({ label, children }: { label: string | undefined; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </>
  );
}
