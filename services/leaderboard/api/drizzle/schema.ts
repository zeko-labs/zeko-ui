import { sql } from "drizzle-orm"
import { index, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core"

const uuidv7 = sql`gen_random_uuid_v7()`

export const actionTypes = [
	"FAUCET_ZEKO_TMINA",
	"BRIDGE_MINA_TO_ZEKO",
	"BRIDGE_ZEKO_TO_MINA",
	"LUMINA_SWAP_MINA_TZEKO",
	"LUMINA_ADD_LIQUIDITY_MINA_TZEKO"
] as const

export const actions = pgTable(
	"Actions",
	{
		id: uuid().primaryKey().default(uuidv7),
		wallet: text().notNull(),
		actionType: text({ enum: actionTypes }).notNull(),
		transactionHash: text().notNull().unique(),
		timestamp: timestamp().notNull().defaultNow()
	},
	(table) => [
		// Composite index for daily strategy performance (used in CTE queries)
		index("wallet:action_type:timestamp|index").on(table.wallet, table.actionType, table.timestamp)
	]
)

export const manualAdjustments = pgTable(
	"Manual_Adjustments",
	{
		id: uuid().primaryKey().default(uuidv7),
		wallet: text().notNull(),
		pointsChange: smallint().notNull(),
		sidequest: text().notNull(),
		reason: text(),
		timestamp: timestamp().notNull().defaultNow()
	},
	(table) => [index("wallet|index").on(table.wallet)]
)

export const leaderboard = pgTable(
	"Leaderboard",
	{
		wallet: text().primaryKey(),
		score: smallint().notNull().default(0),
		updatedAt: timestamp().notNull().defaultNow()
	},
	(table) => [
		// Composite index for keyset pagination: (score DESC, wallet ASC)
		index("score_wallet|index").on(table.score, table.wallet)
	]
)
