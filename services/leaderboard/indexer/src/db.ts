import { actions, leaderboard } from "@leaderboard/api"
import { inArray, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { logger } from "./helper"
import { score as depositScore } from "./points/deposit"
import { score as faucetScore } from "./points/faucet"
import { score as liquidityScore } from "./points/liquidity"
import { score as swapScore } from "./points/swap"
import { score as withdrawalScore } from "./points/withdrawal"

export type ActionType = typeof actions.$inferInsert.actionType

export type ScoreConfig = Record<
	ActionType,
	{ points: number; maxOccurrences: number; strategy: "once" | "daily" }
>

export interface ActionToInsert {
	wallet: string
	actionType: ActionType
	transactionHash: string
}

/**
 * Score configuration constructed from all score modules
 * This is the single source of truth for scoring logic
 */
export const scoreConfig = {
	[faucetScore.key]: {
		points: faucetScore.points,
		maxOccurrences: faucetScore.maxOccurences,
		strategy: faucetScore.strategy
	},
	[depositScore.key]: {
		points: depositScore.points,
		maxOccurrences: depositScore.maxOccurences,
		strategy: depositScore.strategy
	},
	[withdrawalScore.key]: {
		points: withdrawalScore.points,
		maxOccurrences: withdrawalScore.maxOccurences,
		strategy: withdrawalScore.strategy
	},
	[swapScore.key]: {
		points: swapScore.points,
		maxOccurrences: swapScore.maxOccurences,
		strategy: swapScore.strategy
	},
	[liquidityScore.key]: {
		points: liquidityScore.points,
		maxOccurrences: liquidityScore.maxOccurences,
		strategy: liquidityScore.strategy
	}
} as const

/**
 * Create database connection for production use
 */
export function createDatabase(connectionString?: string) {
	const str =
		connectionString ??
		process.env.DATABASE_URL ??
		"postgresql://postgres:postgres@localhost:5432/leaderboard"

	const client = postgres(str, { max: 5 })
	return drizzle(client)
}

/**
 * Create a test database
 */
export function createTestDatabase(connectionString?: string) {
	const str =
		connectionString ??
		process.env.DATABASE_URL ??
		"postgresql://postgres:postgres@localhost:5432/leaderboard"

	const url = new URL(str)
	const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"

	if (!isLocalhost) {
		throw new Error(
			`[SAFETY] Test database must use localhost connection. Got hostname: ${url.hostname}. This prevents accidentally running tests against production database.`
		)
	}

	const client = postgres(str, { max: 5 })
	const db = drizzle(client)

	return {
		db,
		async clean() {
			await db.delete(actions)
			await db.delete(leaderboard)
		}
	}
}

/**
 * Recalculate the leaderboard from all existing actions in the database
 * This clears ONLY the leaderboard table and recalculates scores from existing actions
 * Does NOT touch the actions table or fetch from blockchain
 *
 * @param db - Database connection
 * @param config - Score configuration
 */
export async function recalculateLeaderboard(
	db: PostgresJsDatabase,
	config: Partial<ScoreConfig> = scoreConfig
) {
	return db.transaction(async (tx) => {
		// Step 1: Get all existing actions
		logger.info("[Recalculate] Fetching all actions...")
		const allActions = await tx.select().from(actions)

		if (allActions.length === 0) {
			logger.info("[Recalculate] No actions found, leaderboard is empty")
			return {
				actionsProcessed: 0,
				walletsUpdated: 0
			}
		}

		// Step 2: Clear only the leaderboard table (keep actions)
		logger.info("[Recalculate] Clearing leaderboard table...")
		await tx.delete(leaderboard)

		// Step 3: Get all unique wallets
		const uniqueWallets = Array.from(new Set(allActions.map((a) => a.wallet)))

		// Step 4: Recalculate and update leaderboard directly (no insert into actions)
		logger.info(`[Recalculate] Recalculating scores for ${allActions.length} actions...`)
		await updateLeaderboardForWallets({ db: tx, wallets: uniqueWallets, config })

		logger.success("[Recalculate] Leaderboard recalculation completed")

		return {
			actionsProcessed: allActions.length,
			walletsUpdated: uniqueWallets.length
		}
	})
}

function getUTCDayStart(): Date {
	const now = new Date()
	now.setUTCHours(0, 0, 0, 0)
	return now
}

/**
 * Update leaderboard scores for specific wallets based on their existing actions in the database
 * This queries ALL actions for the given wallets and recalculates their total scores
 */
async function updateLeaderboardForWallets(options: {
	db: PostgresJsDatabase
	wallets: string[]
	config?: Partial<ScoreConfig>
}) {
	const { db, wallets, config = scoreConfig } = options
	if (wallets.length === 0) return

	const timestamp = new Date()
	const todayStart = getUTCDayStart()
	const timestampISO = timestamp.toISOString()
	const todayStartISO = todayStart.toISOString()

	// Step 1: Build CTEs for both "once" and "daily" strategies
	// For "once" strategy: count all actions
	// For "daily" strategy: count only actions from today (UTC)
	const actionCountsCTE = db.$with("action_counts").as(
		db
			.select({
				wallet: actions.wallet,
				actionType: actions.actionType,
				countAll: sql<number>`COUNT(*)::int`.as("count_all"),
				countToday:
					sql<number>`COUNT(*) FILTER (WHERE ${actions.timestamp} >= ${todayStartISO}::timestamp)::int`.as(
						"count_today"
					)
			})
			.from(actions)
			.where(inArray(actions.wallet, wallets))
			.groupBy(actions.wallet, actions.actionType)
	)

	// Step 2: Calculate scores based on strategy
	const caseClauses = sql.empty()

	for (const [actionType, scoreConfig] of Object.entries(config)) {
		const countColumn =
			scoreConfig.strategy === "daily" ? actionCountsCTE.countToday : actionCountsCTE.countAll
		caseClauses.append(sql`
			WHEN ${actionType} THEN 
				LEAST(${countColumn}, ${scoreConfig.maxOccurrences}) * ${scoreConfig.points}
		`)
	}

	const walletScoresCTE = db.$with("wallet_scores").as(
		db
			.select({
				wallet: actionCountsCTE.wallet,
				totalScore: sql<number>`
					SUM(
						CASE ${actionCountsCTE.actionType}
							${caseClauses}
							ELSE 0
						END
					)::smallint
				`.as("total_score")
			})
			.from(actionCountsCTE)
			.groupBy(actionCountsCTE.wallet)
	)

	// Step 3: Insert/update leaderboard using the CTE
	await db
		.with(actionCountsCTE, walletScoresCTE)
		.insert(leaderboard)
		.select(
			db
				.select({
					wallet: walletScoresCTE.wallet,
					score: walletScoresCTE.totalScore,
					updatedAt: sql`${timestampISO}::timestamp`.as("updatedAt")
				})
				.from(walletScoresCTE)
		)
		.onConflictDoUpdate({
			target: leaderboard.wallet,
			set: {
				score: sql`EXCLUDED.score`,
				updatedAt: sql`EXCLUDED."updatedAt"`
			}
		})
}

export async function batchInsertActionsAndUpdateLeaderboard(options: {
	db: PostgresJsDatabase
	actionsToInsert: ActionToInsert[]
	config?: Partial<ScoreConfig>
	/**
	 * Which wallets to update in the leaderboard:
	 * - 'inserted': Only update wallets that had NEW actions inserted (skips duplicates)
	 * - 'all': Update all wallets from actionsToInsert, even if actions were duplicates
	 *
	 * Use 'inserted' for normal operation to avoid recalculating when restarting from block 0
	 * Use 'all' for rebuild/recalculate operations where you want to force updates
	 */
	updateMode?: "inserted" | "all"
}) {
	const { db, actionsToInsert, config = scoreConfig, updateMode = "inserted" } = options
	if (actionsToInsert.length === 0) return

	try {
		const timestamp = new Date()

		// Step 1: Batch insert all actions (ignore duplicates) and get only newly inserted actions
		const insertedActions = await db
			.insert(actions)
			.values(
				actionsToInsert.map((action) => ({
					wallet: action.wallet,
					actionType: action.actionType,
					transactionHash: action.transactionHash,
					timestamp
				}))
			)
			.onConflictDoNothing({ target: actions.transactionHash })
			.returning({ wallet: actions.wallet })

		// If no actions were actually inserted (all were duplicates), nothing to do
		if (insertedActions.length === 0) {
			logger.info("No new actions inserted (all were duplicates), skipping leaderboard update")
			return
		}

		// Step 2: Determine which wallets to update based on mode
		const walletsToUpdate =
			updateMode === "inserted"
				? Array.from(new Set(insertedActions.map((a) => a.wallet)))
				: Array.from(new Set(actionsToInsert.map((a) => a.wallet)))

		const duplicatesCount = actionsToInsert.length - insertedActions.length

		logger.info(
			`Inserted ${insertedActions.length} new actions (${duplicatesCount} duplicates skipped), updating ${walletsToUpdate.length} wallet scores (mode: ${updateMode})`
		)

		// Step 3: Update leaderboard for affected wallets
		// Note: This queries ALL actions for these wallets from the database and recalculates total scores
		await updateLeaderboardForWallets({ db, wallets: walletsToUpdate, config })

		logger.success(
			`Leaderboard updated for ${walletsToUpdate.length} wallets (${insertedActions.length} actions inserted, ${duplicatesCount} duplicates)`
		)
	} catch (error) {
		logger.error("Error in batch insert and update:", error)
		throw error
	}
}
