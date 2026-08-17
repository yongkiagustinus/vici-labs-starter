CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(200),
	"password_hash" text NOT NULL,
	"billing_customer_id" text,
	"billing_status" varchar(32) DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(24) DEFAULT 'checking' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"recurrence" varchar(16) DEFAULT 'monthly' NOT NULL,
	"reminder_lead_days" bigint DEFAULT 3 NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"limit_amount" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"period" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(16) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) DEFAULT 'My Household' NOT NULL,
	"owner_id" uuid NOT NULL,
	"base_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payee" varchar(200),
	"category" varchar(100),
	"note" text,
	"status" varchar(16) DEFAULT 'uncleared' NOT NULL,
	"kind" varchar(16) DEFAULT 'expense' NOT NULL,
	"assigned_to" varchar(120),
	"iou_person" varchar(200),
	"iou_direction" varchar(12),
	"iou_settled" timestamp with time zone,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"platform" varchar(16),
	"source" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obs_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"source" text NOT NULL,
	"distinct_id" text,
	"user_id" text,
	"path" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obs_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"distinct_id" text NOT NULL,
	"user_id" text,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ts" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "acct_household_idx" ON "accounts" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "acct_sync_idx" ON "accounts" USING btree ("household_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bill_household_idx" ON "bills" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_household_idx" ON "budgets" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hm_household_idx" ON "household_members" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hm_user_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_household_idx" ON "transactions" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "txn_sync_idx" ON "transactions" USING btree ("household_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obs_errors_ts_idx" ON "obs_errors" USING btree ("ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obs_errors_source_idx" ON "obs_errors" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obs_events_name_idx" ON "obs_events" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obs_events_distinct_idx" ON "obs_events" USING btree ("distinct_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obs_events_ts_idx" ON "obs_events" USING btree ("ts");