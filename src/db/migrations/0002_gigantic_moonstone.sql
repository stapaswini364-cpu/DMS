CREATE TABLE "service_booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_booking_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"is_gst_applicable" boolean DEFAULT true NOT NULL,
	"gst_percent" numeric(5, 2) DEFAULT '18' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "booking_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "mrn_number" text;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "discount_category" text;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "discount_type" "discount_type";--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "discount_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "service_bookings" ADD COLUMN "discount_remarks" text;--> statement-breakpoint
ALTER TABLE "service_booking_items" ADD CONSTRAINT "service_booking_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_booking_items" ADD CONSTRAINT "service_booking_items_service_booking_id_service_bookings_id_fk" FOREIGN KEY ("service_booking_id") REFERENCES "public"."service_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "svc_booking_items_booking_idx" ON "service_booking_items" USING btree ("service_booking_id");--> statement-breakpoint
CREATE INDEX "svc_booking_items_tenant_idx" ON "service_booking_items" USING btree ("tenant_id");
