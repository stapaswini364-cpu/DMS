-- Company Settings: one row per tenant for company identity, address,
-- accounting dates, statutory IDs, bank details, and currency.
-- All columns nullable except fy_start_month / fy_start_day (have DB defaults).

CREATE TABLE IF NOT EXISTS "company_settings" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"            uuid NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "company_name"         text,
  "company_category"     text,
  "email"                text,
  "phone"                text,
  "website"              text,
  "address"              text,
  "state"                text,
  "country"              text DEFAULT 'India',
  "pincode"              text,
  "mailing_name"         text,
  "fy_start_month"       integer NOT NULL DEFAULT 4,
  "fy_start_day"         integer NOT NULL DEFAULT 1,
  "books_beginning_from" date,
  "gstin"                text,
  "pan"                  text,
  "msme"                 text,
  "tan"                  text,
  "cin"                  text,
  "bank_name"            text,
  "account_number"       text,
  "ifsc_code"            text,
  "account_type"         text,
  "currency_symbol"      text DEFAULT '₹',
  "currency_formal_name" text DEFAULT 'INR - Indian Rupee',
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);
