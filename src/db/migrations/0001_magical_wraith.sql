CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text,
	"action" text NOT NULL,
	"module" text NOT NULL,
	"record_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
