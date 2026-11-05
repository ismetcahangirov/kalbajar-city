ALTER TABLE "construction_updates" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "construction_updates" ADD CONSTRAINT "construction_updates_scheduled_is_draft" CHECK ("construction_updates"."status" = 'draft' or "construction_updates"."scheduled_at" is null);--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_scheduled_is_draft" CHECK ("news"."status" = 'draft' or "news"."scheduled_at" is null);