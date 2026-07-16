import { sql } from "drizzle-orm"
import {
	type AnyPgColumn,
	bigint,
	check,
	index,
	integer,
	jsonb,
	pgTable,
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
