"use client";

import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
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

export type DataTableFilter = {
  /** The URL key, Azerbaijani like the routes (`blok`, `otaq`). */
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

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
