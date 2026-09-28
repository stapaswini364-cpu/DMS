-- Phase 2: Posting engine — add running_balance to ledgers, create journal tables
--> statement-breakpoint
ALTER TABLE "coa_ledgers" ADD COLUMN "running_balance" numeric(15, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
CREATE TYPE "public"."je_voucher_type" AS ENUM('RECEIPT', 'PAYMENT', 'SALES', 'PURCHASE', 'CONTRA', 'JOURNAL', 'MANUAL');
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entry_date" timestamp with time zone NOT NULL,
	"voucher_no" text NOT NULL,
	"voucher_type" "je_voucher_type" NOT NULL,
	"narration" text,
	"reference_type" text,
	"reference_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"ledger_id" uuid NOT NULL,
	"debit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"line_narration" text
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "public"."coa_ledgers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "je_tenant_idx" ON "journal_entries" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "je_entry_date_idx" ON "journal_entries" USING btree ("entry_date");
--> statement-breakpoint
CREATE INDEX "je_reference_idx" ON "journal_entries" USING btree ("reference_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "je_voucher_no_idx" ON "journal_entries" USING btree ("tenant_id","voucher_no");
--> statement-breakpoint
CREATE INDEX "jel_tenant_idx" ON "journal_entry_lines" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "jel_entry_idx" ON "journal_entry_lines" USING btree ("journal_entry_id");
--> statement-breakpoint
CREATE INDEX "jel_ledger_idx" ON "journal_entry_lines" USING btree ("ledger_id");
