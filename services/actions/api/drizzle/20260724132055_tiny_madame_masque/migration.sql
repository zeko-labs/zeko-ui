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
