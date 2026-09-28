-- Add service_booking_id to mrn_receipts so standalone receipts can be
-- linked back to a service booking when the booking is created/saved with that MRN.
-- FK declared in SQL only (not in Drizzle schema) to avoid a circular import
-- between bookings.ts and services.ts (services.ts already imports from bookings.ts).

ALTER TABLE "mrn_receipts"
  ADD COLUMN IF NOT EXISTS "service_booking_id" uuid
  REFERENCES "service_bookings"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "mrn_receipts_service_booking_idx"
  ON "mrn_receipts" ("service_booking_id");
