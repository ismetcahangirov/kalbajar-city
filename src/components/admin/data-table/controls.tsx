"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/admin/ui/badge";
import { Input } from "@/components/admin/ui/input";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { t } from "@/lib/admin/messages";
import { searchTextMax } from "@/lib/admin/table-state";

export type DataTableFilter = {
  /** The URL key, Azerbaijani like the routes (`blok`, `otaq`). */
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

/** One day, e.g. either end of a date range (`?tarixden=2026-11-01`). */
export type DataTableDateFilter = {
  key: string;
  label: string;
  kind: "date";
};

/** A free-text search (`?axtar=dağ`), sent to the endpoint as typed. */
export type DataTableTextFilter = {
  key: string;
  label: string;
  kind: "text";
  /** A short hint in the box; `label` names it for screen readers. */
  placeholder?: string;
};

export type DataTableAnyFilter = DataTableFilter | DataTableDateFilter | DataTableTextFilter;

export function isDateFilter(filter: DataTableAnyFilter): filter is DataTableDateFilter {
  return "kind" in filter && filter.kind === "date";
}

export function isTextFilter(filter: DataTableAnyFilter): filter is DataTableTextFilter {
  return "kind" in filter && filter.kind === "text";
}

/** How long typing must pause before a search runs. */
const searchDelayMs = 300;

/**
 * A search box. It searches once typing pauses, and follows the URL when it
 * changes from elsewhere (back button, "clear filters").
 */
export function TextFilter({
  filter,
  value,
  onChange,
}: {
  filter: DataTableTextFilter;
  value: string | undefined;
  onChange: (value: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  const [synced, setSynced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (value !== synced) {
    setSynced(value);
    setText(value ?? "");
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <label className="relative flex min-w-0 basis-full items-center sm:max-w-80 sm:flex-1 sm:basis-auto">
      <span className="sr-only">{filter.label}</span>
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute left-3 size-4"
      />
      <Input
        type="search"
        className="pl-9"
        data-filter={filter.key}
        placeholder={filter.placeholder ?? filter.label}
        maxLength={searchTextMax}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onChange(next.trim() || null), searchDelayMs);
        }}
      />
    </label>
  );
}

/** A labelled date input; clearing it removes the filter. */
export function DateFilter({
  filter,
  value,
  onChange,
}: {
  filter: DataTableDateFilter;
  value: string | undefined;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="text-sm flex items-center gap-2">
      <span className="text-muted-foreground">{filter.label}</span>
      <Input
        type="date"
        className="w-auto"
        data-filter={filter.key}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </label>
  );
}

/** A multi-select filter: a menu of checkboxes that stays open while ticking. */
export function FilterMenu({
  filter,
  selected,
  onChange,
}: {
  filter: DataTableFilter;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string, checked: boolean) => {
    const next = checked ? [...selected, value] : selected.filter((item) => item !== value);
    // Keep the options' order, so the URL does not depend on the click order.
    onChange(
      filter.options.map((option) => option.value).filter((option) => next.includes(option)),
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" data-filter={filter.key}>
          {filter.label}
          {selected.length ? (
            <Badge variant="secondary" className="rounded-xs">
              {selected.length}
            </Badge>
          ) : null}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filter.options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The order of a card list, where there are no column headers to click. */
export function SortSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={t("table.sort")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
