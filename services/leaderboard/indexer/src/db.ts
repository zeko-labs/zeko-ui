import { actions, type actionTypes, leaderboard } from "@leaderboard/api"
import { and, eq, inArray, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
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
	timestamp: string
}

/**
 * Score configuration for each action type
 * Defines points awarded, max occurrences, and accumulation strategy
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
 * Create a production database
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

/**
 * Update leaderboard scores for specific wallets based on their existing actions in the database
 * This queries ALL actions for the given wallets and recalculates their total scores
 *
 * Performance optimizations:
 * - Uses CTEs to eliminate N+1 query problem for daily strategy
 * - Batches large wallet arrays to prevent inefficient IN clauses
 * - Requires composite index on (wallet, actionType, timestamp) for optimal performance
 */
async function updateLeaderboardForWallets(options: {
	db: PostgresJsDatabase
	wallets: string[]
	config?: Partial<ScoreConfig>
	batchSize?: number
}) {
	const { db, wallets, config = scoreConfig, batchSize = 1000 } = options
	if (wallets.length === 0) return false

	// Batch large wallet arrays to prevent inefficient IN clauses
	if (wallets.length > batchSize) {
		logger.info(
			`Batching ${wallets.length} wallets into chunks of ${batchSize} for leaderboard update`
		)
		for (let i = 0; i < wallets.length; i += batchSize) {
			const batch = wallets.slice(i, i + batchSize)
			await updateLeaderboardForWalletsBatch({ db, wallets: batch, config })
		}
		return true
	}

	await updateLeaderboardForWalletsBatch({ db, wallets, config })
	return true
}

/**
 * Internal function that performs the actual leaderboard update for a batch of wallets
 * Uses CTE-based approach to avoid N+1 query problem with daily strategy
 */
async function updateLeaderboardForWalletsBatch(options: {
	db: PostgresJsDatabase
	wallets: string[]
	config: Partial<ScoreConfig>
}) {
	const { db, wallets, config } = options
	const timestamp = new Date().toISOString()

	const { daily, once } = Object.groupBy(Object.entries(config), ([_, cfg]) => cfg.strategy)

	const walletFilter = or(...wallets.map((w) => eq(actions.wallet, w))) ?? sql`false`

	const onceScoreParts = (once ?? []).map(
		([actionType, cfg]) =>
			sql`LEAST(COUNT(*) FILTER (WHERE ${actions.actionType} = ${actionType}), ${cfg.maxOccurrences}) * ${cfg.points}`
	)

	const totalOnceScore =
		onceScoreParts.length > 0
			? onceScoreParts.reduce((acc, part) => sql`${acc} + ${part}`, sql`0`)
			: sql`0`

	const conflictUpdate = {
		target: leaderboard.wallet,
		set: {
			score: sql`EXCLUDED.score`,
			updatedAt: sql`EXCLUDED."updatedAt"`
		}
	} as const

	// If we have daily strategies, use CTE-based approach
	if (daily) {
		const dailyActionTypes = daily.map(([type, _]) => type) as Array<(typeof actionTypes)[number]>

		// CTE 1: Get raw daily counts for all wallets and action types in one scan
		const dailyCounts = db.$with("daily_counts").as(
			db
				.select({
					wallet: actions.wallet,
					actionType: actions.actionType,
					dailyCount: sql<number>`COUNT(*)::int`.as("daily_count")
				})
				.from(actions)
				.where(and(walletFilter, inArray(actions.actionType, dailyActionTypes)))
				.groupBy(actions.wallet, actions.actionType, sql`DATE(${actions.timestamp})`)
		)

		const buildCaseStatement = (field: "maxOccurrences" | "points") =>
			sql`${daily.reduce(
				(acc, [actionType, cfg]) => sql`${acc} WHEN ${actionType} THEN ${cfg[field]}`,
				sql`CASE "actionType"`
			)} ELSE 0 END`

		const maxOccurrencesCase = buildCaseStatement("maxOccurrences")
		const pointsCase = buildCaseStatement("points")

		// CTE 2: Apply capping/points and sum per wallet
		const totalDailyScores = db.$with("total_daily_scores").as(
			db
				.select({
					wallet: dailyCounts.wallet,
					totalDailyScore:
						sql<number>`COALESCE(SUM(LEAST("daily_count", ${maxOccurrencesCase}) * ${pointsCase}), 0)`.as(
							"total_daily_score"
						)
				})
				.from(dailyCounts)
				.groupBy(dailyCounts.wallet)
		)

		// Final query with CTEs
		await db
			.with(dailyCounts, totalDailyScores)
			.insert(leaderboard)
			.select(() =>
				db
					.select({
						wallet: actions.wallet,
						score:
							sql<number>`(${totalOnceScore} + COALESCE(tds.total_daily_score, 0))::smallint`.as(
								"score"
							),
						updatedAt: sql<Date>`${timestamp}::timestamp`.as("updatedAt")
					})
					.from(actions)
					.leftJoin(sql`${totalDailyScores} AS tds`, sql`${actions.wallet} = tds.wallet`)
					.where(walletFilter)
					.groupBy(actions.wallet, sql`tds.total_daily_score`)
			)
			.onConflictDoUpdate(conflictUpdate)
	}
	// No daily strategies, use simpler query without CTEs
	else if (once) {
		await db
			.insert(leaderboard)
			.select(() =>
				db
					.select({
						wallet: actions.wallet,
						score: sql<number>`(${totalOnceScore})::smallint`.as("score"),
						updatedAt: sql<Date>`${timestamp}::timestamp`.as("updatedAt")
					})
					.from(actions)
					.where(walletFilter)
					.groupBy(actions.wallet)
			)
			.onConflictDoUpdate(conflictUpdate)
	}
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
	if (actionsToInsert.length === 0) return false

	try {
		// Step 1: Batch insert all actions (ignore duplicates) and get only newly inserted actions
		const insertedActions = await db
			.insert(actions)
			.values(
				actionsToInsert.map((action) => ({
					wallet: action.wallet,
					actionType: action.actionType,
					transactionHash: action.transactionHash,
					timestamp: new Date(Number(action.timestamp))
				}))
			)
			.onConflictDoNothing({ target: actions.transactionHash })
			.returning({ wallet: actions.wallet })

		if (insertedActions.length === 0) {
			logger.info("No new actions inserted (all were duplicates), skipping leaderboard update")
			return false
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
		const updated = await updateLeaderboardForWallets({ db, wallets: walletsToUpdate, config })

		logger.success(
			`Leaderboard updated for ${walletsToUpdate.length} wallets (${insertedActions.length} actions inserted, ${duplicatesCount} duplicates)`
		)
		return updated
	} catch (error) {
		logger.error("Error in batch insert and update:", error)
		throw error
	}
}
