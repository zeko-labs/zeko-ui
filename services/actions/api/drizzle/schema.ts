import { sql } from "drizzle-orm"
import {
	type AnyPgColumn,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp
} from "drizzle-orm/pg-core"

export const actions = pgTable(
	"actions",
	{
		afterState: text("after_state").primaryKey(),
		kind: text("kind", { enum: ["commit", "witness"] as const }).notNull(),
		beforeState: text("before_state").references((): AnyPgColumn => actions.afterState, {
			onDelete: "restrict"
		}),
		length: integer("length").notNull(),
		blockHeight: integer("block_height").notNull(),
		slotRangeLower: integer("slot_range_lower").notNull(),
		slotRangeUpper: integer("slot_range_upper").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index("before_state|index").on(table.beforeState),
		index("after_state|index").on(table.afterState),
		index("length|index").on(table.length),
		check(
			"actions_before_not_after|check",
			sql`${table.beforeState} IS NULL OR ${table.beforeState} <> ${table.afterState}`
		)
	]
)

export const commitActions = pgTable("commit_actions", {
	afterState: text("after_state")
		.primaryKey()
		.references(() => actions.afterState, { onDelete: "cascade" }),
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
			.references(() => actions.afterState, { onDelete: "cascade" }),
		aux: text("aux").notNull()
	},
	(table) => [index("aux|index").on(table.aux)]
)
