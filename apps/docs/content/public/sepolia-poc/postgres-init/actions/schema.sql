-- ---- 20251124140850_material_victor_mancha/migration.sql
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

-- ---- 20251124143138_zippy_lady_bullseye/migration.sql
ALTER TABLE "actions" ADD COLUMN "timestamp" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "txn_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "fields" jsonb NOT NULL;

-- ---- 20251127143800_tiresome_firebird/migration.sql
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

-- ---- 20251127144207_messy_reavers/migration.sql
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

-- ---- 20260716001833_inner_account_update_id/migration.sql
ALTER TABLE "inner_actions" ADD COLUMN "account_update_id" text;--> statement-breakpoint
CREATE INDEX "account_update_id|inner_actions_index" ON "inner_actions" ("account_update_id");

-- ---- 20260724132055_tiny_madame_masque/migration.sql
CREATE TABLE "ethereum_asset_records" (
	"registry_index" integer PRIMARY KEY,
	"schema_version" integer NOT NULL,
	"asset_id" text NOT NULL UNIQUE,
	"ethereum_token_address" text NOT NULL UNIQUE,
	"token_owner_l2" text NOT NULL UNIQUE,
	"token_id_l2" text NOT NULL UNIQUE,
	"decimals" integer NOT NULL,
	"inventory_cap" bigint NOT NULL,
	"mft_standard_vk_id" text NOT NULL,
	"vault_public_key" text NOT NULL,
	"universal_bridge_vk_id" text NOT NULL,
	"registered_root" text NOT NULL,
	"block_height" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"txn_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ethereum_asset_record_shape" CHECK ("registry_index" >= 0 AND "registry_index" < 256 AND "schema_version" = 1 AND "decimals" >= 0 AND "decimals" <= 9 AND "inventory_cap" > 0)
);
--> statement-breakpoint
CREATE TABLE "ethereum_asset_registry_checkpoints" (
	"root" text PRIMARY KEY,
	"count" integer NOT NULL UNIQUE,
	"schema_version" integer NOT NULL,
	"depth" integer NOT NULL,
	"block_height" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"txn_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ethereum_asset_registry_checkpoint_shape" CHECK ("count" > 0 AND "count" <= 256 AND "schema_version" = 1 AND "depth" = 8)
);
--> statement-breakpoint
CREATE TABLE "ethereum_asset_registry_memberships" (
	"root" text,
	"registry_index" integer,
	"path" jsonb NOT NULL,
	CONSTRAINT "ethereum_asset_registry_memberships_pkey" PRIMARY KEY("root","registry_index"),
	CONSTRAINT "ethereum_asset_registry_membership_path_width" CHECK (jsonb_array_length("path") = 8)
);
--> statement-breakpoint
ALTER TABLE "ethereum_asset_records" ADD CONSTRAINT "ethereum_asset_records_Z7f1kcHOCu0r_fkey" FOREIGN KEY ("registered_root") REFERENCES "ethereum_asset_registry_checkpoints"("root") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_memberships" ADD CONSTRAINT "ethereum_asset_registry_memberships_C4a6TZ6tctwT_fkey" FOREIGN KEY ("root") REFERENCES "ethereum_asset_registry_checkpoints"("root") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_memberships" ADD CONSTRAINT "ethereum_asset_registry_memberships_dShX3IsSoqDQ_fkey" FOREIGN KEY ("registry_index") REFERENCES "ethereum_asset_records"("registry_index") ON DELETE RESTRICT;

-- ---- 20260728181441_parched_hardball/migration.sql
ALTER TABLE "ethereum_asset_records" ADD COLUMN "finality_status" text DEFAULT 'canonical' NOT NULL;--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_checkpoints" ADD COLUMN "finality_status" text DEFAULT 'canonical' NOT NULL;--> statement-breakpoint
ALTER TABLE "ethereum_asset_records" ADD CONSTRAINT "ethereum_asset_record_finality" CHECK ("finality_status" IN ('pending', 'canonical'));--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_checkpoints" ADD CONSTRAINT "ethereum_asset_registry_checkpoint_finality" CHECK ("finality_status" IN ('pending', 'canonical'));
