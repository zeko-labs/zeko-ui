import { sql } from "drizzle-orm"
import {
	type AnyPgColumn,
	bigint,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp
} from "drizzle-orm/pg-core"

export const outerActions = pgTable(
	"outer_actions",
	{
		afterState: text("after_state").primaryKey(),
		kind: text("kind", { enum: ["commit", "witness"] as const }).notNull(),
		beforeState: text("before_state").references((): AnyPgColumn => outerActions.afterState, {
			onDelete: "restrict"
		}),
		index: integer("index").notNull().unique(),
		blockHeight: integer("block_height").notNull(),
		timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
		txnHash: text("txn_hash").notNull(),
		fields: jsonb("fields").$type<string[]>().notNull(),
		slotRangeLower: bigint("slot_range_lower", { mode: "bigint" }).notNull(),
		slotRangeUpper: bigint("slot_range_upper", { mode: "bigint" }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		markedAsCanonicalAt: timestamp("marked_as_canonical_at", { withTimezone: true })
	},
	(table) => [
		index("before_state|outer_actions_index").on(table.beforeState),
		index("after_state|outer_actions_index").on(table.afterState),
		index("index|outer_actions_index").on(table.index),
		index("marked_as_canonical_at|outer_actions_index").on(table.markedAsCanonicalAt),
		check(
			"actions_before_not_after|outer_actions_check",
			sql`${table.beforeState} IS NULL OR ${table.beforeState} <> ${table.afterState}`
		)
	]
)

export const commitActions = pgTable("commit_actions", {
	afterState: text("after_state")
		.primaryKey()
		.references(() => outerActions.afterState, { onDelete: "cascade" }),
	ledger: text("ledger").notNull(),
	innerActionState: text("inner_action_state").notNull(),
	innerActionStateLength: integer("inner_action_state_length").notNull(),
	synchronizedOuterActionState: text("synchronized_outer_action_state").notNull(),
	synchronizedOuterActionStateLength: integer("synchronized_outer_action_state_length").notNull()
})

export const witnessActions = pgTable(
	"witness_actions",
	{
		afterState: text("after_state")
			.primaryKey()
			.references(() => outerActions.afterState, { onDelete: "cascade" }),
		aux: text("aux").notNull()
	},
	(table) => [index("aux|witness_actions_index").on(table.aux)]
)

export const innerActions = pgTable(
	"inner_actions",
	{
		afterState: text("after_state").primaryKey(),
		beforeState: text("before_state").references((): AnyPgColumn => innerActions.afterState, {
			onDelete: "restrict"
		}),
		index: integer("index").notNull().unique(),
		blockHeight: integer("block_height").notNull(),
		timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
		txnHash: text("txn_hash").notNull(),
		accountUpdateId: text("account_update_id"),
		fields: jsonb("fields").$type<string[]>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		markedAsCanonicalAt: timestamp("marked_as_canonical_at", { withTimezone: true }),
		aux: text("aux").notNull()
	},
	(table) => [
		index("before_state|inner_actions_index").on(table.beforeState),
		index("after_state|inner_actions_index").on(table.afterState),
		index("index|inner_actions_index").on(table.index),
		index("marked_as_canonical_at|inner_actions_index").on(table.markedAsCanonicalAt),
		index("account_update_id|inner_actions_index").on(table.accountUpdateId),
		index("aux|inner_actions_index").on(table.aux),
		check(
			"actions_before_not_after|inner_actions_check",
			sql`${table.beforeState} IS NULL OR ${table.beforeState} <> ${table.afterState}`
		)
	]
)

export const ethereumAssetRegistryCheckpoints = pgTable(
	"ethereum_asset_registry_checkpoints",
	{
		root: text("root").primaryKey(),
		count: integer("count").notNull().unique(),
		schemaVersion: integer("schema_version").notNull(),
		depth: integer("depth").notNull(),
		blockHeight: integer("block_height").notNull(),
		timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
		txnHash: text("txn_hash").notNull(),
		finalityStatus: text("finality_status").default("canonical").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		check(
			"ethereum_asset_registry_checkpoint_shape",
			sql`${table.count} > 0 AND ${table.count} <= 256 AND ${table.schemaVersion} = 1 AND ${table.depth} = 8`
		),
		check(
			"ethereum_asset_registry_checkpoint_finality",
			sql`${table.finalityStatus} IN ('pending', 'canonical')`
		)
	]
)

export const ethereumAssetRecords = pgTable(
	"ethereum_asset_records",
	{
		registryIndex: integer("registry_index").primaryKey(),
		schemaVersion: integer("schema_version").notNull(),
		assetId: text("asset_id").notNull().unique(),
		ethereumTokenAddress: text("ethereum_token_address").notNull().unique(),
		tokenOwnerL2: text("token_owner_l2").notNull().unique(),
		tokenIdL2: text("token_id_l2").notNull().unique(),
		decimals: integer("decimals").notNull(),
		inventoryCap: bigint("inventory_cap", { mode: "bigint" }).notNull(),
		mftStandardVkId: text("mft_standard_vk_id").notNull(),
		vaultPublicKey: text("vault_public_key").notNull(),
		universalBridgeVkId: text("universal_bridge_vk_id").notNull(),
		registeredRoot: text("registered_root")
			.notNull()
			.references(() => ethereumAssetRegistryCheckpoints.root, { onDelete: "restrict" }),
		blockHeight: integer("block_height").notNull(),
		timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
		txnHash: text("txn_hash").notNull(),
		finalityStatus: text("finality_status").default("canonical").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		check(
			"ethereum_asset_record_shape",
			sql`${table.registryIndex} >= 0 AND ${table.registryIndex} < 256 AND ${table.schemaVersion} = 1 AND ${table.decimals} >= 0 AND ${table.decimals} <= 9 AND ${table.inventoryCap} > 0`
		),
		check(
			"ethereum_asset_record_finality",
			sql`${table.finalityStatus} IN ('pending', 'canonical')`
		)
	]
)

export const ethereumAssetRegistryMemberships = pgTable(
	"ethereum_asset_registry_memberships",
	{
		root: text("root")
			.notNull()
			.references(() => ethereumAssetRegistryCheckpoints.root, { onDelete: "cascade" }),
		registryIndex: integer("registry_index")
			.notNull()
			.references(() => ethereumAssetRecords.registryIndex, { onDelete: "restrict" }),
		path: jsonb("path").$type<string[]>().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.root, table.registryIndex] }),
		check(
			"ethereum_asset_registry_membership_path_width",
			sql`jsonb_array_length(${table.path}) = 8`
		)
	]
)
