"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import type { DataTableAnyFilter } from "@/components/admin/data-table/controls";
import { DataTable } from "@/components/admin/data-table/data-table";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { adminDateTime } from "@/lib/admin/format";
import {
  formatFileSize,
  mediaFilterKeys,
  mediaItemHref,
  mediaListParams,
  missingAltValue,
} from "@/lib/admin/media-list";
import { t } from "@/lib/admin/messages";
import { mediaKinds, mediaSources, type AdminMedia, type MediaListParams } from "@/shared/media";
import { useAdminMediaListQuery } from "@/store/endpoints/admin-media";

import { MediaFlags, MediaThumb, mediaName } from "./media-thumb";
import { UploadList, UploadZone } from "./upload-zone";
import { useMediaUploads } from "./use-media-uploads";

const filters: DataTableAnyFilter[] = [
  {
    key: mediaFilterKeys.search,
    label: t("media.search"),
    placeholder: t("media.searchShort"),
    kind: "text",
  },
  {
    key: mediaFilterKeys.kind,
    label: t("media.kind"),
    options: mediaKinds.map((kind) => ({ value: kind, label: t(`media.kind.${kind}`) })),
  },
  {
    key: mediaFilterKeys.source,
    label: t("media.source"),
    options: mediaSources.map((source) => ({ value: source, label: t(`media.source.${source}`) })),
  },
  {
    key: mediaFilterKeys.alt,
    label: t("media.altFilter"),
    options: [{ value: missingAltValue, label: t("media.missingAlt") }],
  },
];

const nameLink = (item: AdminMedia) => (
  <Link
    href={mediaItemHref(item.id)}
    className="inline-flex min-h-(--spacing-target) items-center font-medium break-all underline underline-offset-4 md:min-h-0"
  >
    {mediaName(item)}
  </Link>
);

const columns: ColumnDef<AdminMedia>[] = [
  {
    id: "preview",
    meta: { label: t("media.preview") },
    cell: ({ row }) => <MediaThumb item={row.original} className="w-16" />,
  },
  {
    id: "name",
    meta: { label: t("media.file"), primary: true },
    cell: ({ row }) => nameLink(row.original),
  },
  {
    id: "kind",
    meta: { label: t("media.kind") },
    cell: ({ row }) => t(`media.kind.${row.original.kind}`),
  },
  {
    id: "source",
    meta: { label: t("media.source") },
    cell: ({ row }) => t(`media.source.${row.original.source}`),
  },
  {
    id: "alt",
    meta: { label: t("media.alt") },
    cell: ({ row }) => (
      <span className="flex flex-col items-end gap-1 md:items-start">
        {row.original.alt?.az ? <span className="line-clamp-2">{row.original.alt.az}</span> : null}
        <MediaFlags item={row.original} />
      </span>
    ),
  },
  {
    id: "size",
    meta: { label: t("media.size"), align: "end" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatFileSize(row.original.size)}</span>
    ),
  },
  {
    id: "createdAt",
    meta: { label: t("media.createdAt"), sortField: "createdAt", align: "end" },
    cell: ({ row }) => (
      <time dateTime={row.original.createdAt} className="whitespace-nowrap">
        {adminDateTime(row.original.createdAt)}
      </time>
    ),
  },
];

/** Thumbnails, two across on a phone; each opens the file's page. */
function MediaGrid({ items }: { items: AdminMedia[] }) {
  return (
    <ul
      aria-label={t("media.caption")}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
    >
      {items.map((item) => (
        <li key={item.id} data-media-id={item.id} className="flex min-w-0 flex-col gap-2">
          <Link
            href={mediaItemHref(item.id)}
            className="group flex min-w-0 flex-col gap-2 rounded-md"
          >
            <MediaThumb item={item} />
            <span className="text-sm truncate font-medium group-hover:underline">
              {mediaName(item)}
            </span>
          </Link>
          {item.alt?.az ? (
            <p className="text-sm text-muted-foreground line-clamp-2">{item.alt.az}</p>
          ) : null}
          <MediaFlags item={item} />
        </li>
      ))}
    </ul>
  );
}

const gridSkeleton = (
  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
    {Array.from({ length: 8 }, (_, index) => (
      <li key={index} className="flex flex-col gap-2">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-4 w-2/3" />
      </li>
    ))}
  </ul>
);

const grid = {
  render: (items: AdminMedia[]) => <MediaGrid items={items} />,
  skeleton: gridSkeleton,
};

/**
 * The media library (#25): the upload zone for those who may upload, then
 * every file as a grid of thumbnails or a list, searchable and filtered by
 * kind, source and missing alt text, newest first. Filters, order and view
 * are in the URL.
 */
export function MediaLibrary({ canUpload }: { canUpload: boolean }) {
  const uploads = useMediaUploads();
  return (
    <div className="flex flex-col gap-6">
      {canUpload ? (
        <div className="flex flex-col gap-3">
          <UploadZone onFiles={uploads.add} />
          <UploadList uploads={uploads} />
        </div>
      ) : null}
      <DataTable<AdminMedia, MediaListParams>
        caption={t("media.caption")}
        columns={columns}
        defaultSort="-createdAt"
        filters={filters}
        pageSize={24}
        useList={useAdminMediaListQuery}
        toParams={mediaListParams}
        getRowId={(item) => item.id}
        grid={grid}
      />
    </div>
  );
}
