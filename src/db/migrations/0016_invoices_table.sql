-- Stores manually generated invoice numbers, linked to either a sales booking
-- or a service booking. Unique per tenant so duplicate GST invoice numbers are
-- rejected at the DB level as a compliance safeguard.

CREATE TABLE IF NOT EXISTS "invoices" (
  "id"                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"           uuid        NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "invoice_number"      text        NOT NULL,
  "booking_id"          uuid        REFERENCES "bookings"("id") ON DELETE SET NULL,
  "service_booking_id"  uuid        REFERENCES "service_bookings"("id") ON DELETE SET NULL,
  "generated_at"        timestamptz NOT NULL DEFAULT now(),
  "generated_by"        uuid        REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_tenant_idx"
  ON "invoices" ("tenant_id", "invoice_number");

CREATE INDEX IF NOT EXISTS "invoices_tenant_idx"
  ON "invoices" ("tenant_id");

CREATE INDEX IF NOT EXISTS "invoices_booking_idx"
  ON "invoices" ("booking_id");

CREATE INDEX IF NOT EXISTS "invoices_service_booking_idx"
  ON "invoices" ("service_booking_id");
