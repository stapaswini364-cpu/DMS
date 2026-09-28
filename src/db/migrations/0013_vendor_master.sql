-- Vendor Master: new entity for suppliers/creditors.
-- Mirrors the customers table convention; opening balance stored here,
-- actual JE posting to Accounts Payable (L0001) deferred to a future phase.

CREATE TYPE "vendor_type" AS ENUM (
  'INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP',
  'COMPANY', 'TRUST', 'GOVT', 'OTHER'
);

CREATE TYPE "vendor_category" AS ENUM (
  'VEHICLE', 'PARTS', 'SERVICES', 'CAPITAL_GOODS',
  'TRANSPORT', 'PROFESSIONAL', 'UTILITY', 'OTHER'
);

CREATE TABLE IF NOT EXISTS "vendors" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"                uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "vendor_code"              text NOT NULL,
  "vendor_type"              vendor_type NOT NULL,
  "vendor_category"          vendor_category NOT NULL,
  "name"                     text NOT NULL,
  "trade_name"               text,
  "contact_person"           text,
  "phone"                    text NOT NULL,
  "email"                    text,
  "website"                  text,
  "pan"                      text,
  "gstin"                    text,
  "msme_status"              text,
  "udyam_no"                 text,
  "address_line1"            text NOT NULL,
  "address_line2"            text,
  "city"                     text NOT NULL,
  "state"                    text NOT NULL,
  "pincode"                  text NOT NULL,
  "country"                  text NOT NULL DEFAULT 'India',
  "bank_name"                text,
  "bank_account_name"        text,
  "account_number"           text,
  "ifsc_code"                text,
  "bank_branch"              text,
  "opening_balance"          numeric(12, 2),
  "opening_balance_type"     text,
  "opening_balance_remarks"  text,
  "created_at"               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "vendors_tenant_idx"
  ON "vendors" ("tenant_id");

CREATE INDEX IF NOT EXISTS "vendors_phone_idx"
  ON "vendors" ("phone");

CREATE UNIQUE INDEX IF NOT EXISTS "vendors_code_tenant_idx"
  ON "vendors" ("tenant_id", "vendor_code");
