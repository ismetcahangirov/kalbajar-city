import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { mediaKinds, mediaSources, type MediaVariant } from "@/shared/media";

import { id, timestamps, translatable, userId } from "./columns";

export const mediaKind = pgEnum("media_kind", mediaKinds);

/**
 * Where a file came from. `generated` images are atmosphere only and carry an
 * "illustrative" caption wherever they could be read as the real thing
 * (`CLAUDE.md` §3, Imagery); `stock` is licensed photography.
 */
export const mediaSource = pgEnum("media_source", mediaSources);

export const media = pgTable(
  "media",
  {
    id: id(),
    /**
     * Object key in the bucket: the private original of an image
     * (`originals/<id>.<ext>`), the public file of a video (`media/<id>/video.mp4`).
     */
    key: text("key").notNull().unique(),
    kind: mediaKind("kind").notNull(),
    source: mediaSource("source").notNull().default("owner"),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    sha256: text("sha256"),
    alt: translatable("alt"),
    caption: translatable("caption"),
    /** Crop focus point, 0–1 from the top left. */
    focusX: real("focus_x").notNull().default(0.5),
    focusY: real("focus_y").notNull().default(0.5),
    /** Blur placeholder as a data URL, written by the image pipeline (#11). */
    lqip: text("lqip"),
    /** Shown with the "Illustrative" chip. Always true for a `generated` image. */
    illustrative: boolean("illustrative").notNull().default(false),
    /** Decorative images render with empty alt; any other needs `alt.az` to be shown. */
    decorative: boolean("decorative").notNull().default(false),
    /** The image's dominant colour, `#rrggbb`, painted until it loads. */
    dominantColor: text("dominant_color"),
    /** Resized copies under `media/<id>/`, written by the image pipeline. */
    variants: jsonb("variants").$type<MediaVariant[]>().notNull().default([]),
    /** A video's codec string, e.g. `avc1.640028`. */
    codec: text("codec"),
    uploadedBy: userId("uploaded_by"),
    ...timestamps,
  },
  (t) => [
    check("media_focus_range", sql`${t.focusX} between 0 and 1 and ${t.focusY} between 0 and 1`),
    check("media_size_positive", sql`${t.size} > 0`),
    check("media_generated_illustrative", sql`${t.source} <> 'generated' or ${t.illustrative}`),
  ],
);

/**
 * Where a file is used, so the library can show usages and refuse to delete a
 * file a page still needs. Rows are written by the code that saves the entity.
 */
export const mediaUsages = pgTable(
  "media_usages",
  {
    id: id(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    /** Table name of the entity, e.g. `news`. */
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    /** The field or slot, e.g. `cover` or `gallery`. */
    field: text("field").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("media_usages_slot").on(t.mediaId, t.entityType, t.entityId, t.field),
    index("media_usages_entity_idx").on(t.entityType, t.entityId),
  ],
);
