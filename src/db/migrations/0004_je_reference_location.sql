-- Phase 3: add reference text and location_id to journal_entries
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "reference" text;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "location_id" uuid;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "je_location_idx" ON "journal_entries" USING btree ("location_id");
