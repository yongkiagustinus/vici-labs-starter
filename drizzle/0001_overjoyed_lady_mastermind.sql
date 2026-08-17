CREATE TABLE IF NOT EXISTS "household_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"email" varchar(320),
	"role" varchar(16) DEFAULT 'member' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "paid_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_household_idx" ON "household_invites" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invite_token_idx" ON "household_invites" USING btree ("token");