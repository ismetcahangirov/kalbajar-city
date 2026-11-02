ALTER TYPE "public"."lead_event_type" ADD VALUE 'anonymised';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "anonymised_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_assignee_idx" ON "leads" USING btree ("assignee_id");--> statement-breakpoint
-- No console wrote statuses before this migration; a lost lead without a reason
-- could only come from a hand edit, and it must not block the constraint.
UPDATE "leads" SET "lost_reason" = '' WHERE "status" = 'lost' AND "lost_reason" IS NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_lost_reason" CHECK ("leads"."status" <> 'lost' or "leads"."lost_reason" is not null);