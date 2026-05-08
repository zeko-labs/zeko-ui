ALTER TABLE "actions" ADD COLUMN "timestamp" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "txn_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "fields" jsonb NOT NULL;