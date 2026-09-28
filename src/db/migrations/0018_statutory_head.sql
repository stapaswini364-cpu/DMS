-- Adds statutory_head classification to coa_major_heads for Schedule III
-- Balance Sheet presentation (Shareholders' Funds / Non-Current / Current).
-- Nullable: only meaningful for Assets / Liabilities / Equity major heads;
-- Income and Expense major heads leave it NULL.

CREATE TYPE "public"."statutory_head" AS ENUM(
  'shareholders_funds',
  'non_current_liabilities',
  'current_liabilities',
  'non_current_assets',
  'current_assets'
);--> statement-breakpoint

ALTER TABLE "coa_major_heads" ADD COLUMN "statutory_head" "statutory_head";--> statement-breakpoint

-- Backfill existing seeded major heads across all tenants. Matches by the
-- exact seed name; anything else (manually created) stays NULL and surfaces
-- as "Unclassified" in the Balance Sheet report.
UPDATE "coa_major_heads" SET "statutory_head" = 'current_assets'      WHERE "name" = 'Current Assets';--> statement-breakpoint
UPDATE "coa_major_heads" SET "statutory_head" = 'current_liabilities' WHERE "name" = 'Current Liabilities';--> statement-breakpoint
UPDATE "coa_major_heads" SET "statutory_head" = 'shareholders_funds'  WHERE "name" = 'Owner''s Equity';
