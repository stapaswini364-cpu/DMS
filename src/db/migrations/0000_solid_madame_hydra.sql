CREATE TYPE "public"."account_type" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('CUSTOMER', 'VENDOR');--> statement-breakpoint
CREATE TYPE "public"."voucher_type" AS ENUM('RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL', 'SALES', 'PURCHASE', 'DEBIT_NOTE', 'CREDIT_NOTE');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('HO', 'BRANCH');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('STARTER', 'PROFESSIONAL', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('ACTIVE', 'SUSPENDED', 'TRIAL');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'SALES', 'ACCOUNTS', 'SERVICES', 'BILLING', 'AUDITOR');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('DRAFT', 'CONFIRMED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('FLAT', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."finance_type" AS ENUM('BANK', 'NBFC', 'DSA', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'DD', 'CHEQUE', 'NEFT', 'RTGS');--> statement-breakpoint
CREATE TYPE "public"."referred_by_type" AS ENUM('EMPLOYEE', 'CUSTOMER', 'DEALER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."sales_type" AS ENUM('CASH', 'FINANCE');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('PETROL', 'DIESEL', 'ELECTRIC', 'CNG', 'HYBRID');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('AVAILABLE', 'BOOKED', 'SOLD', 'IN_TRANSIT');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'WAITING_FOR_PARTS');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"ifsc_code" text NOT NULL,
	"current_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"location_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" "account_type" NOT NULL,
	"parent_id" uuid,
	"major_head" text,
	"sub_head" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voucher_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"narration" text
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"voucher_number" text NOT NULL,
	"voucher_type" "voucher_type" NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"party_id" uuid,
	"party_type" "party_type",
	"amount" numeric(15, 2) NOT NULL,
	"narration" text,
	"reference" text,
	"location_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"type" "location_type" NOT NULL,
	"phone" text,
	"email" text,
	"bank_name" text,
	"account_number" text,
	"ifsc_code" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"clerk_org_id" text NOT NULL,
	"plan" "plan" DEFAULT 'STARTER' NOT NULL,
	"status" "tenant_status" DEFAULT 'TRIAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" "user_role" NOT NULL,
	"location_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"booking_number" text NOT NULL,
	"mrn_number" text,
	"customer_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"location_id" uuid NOT NULL,
	"ex_showroom_price" numeric(12, 2) NOT NULL,
	"rto_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"insurance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"on_road_price" numeric(12, 2) NOT NULL,
	"addon_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"accessories" jsonb,
	"extended_warranty" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amc" numeric(12, 2) DEFAULT '0' NOT NULL,
	"handling_charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"etc_charges" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sub_total" numeric(12, 2) NOT NULL,
	"discount_enabled" boolean DEFAULT false NOT NULL,
	"discount_category" text,
	"discount_type" "discount_type",
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_approved_by" uuid,
	"discount_remarks" text,
	"exchange_enabled" boolean DEFAULT false NOT NULL,
	"exchange_brand" text,
	"exchange_vehicle_number" text,
	"exchange_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"sales_type" "sales_type" DEFAULT 'CASH' NOT NULL,
	"finance_type" "finance_type",
	"financer_id" uuid,
	"finance_person_name" text,
	"finance_person_phone" text,
	"finance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delivery_order_number" text,
	"booking_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"hp_enabled" boolean DEFAULT false NOT NULL,
	"hp_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"referred_by_type" "referred_by_type",
	"referred_by_employee_id" uuid,
	"owner_name" text,
	"remarks" text,
	"status" "booking_status" DEFAULT 'DRAFT' NOT NULL,
	"booking_date" timestamp with time zone DEFAULT now() NOT NULL,
	"sales_executive_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mrn_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"mrn_number" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"reference_number" text,
	"received_by" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"city" text,
	"state" text,
	"aadhar" text,
	"pan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"color_name" text NOT NULL,
	"color_code" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"fuel_type" "fuel_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ex_showroom_price" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"color_id" uuid NOT NULL,
	"frame_number" text NOT NULL,
	"engine_number" text NOT NULL,
	"status" "vehicle_status" DEFAULT 'AVAILABLE' NOT NULL,
	"location_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_card_number" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"vehicle_frame_number" text,
	"vehicle_reg_number" text,
	"vehicle_model" text NOT NULL,
	"service_type_id" uuid,
	"technician_id" uuid,
	"location_id" uuid NOT NULL,
	"scheduled_date" timestamp with time zone NOT NULL,
	"status" "service_status" DEFAULT 'PENDING' NOT NULL,
	"sub_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"advance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"mrn_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"final_net_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"base_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"specialization" text,
	"location_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_vehicle_inventory_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_discount_approved_by_users_id_fk" FOREIGN KEY ("discount_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_financer_id_financers_id_fk" FOREIGN KEY ("financer_id") REFERENCES "public"."financers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_referred_by_employee_id_users_id_fk" FOREIGN KEY ("referred_by_employee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_sales_executive_id_users_id_fk" FOREIGN KEY ("sales_executive_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrn_receipts" ADD CONSTRAINT "mrn_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrn_receipts" ADD CONSTRAINT "mrn_receipts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrn_receipts" ADD CONSTRAINT "mrn_receipts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mrn_receipts" ADD CONSTRAINT "mrn_receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financers" ADD CONSTRAINT "financers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_models" ADD CONSTRAINT "product_models_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_model_id_product_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."product_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inventory" ADD CONSTRAINT "vehicle_inventory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inventory" ADD CONSTRAINT "vehicle_inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inventory" ADD CONSTRAINT "vehicle_inventory_color_id_product_colors_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."product_colors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_inventory" ADD CONSTRAINT "vehicle_inventory_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_service_type_id_service_types_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_types" ADD CONSTRAINT "service_types_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_tenant_idx" ON "bank_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_location_idx" ON "bank_accounts" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_number_idx" ON "bank_accounts" USING btree ("tenant_id","account_number");--> statement-breakpoint
CREATE INDEX "coa_tenant_idx" ON "chart_of_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "coa_account_type_idx" ON "chart_of_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "coa_parent_idx" ON "chart_of_accounts" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coa_account_code_idx" ON "chart_of_accounts" USING btree ("tenant_id","account_code");--> statement-breakpoint
CREATE INDEX "voucher_entries_tenant_idx" ON "voucher_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "voucher_entries_voucher_idx" ON "voucher_entries" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "voucher_entries_account_idx" ON "voucher_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "vouchers_tenant_idx" ON "vouchers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vouchers_type_idx" ON "vouchers" USING btree ("voucher_type");--> statement-breakpoint
CREATE INDEX "vouchers_date_idx" ON "vouchers" USING btree ("date");--> statement-breakpoint
CREATE INDEX "vouchers_party_idx" ON "vouchers" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "vouchers_location_idx" ON "vouchers" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_number_idx" ON "vouchers" USING btree ("tenant_id","voucher_number");--> statement-breakpoint
CREATE INDEX "locations_tenant_idx" ON "locations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_location_idx" ON "users" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "bookings_tenant_idx" ON "bookings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_vehicle_idx" ON "bookings" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "bookings_location_idx" ON "bookings" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_date_idx" ON "bookings" USING btree ("booking_date");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_booking_number_idx" ON "bookings" USING btree ("tenant_id","booking_number");--> statement-breakpoint
CREATE INDEX "mrn_receipts_tenant_idx" ON "mrn_receipts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mrn_receipts_booking_idx" ON "mrn_receipts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "mrn_receipts_customer_idx" ON "mrn_receipts" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mrn_receipts_mrn_number_idx" ON "mrn_receipts" USING btree ("tenant_id","mrn_number");--> statement-breakpoint
CREATE INDEX "customers_tenant_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_tenant_phone_idx" ON "customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "financers_tenant_idx" ON "financers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_colors_tenant_idx" ON "product_colors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_colors_variant_idx" ON "product_colors" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_models_tenant_idx" ON "product_models" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_variants_tenant_idx" ON "product_variants" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_variants_model_idx" ON "product_variants" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "vehicle_inventory_tenant_idx" ON "vehicle_inventory" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vehicle_inventory_variant_idx" ON "vehicle_inventory" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "vehicle_inventory_status_idx" ON "vehicle_inventory" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicle_inventory_location_idx" ON "vehicle_inventory" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_inventory_frame_number_idx" ON "vehicle_inventory" USING btree ("tenant_id","frame_number");--> statement-breakpoint
CREATE INDEX "service_bookings_tenant_idx" ON "service_bookings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "service_bookings_customer_idx" ON "service_bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "service_bookings_location_idx" ON "service_bookings" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "service_bookings_status_idx" ON "service_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_bookings_scheduled_date_idx" ON "service_bookings" USING btree ("scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "service_bookings_job_card_idx" ON "service_bookings" USING btree ("tenant_id","job_card_number");--> statement-breakpoint
CREATE INDEX "service_types_tenant_idx" ON "service_types" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "technicians_tenant_idx" ON "technicians" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "technicians_location_idx" ON "technicians" USING btree ("location_id");