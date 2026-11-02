ALTER TABLE "media" ADD COLUMN "original_name" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "poster_media_id" uuid;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_poster_media_id_media_id_fk" FOREIGN KEY ("poster_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_poster_idx" ON "media" USING btree ("poster_media_id");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_poster_not_self" CHECK ("media"."poster_media_id" <> "media"."id");