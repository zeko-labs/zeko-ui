CREATE TABLE "actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"before_state" text,
	"index" integer NOT NULL,
	"block_height" integer NOT NULL,
	"slot_range_lower" bigint NOT NULL,
	"slot_range_upper" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_as_canonical_at" timestamp with time zone,
	CONSTRAINT "actions_index_unique" UNIQUE("index"),
	CONSTRAINT "actions_before_not_after|check" CHECK ("actions"."before_state" IS NULL OR "actions"."before_state" <> "actions"."after_state")
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
ALTER TABLE "actions" ADD CONSTRAINT "actions_before_state_actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_actions" ADD CONSTRAINT "commit_actions_after_state_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "witness_actions" ADD CONSTRAINT "witness_actions_after_state_actions_after_state_fk" FOREIGN KEY ("after_state") REFERENCES "public"."actions"("after_state") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "before_state|index" ON "actions" USING btree ("before_state");--> statement-breakpoint
CREATE INDEX "after_state|index" ON "actions" USING btree ("after_state");--> statement-breakpoint
CREATE INDEX "index|index" ON "actions" USING btree ("index");--> statement-breakpoint
CREATE INDEX "marked_as_canonical_at|index" ON "actions" USING btree ("marked_as_canonical_at");--> statement-breakpoint
CREATE INDEX "aux|index" ON "witness_actions" USING btree ("aux");