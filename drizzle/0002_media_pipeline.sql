ALTER TYPE "public"."media_source" ADD VALUE 'stock';--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "illustrative" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "decorative" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "dominant_color" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "variants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "codec" text;--> statement-breakpoint
-- A generated image is always illustrative (CLAUDE.md §3, Imagery).
UPDATE "media" SET "illustrative" = true WHERE "source" = 'generated';--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_generated_illustrative" CHECK ("media"."source" <> 'generated' or "media"."illustrative");