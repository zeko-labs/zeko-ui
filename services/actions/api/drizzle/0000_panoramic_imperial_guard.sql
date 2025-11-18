CREATE TABLE "Actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"before_state" text,
	"length" integer NOT NULL,
	"block_height" integer NOT NULL,
	"slot_range_lower" integer NOT NULL,
	"slot_range_upper" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actions_before_not_after|check" CHECK ("Actions"."before_state" IS NULL OR "Actions"."before_state" <> "Actions"."after_state")
);
--> statement-breakpoint
CREATE TABLE "commit_actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"ledger" text NOT NULL,
	"inner_action_state" text NOT NULL,
	"inner_action_state_length" integer NOT NULL,
	"synchronized_outer_action_state" text NOT NULL,
	"synchronized_outer_action_state_length" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "witness_actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"aux" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Actions" ADD CONSTRAINT "Actions_before_state_Actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."Actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_actions" ADD CONSTRAINT "commit_actions_after_state_Actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."Actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "witness_actions" ADD CONSTRAINT "witness_actions_after_state_Actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."Actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "before_state|index" ON "Actions" USING btree ("before_state");--> statement-breakpoint
CREATE INDEX "after_state|index" ON "Actions" USING btree ("after_state");--> statement-breakpoint
CREATE INDEX "length|index" ON "Actions" USING btree ("length");--> statement-breakpoint
CREATE INDEX "aux|index" ON "witness_actions" USING btree ("aux");