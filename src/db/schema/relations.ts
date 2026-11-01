import { relations } from "drizzle-orm";

import {
  constructionUpdateMedia,
  constructionUpdates,
  galleryCategories,
  galleryItems,
  news,
} from "./content";
import { apartments, blocks, buildings, floors, layoutTypes } from "./inventory";
import { leadEvents, leadNotes, leads } from "./leads";
import { media, mediaUsages } from "./media";

export const buildingsRelations = relations(buildings, ({ many }) => ({ blocks: many(blocks) }));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  building: one(buildings, { fields: [blocks.buildingId], references: [buildings.id] }),
  floors: many(floors),
}));

export const floorsRelations = relations(floors, ({ one, many }) => ({
  block: one(blocks, { fields: [floors.blockId], references: [blocks.id] }),
  plan: one(media, { fields: [floors.planMediaId], references: [media.id] }),
  apartments: many(apartments),
}));

export const layoutTypesRelations = relations(layoutTypes, ({ one, many }) => ({
  plan: one(media, { fields: [layoutTypes.planMediaId], references: [media.id] }),
  apartments: many(apartments),
}));

export const apartmentsRelations = relations(apartments, ({ one, many }) => ({
  floor: one(floors, { fields: [apartments.floorId], references: [floors.id] }),
  layoutType: one(layoutTypes, {
    fields: [apartments.layoutTypeId],
    references: [layoutTypes.id],
  }),
  leads: many(leads),
}));

export const mediaRelations = relations(media, ({ many }) => ({ usages: many(mediaUsages) }));

export const mediaUsagesRelations = relations(mediaUsages, ({ one }) => ({
  media: one(media, { fields: [mediaUsages.mediaId], references: [media.id] }),
}));

export const galleryCategoriesRelations = relations(galleryCategories, ({ many }) => ({
  items: many(galleryItems),
}));

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  category: one(galleryCategories, {
    fields: [galleryItems.categoryId],
    references: [galleryCategories.id],
  }),
  media: one(media, { fields: [galleryItems.mediaId], references: [media.id] }),
}));

export const newsRelations = relations(news, ({ one }) => ({
  cover: one(media, { fields: [news.coverMediaId], references: [media.id] }),
}));

export const constructionUpdatesRelations = relations(constructionUpdates, ({ many }) => ({
  media: many(constructionUpdateMedia),
}));

export const constructionUpdateMediaRelations = relations(constructionUpdateMedia, ({ one }) => ({
  update: one(constructionUpdates, {
    fields: [constructionUpdateMedia.updateId],
    references: [constructionUpdates.id],
  }),
  media: one(media, { fields: [constructionUpdateMedia.mediaId], references: [media.id] }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  apartment: one(apartments, { fields: [leads.apartmentId], references: [apartments.id] }),
  notes: many(leadNotes),
  events: many(leadEvents),
}));

export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
  lead: one(leads, { fields: [leadNotes.leadId], references: [leads.id] }),
}));

export const leadEventsRelations = relations(leadEvents, ({ one }) => ({
  lead: one(leads, { fields: [leadEvents.leadId], references: [leads.id] }),
}));
