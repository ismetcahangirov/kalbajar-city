import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  unique,
  uuid,
  boolean,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { homeSectionKeys, type HomeSectionContent } from "@/shared/home-sections";

import { id, publishStatus, slug, timestamps, translatable, translatableRichText } from "./columns";
import { media } from "./media";

const sortOrder = () => integer("sort_order").notNull().default(0);

/** A published row needs a publication date. */
const publishedHasDate = (name: string, status: AnyPgColumn, publishedAt: AnyPgColumn) =>
  check(name, sql`${status} <> 'published' or ${publishedAt} is not null`);

/**
 * Only a draft waits for a scheduled publication; publishing clears it
 * (`/api/v1/internal/scheduled-publications`, #25).
 */
const scheduledIsDraft = (name: string, status: AnyPgColumn, scheduledAt: AnyPgColumn) =>
  check(name, sql`${status} = 'draft' or ${scheduledAt} is null`);

export const galleryCategories = pgTable("gallery_categories", {
  id: id(),
  slug: slug(),
  name: translatable("name").notNull(),
  sortOrder: sortOrder(),
  ...timestamps,
});

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: id(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => galleryCategories.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    caption: translatable("caption"),
    sortOrder: sortOrder(),
    status: publishStatus("status").notNull().default("published"),
    ...timestamps,
  },
  (t) => [index("gallery_items_category_idx").on(t.categoryId, t.sortOrder)],
);

export const news = pgTable(
  "news",
  {
    id: id(),
    slug: slug(),
    title: translatable("title").notNull(),
    excerpt: translatable("excerpt"),
    body: translatableRichText("body").notNull(),
    coverMediaId: uuid("cover_media_id").references(() => media.id, { onDelete: "restrict" }),
    status: publishStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** When a draft publishes itself; null when it is not scheduled. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("news_published_idx").on(t.status, t.publishedAt),
    publishedHasDate("news_published_has_date", t.status, t.publishedAt),
    scheduledIsDraft("news_scheduled_is_draft", t.status, t.scheduledAt),
  ],
);

export const constructionUpdates = pgTable(
  "construction_updates",
  {
    id: id(),
    slug: slug(),
    /** First day of the month the update reports on. */
    month: date("month", { mode: "string" }).notNull().unique(),
    title: translatable("title").notNull(),
    body: translatableRichText("body"),
    /** Overall progress of the complex at the end of the month. */
    progressPercent: smallint("progress_percent").notNull(),
    status: publishStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** When a draft publishes itself; null when it is not scheduled. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    scheduledIsDraft("construction_updates_scheduled_is_draft", t.status, t.scheduledAt),
    check("construction_updates_progress_range", sql`${t.progressPercent} between 0 and 100`),
    check("construction_updates_first_of_month", sql`extract(day from ${t.month}) = 1`),
    publishedHasDate("construction_updates_published_has_date", t.status, t.publishedAt),
  ],
);

/** Photos and video of one construction update, in display order. */
export const constructionUpdateMedia = pgTable(
  "construction_update_media",
  {
    id: id(),
    updateId: uuid("update_id")
      .notNull()
      .references(() => constructionUpdates.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    sortOrder: sortOrder(),
  },
  (t) => [unique("construction_update_media_pair").on(t.updateId, t.mediaId)],
);

export const faq = pgTable("faq", {
  id: id(),
  question: translatable("question").notNull(),
  /** Plain text: it is also the `FAQPage` structured data. */
  answer: translatable("answer").notNull(),
  sortOrder: sortOrder(),
  status: publishStatus("status").notNull().default("published"),
  ...timestamps,
});

export const homeSectionKey = pgEnum("home_section_key", homeSectionKeys);

/**
 * One row per home page section. The console edits `sort_order`, `visible`
 * and `content`, whose shape depends on `key` and is validated by
 * `homeSectionContentSchemas` in `@/shared/home-sections`.
 */
export const homeSections = pgTable("home_sections", {
  id: id(),
  key: homeSectionKey("key").notNull().unique(),
  sortOrder: sortOrder(),
  visible: boolean("visible").notNull().default(true),
  content: jsonb("content").$type<HomeSectionContent>().notNull(),
  ...timestamps,
});
