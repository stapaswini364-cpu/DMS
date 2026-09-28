CREATE TYPE "public"."balance_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TABLE "coa_account_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"normal_balance" "balance_type" NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "coa_major_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coa_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"major_head_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coa_sub_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coa_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sub_group_id" uuid NOT NULL,
	"ledger_code" text NOT NULL,
	"ledger_name" text NOT NULL,
	"opening_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"balance_type" "balance_type" DEFAULT 'debit' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"allow_manual_entry" boolean DEFAULT true NOT NULL,
	"gst_applicable" boolean DEFAULT false NOT NULL,
	"tds_applicable" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coa_account_types" ADD CONSTRAINT "coa_account_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_major_heads" ADD CONSTRAINT "coa_major_heads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_major_heads" ADD CONSTRAINT "coa_major_heads_account_type_id_fkey" FOREIGN KEY ("account_type_id") REFERENCES "public"."coa_account_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_groups" ADD CONSTRAINT "coa_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_groups" ADD CONSTRAINT "coa_groups_major_head_id_fkey" FOREIGN KEY ("major_head_id") REFERENCES "public"."coa_major_heads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_sub_groups" ADD CONSTRAINT "coa_sub_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_sub_groups" ADD CONSTRAINT "coa_sub_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."coa_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_ledgers" ADD CONSTRAINT "coa_ledgers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_ledgers" ADD CONSTRAINT "coa_ledgers_sub_group_id_fkey" FOREIGN KEY ("sub_group_id") REFERENCES "public"."coa_sub_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coa_ledgers" ADD CONSTRAINT "coa_ledgers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coa_account_types_tenant_idx" ON "coa_account_types" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coa_account_types_code_idx" ON "coa_account_types" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "coa_major_heads_tenant_idx" ON "coa_major_heads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "coa_major_heads_type_idx" ON "coa_major_heads" USING btree ("account_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coa_major_heads_code_idx" ON "coa_major_heads" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "coa_groups_tenant_idx" ON "coa_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "coa_groups_major_head_idx" ON "coa_groups" USING btree ("major_head_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coa_groups_code_idx" ON "coa_groups" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "coa_sub_groups_tenant_idx" ON "coa_sub_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "coa_sub_groups_group_idx" ON "coa_sub_groups" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coa_sub_groups_code_idx" ON "coa_sub_groups" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "coa_ledgers_tenant_idx" ON "coa_ledgers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "coa_ledgers_sub_group_idx" ON "coa_ledgers" USING btree ("sub_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coa_ledgers_code_idx" ON "coa_ledgers" USING btree ("tenant_id","ledger_code");
