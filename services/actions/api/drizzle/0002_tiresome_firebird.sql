ALTER TABLE "actions" RENAME TO "outer_actions";--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_index_unique";--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_before_not_after|check";--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_before_state_actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "commit_actions" DROP CONSTRAINT "commit_actions_after_state_actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "witness_actions" DROP CONSTRAINT "witness_actions_after_state_actions_after_state_fk";
--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "outer_actions_before_state_outer_actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."outer_actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_actions" ADD CONSTRAINT "commit_actions_after_state_outer_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."outer_actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "witness_actions" ADD CONSTRAINT "witness_actions_after_state_outer_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."outer_actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "outer_actions_index_unique" UNIQUE("index");--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "actions_before_not_after|check" CHECK ("outer_actions"."before_state" IS NULL OR "outer_actions"."before_state" <> "outer_actions"."after_state");