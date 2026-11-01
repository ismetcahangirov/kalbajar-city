CREATE TYPE "public"."publish_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."home_section_key" AS ENUM('hero', 'stats', 'about', 'layouts', 'amenities', 'card_zoom', 'location', 'construction', 'process', 'faq', 'cta');--> statement-breakpoint
CREATE TYPE "public"."apartment_status" AS ENUM('available', 'reserved', 'sold', 'not_for_sale');--> statement-breakpoint
CREATE TYPE "public"."lead_event_type" AS ENUM('created', 'status_changed', 'assigned', 'note_added', 'notified');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'viewing', 'reserved', 'closed', 'lost');--> statement-breakpoint
CREATE TYPE "public"."lead_type" AS ENUM('inquiry', 'viewing', 'callback');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."media_source" AS ENUM('owner', 'generated');--> statement-breakpoint
CREATE TABLE "construction_update_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"update_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "construction_update_media_pair" UNIQUE("update_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "construction_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"month" date NOT NULL,
	"title" jsonb NOT NULL,
	"body" jsonb,
	"progress_percent" smallint NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "construction_updates_slug_unique" UNIQUE("slug"),
	CONSTRAINT "construction_updates_month_unique" UNIQUE("month"),
	CONSTRAINT "construction_updates_progress_range" CHECK ("construction_updates"."progress_percent" between 0 and 100),
	CONSTRAINT "construction_updates_first_of_month" CHECK (extract(day from "construction_updates"."month") = 1),
	CONSTRAINT "construction_updates_published_has_date" CHECK ("construction_updates"."status" <> 'published' or "construction_updates"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "publish_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "publish_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" "home_section_key" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_sections_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"excerpt" jsonb,
	"body" jsonb NOT NULL,
	"cover_media_id" uuid,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_slug_unique" UNIQUE("slug"),
	CONSTRAINT "news_published_has_date" CHECK ("news"."status" <> 'published' or "news"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "apartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"number" text NOT NULL,
	"floor_id" uuid NOT NULL,
	"layout_type_id" uuid NOT NULL,
	"status" "apartment_status" DEFAULT 'available' NOT NULL,
	"area_total" numeric(8, 2) NOT NULL,
	"price_minor" bigint,
	"currency" char(3) DEFAULT 'AZN' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apartments_slug_unique" UNIQUE("slug"),
	CONSTRAINT "apartments_floor_number" UNIQUE("floor_id","number"),
	CONSTRAINT "apartments_area_positive" CHECK ("apartments"."area_total" > 0),
	CONSTRAINT "apartments_price_non_negative" CHECK ("apartments"."price_minor" >= 0),
	CONSTRAINT "apartments_currency_code" CHECK ("apartments"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "blocks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buildings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "floors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"number" smallint NOT NULL,
	"plan_media_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "floors_block_number" UNIQUE("block_id","number")
);
--> statement-breakpoint
CREATE TABLE "layout_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"rooms" smallint NOT NULL,
	"area_total" numeric(8, 2) NOT NULL,
	"room_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"plan_media_id" uuid,
	"description" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_types_slug_unique" UNIQUE("slug"),
	CONSTRAINT "layout_types_code_unique" UNIQUE("code"),
	CONSTRAINT "layout_types_rooms_range" CHECK ("layout_types"."rooms" between 1 and 10),
	CONSTRAINT "layout_types_area_positive" CHECK ("layout_types"."area_total" > 0)
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" "lead_event_type" NOT NULL,
	"actor_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "lead_type" NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"message" text,
	"preferred_at" timestamp with time zone,
	"apartment_id" uuid,
	"locale" text NOT NULL,
	"source_path" text NOT NULL,
	"utm" jsonb,
	"referrer" text,
	"assignee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_locale" CHECK ("leads"."locale" in ('az', 'en', 'ru'))
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"source" "media_source" DEFAULT 'owner' NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"sha256" text,
	"alt" jsonb,
	"caption" jsonb,
	"focus_x" real DEFAULT 0.5 NOT NULL,
	"focus_y" real DEFAULT 0.5 NOT NULL,
	"lqip" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_key_unique" UNIQUE("key"),
	CONSTRAINT "media_focus_range" CHECK ("media"."focus_x" between 0 and 1 and "media"."focus_y" between 0 and 1),
	CONSTRAINT "media_size_positive" CHECK ("media"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "media_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_usages_slot" UNIQUE("media_id","entity_type","entity_id","field")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"status_code" smallint DEFAULT 301 NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_from_path_unique" UNIQUE("from_path"),
	CONSTRAINT "redirects_status_code" CHECK ("redirects"."status_code" in (301, 302, 307, 308)),
	CONSTRAINT "redirects_from_path" CHECK ("redirects"."from_path" like '/%'),
	CONSTRAINT "redirects_not_self" CHECK ("redirects"."from_path" <> "redirects"."to_path")
);
--> statement-breakpoint
CREATE TABLE "seo_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"title" jsonb,
	"description" jsonb,
	"og_media_id" uuid,
	"noindex" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_overrides_path_unique" UNIQUE("path"),
	CONSTRAINT "seo_overrides_path" CHECK ("seo_overrides"."path" like '/%')
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "construction_update_media" ADD CONSTRAINT "construction_update_media_update_id_construction_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."construction_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_update_media" ADD CONSTRAINT "construction_update_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_category_id_gallery_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."gallery_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_layout_type_id_layout_types_id_fk" FOREIGN KEY ("layout_type_id") REFERENCES "public"."layout_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floors" ADD CONSTRAINT "floors_plan_media_id_media_id_fk" FOREIGN KEY ("plan_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_types" ADD CONSTRAINT "layout_types_plan_media_id_media_id_fk" FOREIGN KEY ("plan_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_overrides" ADD CONSTRAINT "seo_overrides_og_media_id_media_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_items_category_idx" ON "gallery_items" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE INDEX "news_published_idx" ON "news" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "apartments_status_idx" ON "apartments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "apartments_layout_type_idx" ON "apartments" USING btree ("layout_type_id");--> statement-breakpoint
CREATE INDEX "blocks_building_idx" ON "blocks" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "lead_events_lead_idx" ON "lead_events" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_notes_lead_idx" ON "lead_notes" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_status_created_idx" ON "leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "leads_apartment_idx" ON "leads" USING btree ("apartment_id");--> statement-breakpoint
CREATE INDEX "media_usages_entity_idx" ON "media_usages" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");