CREATE TABLE "inner_actions" (
	"after_state" text PRIMARY KEY NOT NULL,
	"before_state" text,
	"index" integer NOT NULL,
	"block_height" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"txn_hash" text NOT NULL,
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"marked_as_canonical_at" timestamp with time zone,
	"aux" text NOT NULL,
	CONSTRAINT "inner_actions_index_unique" UNIQUE("index"),
	CONSTRAINT "actions_before_not_after|inner_actions_check" CHECK ("inner_actions"."before_state" IS NULL OR "inner_actions"."before_state" <> "inner_actions"."after_state")
);
--> statement-breakpoint
ALTER TABLE "outer_actions" DROP CONSTRAINT "actions_before_not_after|check";--> statement-breakpoint
DROP INDEX "before_state|index";--> statement-breakpoint
DROP INDEX "after_state|index";--> statement-breakpoint
DROP INDEX "index|index";--> statement-breakpoint
DROP INDEX "marked_as_canonical_at|index";--> statement-breakpoint
DROP INDEX "aux|index";--> statement-breakpoint
ALTER TABLE "inner_actions" ADD CONSTRAINT "inner_actions_before_state_inner_actions_after_state_fk" FOREIGN KEY ("before_state") REFERENCES "public"."inner_actions"("after_state") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "before_state|inner_actions_index" ON "inner_actions" USING btree ("before_state");--> statement-breakpoint
CREATE INDEX "after_state|inner_actions_index" ON "inner_actions" USING btree ("after_state");--> statement-breakpoint
CREATE INDEX "index|inner_actions_index" ON "inner_actions" USING btree ("index");--> statement-breakpoint
CREATE INDEX "marked_as_canonical_at|inner_actions_index" ON "inner_actions" USING btree ("marked_as_canonical_at");--> statement-breakpoint
CREATE INDEX "aux|inner_actions_index" ON "inner_actions" USING btree ("aux");--> statement-breakpoint
CREATE INDEX "before_state|outer_actions_index" ON "outer_actions" USING btree ("before_state");--> statement-breakpoint
CREATE INDEX "after_state|outer_actions_index" ON "outer_actions" USING btree ("after_state");--> statement-breakpoint
CREATE INDEX "index|outer_actions_index" ON "outer_actions" USING btree ("index");--> statement-breakpoint
CREATE INDEX "marked_as_canonical_at|outer_actions_index" ON "outer_actions" USING btree ("marked_as_canonical_at");--> statement-breakpoint
CREATE INDEX "aux|witness_actions_index" ON "witness_actions" USING btree ("aux");--> statement-breakpoint
ALTER TABLE "outer_actions" ADD CONSTRAINT "actions_before_not_after|outer_actions_check" CHECK ("outer_actions"."before_state" IS NULL OR "outer_actions"."before_state" <> "outer_actions"."after_state");