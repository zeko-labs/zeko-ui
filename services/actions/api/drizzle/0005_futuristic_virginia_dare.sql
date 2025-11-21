ALTER TABLE "actions" DROP CONSTRAINT "actions_length_unique";--> statement-breakpoint
DROP INDEX "length|index";--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "index" integer NOT NULL;--> statement-breakpoint
CREATE INDEX "index|index" ON "actions" USING btree ("index");--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "length";--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_index_unique" UNIQUE("index");