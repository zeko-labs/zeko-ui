/**
 * Debugging script to add data to leaderboard
 * Periodically inserts manual adjustments to the top 20 wallets and triggers broadcasts
 */

import { checkDatabaseConnectionString, leaderboard } from "@leaderboard/api"
import { desc } from "drizzle-orm"
import { batchInsertManualAdjustmentsAndUpdateLeaderboard, createDatabase } from "../src/db"
import { broadcast, getMaxBlockHeight, logger } from "../src/helper"

const INTERVAL_MS = 4_000
const TOP_N = 20
const MIN_SELECTED = 3 // Minimum number of wallets to adjust per cycle
const MAX_SELECTED = 8 // Maximum number of wallets to adjust per cycle
const SIDEQUEST_NAME = "debug_periodic_bonus"

/**
 * Randomly select a subset of wallets from the array using Fisher-Yates shuffle
 * This ensures uniform distribution across all positions
 */
function randomlySelectWallets(wallets: string[]): string[] {
	if (wallets.length === 0) return []

	const maxPossible = Math.min(MAX_SELECTED, wallets.length)
	const minPossible = Math.min(MIN_SELECTED, wallets.length)
	const count = Math.floor(Math.random() * (maxPossible - minPossible + 1)) + minPossible

	const shuffled = [...wallets]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}

	return shuffled.slice(0, count)
}

/**
 * Generate random manual adjustments for the selected wallets
 */
function generateAdjustments(wallets: string[]) {
	return wallets.map((wallet) => ({
		wallet,
		// Random points between -1000 and +1000
		pointsChange: Math.floor(Math.random() * 2000) - 1000,
		sidequest: SIDEQUEST_NAME,
		reason: `Periodic debug adjustment at ${new Date().toISOString()}`
	}))
}

/**
 * Fetch top N leaderboard entries
 */
async function fetchTopLeaderboard(db: ReturnType<typeof createDatabase>, limit: number) {
	return db
		.select({
			wallet: leaderboard.wallet,
			score: leaderboard.score
		})
		.from(leaderboard)
		.orderBy(desc(leaderboard.score), leaderboard.wallet)
		.limit(limit)
}

/**
 * Helper function to wait for a specified duration
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const db = createDatabase(checkDatabaseConnectionString())

/**
 * Main loop: fetch top wallets, add adjustments, broadcast
 */
async function runPeriodicAdjustments() {
	logger.info(`Starting periodic adjustments script (interval: ${INTERVAL_MS}ms, top: ${TOP_N})`)

	const runCycle = async (count = 0): Promise<void> => {
		try {
			logger.info(`Starting cycle ${count + 1}...`)
			logger.info("Fetching top leaderboard entries...")
			const topEntries = await fetchTopLeaderboard(db, TOP_N)

			logger.info(`Found ${topEntries.length} entries`)

			const allWallets = topEntries.map((entry) => entry.wallet)
			const selectedWallets = randomlySelectWallets(allWallets)

			// Get indices of selected wallets for logging
			const selectedIndices = selectedWallets.map((w) => allWallets.indexOf(w) + 1)
			logger.info(
				`Randomly selected ${selectedWallets.length} wallets (positions: ${selectedIndices.join(", ")})`
			)

			const adjustments = generateAdjustments(selectedWallets)

			logger.info(
				"Inserting adjustments...",
				adjustments.map((a) => ({
					wallet: a.wallet,
					pointsChange: a.pointsChange,
					sidequest: a.sidequest
				}))
			)

			await batchInsertManualAdjustmentsAndUpdateLeaderboard({ db, adjustments })
			const maxBlockHeight = await getMaxBlockHeight("L2")
			const adjustedBlockHeight = maxBlockHeight + count

			logger.info(
				`Triggering broadcast with blockHeight: ${adjustedBlockHeight} (base: ${maxBlockHeight} + ${count})`
			)
			const broadcastResult = broadcast({
				maxBlockHeight: adjustedBlockHeight,
				hasNewEntries: true
			})

			if (broadcastResult.success) {
				logger.success(`Cycle ${count + 1} completed successfully`)
			} else {
				logger.error("Broadcast failed:", broadcastResult.error)
			}
		} catch (error) {
			logger.error("Error in periodic adjustment cycle:", error)
		}

		await delay(INTERVAL_MS)
		await runCycle(count + 1)
	}

	await runCycle(0)
}

runPeriodicAdjustments().catch((error) => {
	logger.error("Fatal error in periodic adjustments script:", error)
	process.exit(1)
})
