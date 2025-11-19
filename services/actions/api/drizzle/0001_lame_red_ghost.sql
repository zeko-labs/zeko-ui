ALTER TABLE "Actions" RENAME TO "actions";--> statement-breakpoint
ALTER TABLE "actions" DROP CONSTRAINT "actions_before_not_after|check";--> statement-breakpoint
ALTER TABLE "actions" DROP CONSTRAINT "Actions_before_state_Actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "commit_actions" DROP CONSTRAINT "commit_actions_after_state_Actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "witness_actions" DROP CONSTRAINT "witness_actions_after_state_Actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "timestamp" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "txn_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "fields" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_before_state_actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_actions" ADD CONSTRAINT "commit_actions_after_state_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "witness_actions" ADD CONSTRAINT "witness_actions_after_state_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_before_not_after|check" CHECK ("actions"."before_state" IS NULL OR "actions"."before_state" <> "actions"."after_state");