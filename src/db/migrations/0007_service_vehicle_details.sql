ALTER TABLE "service_bookings" ADD COLUMN IF NOT EXISTS "vehicle_variant" text;
ALTER TABLE "service_bookings" ADD COLUMN IF NOT EXISTS "vehicle_color" text;
ALTER TABLE "service_bookings" ADD COLUMN IF NOT EXISTS "vehicle_engine_number" text;
