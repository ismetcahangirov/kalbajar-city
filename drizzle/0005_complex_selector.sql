CREATE TABLE "selector_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid,
	"media_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "selector_views_block" UNIQUE("block_id")
);
--> statement-breakpoint
ALTER TABLE "apartments" ADD COLUMN "plan_polygon" jsonb;--> statement-breakpoint
ALTER TABLE "blocks" ADD COLUMN "site_polygon" jsonb;--> statement-breakpoint
ALTER TABLE "floors" ADD COLUMN "facade_polygon" jsonb;--> statement-breakpoint
ALTER TABLE "selector_views" ADD CONSTRAINT "selector_views_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selector_views" ADD CONSTRAINT "selector_views_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "selector_views_site" ON "selector_views" USING btree (("block_id" is null)) WHERE "selector_views"."block_id" is null;--> statement-breakpoint
CREATE INDEX "selector_views_media_idx" ON "selector_views" USING btree ("media_id");--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_plan_polygon_array" CHECK ("apartments"."plan_polygon" is null or jsonb_typeof("apartments"."plan_polygon") = 'array');--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_site_polygon_array" CHECK ("blocks"."site_polygon" is null or jsonb_typeof("blocks"."site_polygon") = 'array');--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_facade_polygon_array" CHECK ("floors"."facade_polygon" is null or jsonb_typeof("floors"."facade_polygon") = 'array');