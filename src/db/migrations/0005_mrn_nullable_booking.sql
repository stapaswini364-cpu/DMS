-- Phase 5: allow standalone MRNs (no booking yet)
--> statement-breakpoint
ALTER TABLE "mrn_receipts" ALTER COLUMN "booking_id" DROP NOT NULL;
