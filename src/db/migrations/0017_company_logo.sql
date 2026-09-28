-- Adds tenant logo URL to company_settings. Stored as the public Supabase
-- Storage URL of the uploaded file; NULL means "no logo, show initials
-- fallback".

ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "logo_url" text;
