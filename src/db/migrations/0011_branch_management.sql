-- Branch Management: extend the locations table with new fields.
-- All additions are nullable so existing rows are unaffected.
-- incharge_name is nullable at DB level; required by the API layer going forward.

CREATE TYPE "branch_type" AS ENUM ('BRANCH', 'SHOWROOM', 'WORKSHOP', 'WAREHOUSE');

ALTER TABLE "locations"
  ADD COLUMN IF NOT EXISTS "branch_type"      branch_type,
  ADD COLUMN IF NOT EXISTS "incharge_name"    text,
  ADD COLUMN IF NOT EXISTS "pincode"          text,
  ADD COLUMN IF NOT EXISTS "account_type"     text,
  ADD COLUMN IF NOT EXISTS "bank_branch_name" text;
