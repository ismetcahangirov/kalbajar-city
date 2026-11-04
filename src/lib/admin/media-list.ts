import type {
  MediaKind,
  MediaListParams,
  MediaSort,
  MediaSource,
  MediaUsage,
} from "@/shared/media";

import { adminNumber } from "./format";
import { t, type MessageKey } from "./messages";
import { adminModules } from "./navigation";
import { settingsSection } from "./settings-sections";
import type { TableState } from "./table-state";

/** Where the library's filters live in the URL; keys are Azerbaijani like the routes. */
export const mediaFilterKeys = {
  search: "axtar",
  kind: "nov",
  source: "menbe",
  alt: "alt",
} as const;

/** The "alt text" filter's one value: images the public site will not show yet. */
export const missingAltValue = "yoxdur";

export const mediaHref = adminModules.media.href;

export const mediaItemHref = (id: string) => `${mediaHref}/${id}`;

/** The URL state as the list endpoint's parameters. */
export function mediaListParams({
  page,
  pageSize,
  sort,
  filters,
}: TableState & { pageSize: number }): MediaListParams {
  return {
    page,
    pageSize,
    sort: sort as MediaSort,
    q: filters[mediaFilterKeys.search]?.[0],
    kind: filters[mediaFilterKeys.kind] as MediaKind[] | undefined,
    source: filters[mediaFilterKeys.source] as MediaSource[] | undefined,
    missingAlt: filters[mediaFilterKeys.alt]?.includes(missingAltValue) ? true : undefined,
  };
}

const usageLabels: Record<string, MessageKey> = {
  floor: "media.usage.floor",
  layout_type: "media.usage.layout_type",
  news: "media.usage.news",
  gallery_item: "media.usage.gallery_item",
  construction_update: "media.usage.construction_update",
  seo_override: "media.usage.seo_override",
  home_section: "media.usage.home_section",
  settings: "media.usage.settings",
  media: "media.usage.media",
  selector_view: "media.usage.selector_view",
};

/** The console page where a usage is edited; the module's list until its editor exists. */
function usageHref(usage: MediaUsage): string | null {
  switch (usage.entityType) {
    case "floor":
    case "layout_type":
      return adminModules.apartments.href;
    case "home_section":
      // The location section is edited with the settings (#27).
      return usage.label === "location" ? settingsSection("yerlesme").href : adminModules.news.href;
    case "gallery_item":
      return `${adminModules.news.href}/qalereya`;
    case "news":
    case "construction_update":
      return adminModules.news.href;
    case "settings":
      return usage.entityId === "developer"
        ? settingsSection("developer").href
        : adminModules.settings.href;
    case "seo_override":
      return adminModules.settings.href;
    case "media":
      return mediaItemHref(usage.entityId);
    case "selector_view":
      return `${adminModules.apartments.href}/secici`;
    default:
      return null;
  }
}

/** A usage as the library lists it: what uses the file, and where to change that. */
export function describeUsage(usage: MediaUsage): { label: string; href: string | null } {
  const key = usageLabels[usage.entityType];
  const what = key ? t(key) : usage.entityType;
  const name = usage.label ?? (usage.entityType === "media" ? t("media.untitled") : null);
  return { label: name ? `${what}: ${name}` : what, href: usageHref(usage) };
}

const NBSP = " ";

/** `1,2 MB`, `640 KB`: a file's size for the editor. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${adminNumber(bytes / 1024 / 1024, 1)}${NBSP}MB`;
  return `${adminNumber(Math.max(1, Math.round(bytes / 1024)), 0)}${NBSP}KB`;
}

/** `1:05`: a video's length. */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
