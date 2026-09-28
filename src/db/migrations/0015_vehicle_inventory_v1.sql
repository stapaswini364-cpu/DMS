-- Vehicle Inventory V1: engine number uniqueness + purchase/delivery dates.
-- The cancel-bug fix is purely application-level (new API route + UI change)
-- and requires no schema change.

-- Engine number uniqueness (was completely unprotected before)
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_inventory_engine_number_idx"
  ON "vehicle_inventory" ("tenant_id", "engine_number");

-- Optional tracking dates (nullable — not required on existing records)
ALTER TABLE "vehicle_inventory"
  ADD COLUMN IF NOT EXISTS "purchase_date"           date,
  ADD COLUMN IF NOT EXISTS "expected_delivery_date"  date;
