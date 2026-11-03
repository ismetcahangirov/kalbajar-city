import { z } from "zod";

import type { Translatable } from "@/i18n/content";

import { contentSlugSchema, publishStatuses, type PublishStatus } from "./content";
import { translatableSchema } from "./translatable";

/**
 * The gallery in the console (#25): categories and their items, each list in
 * display order and reordered only through `PUT .../order`. Items are images
 * from the media library. Whether videos belong in the gallery is an open
 * question on #25, so for now the API accepts images only.
 */

/** Made from the Azerbaijani name when left out or blank; it is the site's `?kateqoriya=`. */
const categorySlugSchema = z
  .union([contentSlugSchema, z.literal("")])
  .optional()
  .transform((value) => value || undefined);

export const galleryCategoryCreateSchema = z.object({
  slug: categorySlugSchema,
  name: translatableSchema,
});

export type GalleryCategoryCreate = z.input<typeof galleryCategoryCreateSchema>;

export const galleryCategoryUpdateSchema = z
  .object({ slug: categorySlugSchema, name: translatableSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Change at least one field");

export type GalleryCategoryUpdate = z.input<typeof galleryCategoryUpdateSchema>;

export const galleryItemCreateSchema = z.object({
  categoryId: z.uuid(),
  mediaId: z.uuid(),
  /** The item's own caption; without one the site shows the file's. */
  caption: translatableSchema.nullish(),
  status: z.enum(publishStatuses).default("published"),
});

export type GalleryItemCreate = z.input<typeof galleryItemCreateSchema>;

export const galleryItemUpdateSchema = z
  .object({
    /** Moving an item to another category puts it at that category's end. */
    categoryId: z.uuid(),
    mediaId: z.uuid(),
    caption: translatableSchema.nullable(),
    status: z.enum(publishStatuses),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Change at least one field");

export type GalleryItemUpdate = z.input<typeof galleryItemUpdateSchema>;

/**
 * The console's item form: the caption may be left blank (the file's own
 * caption shows instead), but a translation needs the Azerbaijani text.
 */
export const galleryItemFormSchema = z.object({
  categoryId: z.uuid(),
  mediaId: z.uuid(),
  caption: z
    .object({
      az: z.string().trim().max(500),
      en: z.string().trim().max(500).nullish(),
      ru: z.string().trim().max(500).nullish(),
    })
    .refine((value) => value.az || (!value.en && !value.ru), {
      path: ["az"],
      // A console catalogue key: this schema only validates the console form.
      message: "error.required",
    })
    .transform((value) => (value.az ? value : null)),
  status: z.enum(publishStatuses),
});

export type GalleryItemForm = z.input<typeof galleryItemFormSchema>;

export const galleryIdParamsSchema = z.object({ id: z.uuid() });

export type AdminGalleryItem = {
  id: string;
  categoryId: string;
  mediaId: string;
  caption: Translatable | null;
  status: PublishStatus;
  sortOrder: number;
  /** The file, as much as the list shows of it. */
  media: {
    previewUrl: string | null;
    alt: string | null;
    /** The site leaves out an image without Azerbaijani alt text. */
    missingAlt: boolean;
  };
};

export type AdminGalleryCategory = {
  id: string;
  slug: string;
  name: Translatable;
  sortOrder: number;
  items: AdminGalleryItem[];
};

/** `GET /admin/gallery`: the whole gallery, categories and items in display order. */
export type AdminGallery = { categories: AdminGalleryCategory[] };
