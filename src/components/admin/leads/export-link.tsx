"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/admin/ui/button";
import { t } from "@/lib/admin/messages";
import { leadFilterKeys } from "@/lib/admin/lead-list";
import { sortKey } from "@/lib/admin/table-state";

/**
 * Downloads the leads the list's filters show as CSV (owner and admin). A
 * plain link: the browser saves the file, and the API checks the filters and
 * the permission again.
 */
export function LeadsExportLink() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  for (const [apiKey, urlKey] of Object.entries(leadFilterKeys)) {
    const values = searchParams
      .getAll(urlKey)
      .flatMap((value) => value.split(","))
      .filter(Boolean);
    if (values.length) params.set(apiKey, values.join(","));
  }
  const sort = searchParams.get(sortKey);
  if (sort) params.set("sort", sort);
  const search = params.toString();

  return (
    <Button asChild variant="outline">
      <a href={`/api/v1/admin/leads/export.csv${search ? `?${search}` : ""}`} download>
        <Download aria-hidden />
        {t("leads.export")}
      </a>
    </Button>
  );
}
