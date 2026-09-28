-- Customer Master upgrade: additive expansion of the live customers table.
-- All new columns are nullable except customer_code, which is backfilled for
-- existing rows and then made NOT NULL. No existing rows or queries are broken.

CREATE TYPE "customer_type" AS ENUM (
  'INDIVIDUAL', 'PROPRIETORSHIP', 'PARTNERSHIP', 'LLP',
  'COMPANY', 'TRUST', 'GOVT', 'OTHER'
);

CREATE TYPE "customer_category" AS ENUM (
  'CUSTOMER', 'DEALER', 'INSURANCE', 'FINANCER', 'OTHER'
);

-- Step 1: add all new nullable columns (including customer_code nullable first)
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "customer_code"         text,
  ADD COLUMN IF NOT EXISTS "customer_type"         customer_type,
  ADD COLUMN IF NOT EXISTS "customer_category"     customer_category,
  ADD COLUMN IF NOT EXISTS "trade_name"            text,
  ADD COLUMN IF NOT EXISTS "contact_person"        text,
  ADD COLUMN IF NOT EXISTS "website"               text,
  ADD COLUMN IF NOT EXISTS "gstin"                 text,
  ADD COLUMN IF NOT EXISTS "msme_status"           text,
  ADD COLUMN IF NOT EXISTS "udyam_no"              text,
  ADD COLUMN IF NOT EXISTS "address_line2"         text,
  ADD COLUMN IF NOT EXISTS "country"               text DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS "state_code"            text,
  ADD COLUMN IF NOT EXISTS "bank_name"             text,
  ADD COLUMN IF NOT EXISTS "bank_account_name"     text,
  ADD COLUMN IF NOT EXISTS "account_number"        text,
  ADD COLUMN IF NOT EXISTS "ifsc_code"             text,
  ADD COLUMN IF NOT EXISTS "bank_branch"           text,
  ADD COLUMN IF NOT EXISTS "opening_balance"       numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "opening_balance_type"  text,
  ADD COLUMN IF NOT EXISTS "opening_balance_remarks" text;

-- Step 2: backfill customer_code for every existing row (sequential per tenant)
UPDATE "customers"
SET "customer_code" = 'CUST-' || LPAD(ranked.rn::text, 4, '0')
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "tenant_id" ORDER BY "created_at", "id") AS rn
  FROM "customers"
) ranked
WHERE "customers"."id" = ranked."id";

-- Step 3: enforce NOT NULL now that all rows have a code
ALTER TABLE "customers" ALTER COLUMN "customer_code" SET NOT NULL;

-- Step 4: unique index on (tenant_id, customer_code)
CREATE UNIQUE INDEX IF NOT EXISTS "customers_code_tenant_idx"
  ON "customers" ("tenant_id", "customer_code");
