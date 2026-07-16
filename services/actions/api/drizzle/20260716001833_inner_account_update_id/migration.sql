ALTER TABLE "inner_actions" ADD COLUMN "account_update_id" text;--> statement-breakpoint
CREATE INDEX "account_update_id|inner_actions_index" ON "inner_actions" ("account_update_id");
