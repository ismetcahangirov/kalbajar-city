/**
 * Server cache tags. Public data loaders tag what they read; every admin write
 * calls `revalidateTag` for the tags it affects (`CLAUDE.md` §4), next to the
 * RTK Query tags it invalidates.
 */
export const publicTags = {
  /** `settings` rows: contacts, complex facts, amenities, price visibility. */
  settings: "settings",
  /** Buildings, blocks, floors, layout types and apartments. */
  inventory: "inventory",
  /** Home sections, FAQ, news, construction updates, gallery. */
  content: "content",
  /** The media library: alt text, focus points, files. */
  media: "media",
} as const;

export type PublicTag = (typeof publicTags)[keyof typeof publicTags];
