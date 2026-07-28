ALTER TABLE "ethereum_asset_records" ADD COLUMN "finality_status" text DEFAULT 'canonical' NOT NULL;--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_checkpoints" ADD COLUMN "finality_status" text DEFAULT 'canonical' NOT NULL;--> statement-breakpoint
ALTER TABLE "ethereum_asset_records" ADD CONSTRAINT "ethereum_asset_record_finality" CHECK ("finality_status" IN ('pending', 'canonical'));--> statement-breakpoint
ALTER TABLE "ethereum_asset_registry_checkpoints" ADD CONSTRAINT "ethereum_asset_registry_checkpoint_finality" CHECK ("finality_status" IN ('pending', 'canonical'));
