CREATE TYPE "service_payment_type" AS ENUM ('CASH', 'INSURANCE');

ALTER TABLE "service_bookings"
  ADD COLUMN IF NOT EXISTS "payment_type"           service_payment_type NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS "insurance_company"      text,
  ADD COLUMN IF NOT EXISTS "insurance_person_name"  text,
  ADD COLUMN IF NOT EXISTS "insurance_person_phone" text,
  ADD COLUMN IF NOT EXISTS "insurance_amount"       numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "delivery_order_no"      text;
