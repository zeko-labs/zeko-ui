import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
	type ActionToInsert,
	type ActionType,
	batchInsertActionsAndUpdateLeaderboard,
	recalculateLeaderboard,
	scoreConfig
} from "./db"
import { logger, triggerDistributorBroadcast, wait } from "./helper"
import { handler as deposit } from "./points/deposit"
import { handler as faucet } from "./points/faucet"
import { handler as liquidity } from "./points/liquidity"
import { handler as swap } from "./points/swap"
import { handler as withdrawal } from "./points/withdrawal"

interface IndexerConfig {
	startingBlock: number
	intervalSeconds: number
	maxRetries: number
}

interface IndexerState {
	isRunning: boolean
	lastRunTimestamp: number | null
	lastFetchedBlock: number
	config: IndexerConfig
	consecutiveErrors: number
}

/**
 * Action type mapping from handler names to database enum values
 */
const ACTION_TYPE_MAP = {
	deposit: "BRIDGE_MINA_TO_ZEKO",
	faucet: "FAUCET_ZEKO_TMINA",
	liquidity: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO",
	swap: "LUMINA_SWAP_MINA_TZEKO",
	withdrawal: "BRIDGE_ZEKO_TO_MINA"
} as const satisfies Record<string, ActionType>

/**
 * Helper: Fetch all actions from blockchain starting from a given block
 * This is shared logic used by both runIndexingLoop and rebuild
 * @param fromBlock - Starting block number (inclusive)
 * @param toBlock - Ending block number (inclusive). If not provided, will fetch until no more events found
 */
async function fetchAllActions(fromBlock: number, toBlock?: number): Promise<ActionToInsert[]> {
	// Fetch data from all points modules in parallel
	const [depositData, faucetData, liquidityData, swapData, withdrawalData] = await Promise.all([
		deposit.fetch(fromBlock, toBlock),
		faucet.fetch(fromBlock, toBlock),
		liquidity.fetch(fromBlock, toBlock),
		swap.fetch(fromBlock, toBlock),
		withdrawal.fetch(fromBlock, toBlock)
	])

	logger.info("Fetched data:", {
		deposit: depositData.length,
		faucet: faucetData.length,
		liquidity: liquidityData.length,
		swap: swapData.length,
		withdrawal: withdrawalData.length
	})

	// Collect all actions to insert in a single batch
	const actionsToInsert: ActionToInsert[] = []

	// Process deposit actions
	for (const item of depositData) {
		if (!item.recipient || !item.amount) continue
		actionsToInsert.push({
			wallet: item.recipient.toBase58(),
			actionType: ACTION_TYPE_MAP.deposit,
			transactionHash: `deposit-${item.recipient.toBase58()}-${item.amount}`
		})
	}

	// Process faucet actions
	for (const item of faucetData) {
		if (!item.claimer || !item.amount) continue
		actionsToInsert.push({
			wallet: item.claimer.toBase58(),
			actionType: ACTION_TYPE_MAP.faucet,
			transactionHash: `faucet-${item.claimer.toBase58()}-${item.amount}`
		})
	}

	// Process liquidity actions
	for (const item of liquidityData) {
		if (!item.sender || !item.amountIn) continue
		actionsToInsert.push({
			wallet: item.sender.toBase58(),
			actionType: ACTION_TYPE_MAP.liquidity,
			transactionHash: `liquidity-${item.sender.toBase58()}-${item.amountIn}-${item.amountOut}`
		})
	}

	// Process swap actions
	for (const item of swapData) {
		if (!item.sender || !item.amountToken0In) continue
		actionsToInsert.push({
			wallet: item.sender.toBase58(),
			actionType: ACTION_TYPE_MAP.swap,
			transactionHash: `swap-${item.sender.toBase58()}-${item.amountToken0In}-${item.amountToken1In}`
		})
	}

	// Process withdrawal actions
	for (const item of withdrawalData) {
		if (!item.recipient || !item.amount) continue
		actionsToInsert.push({
			wallet: item.recipient.toBase58(),
			actionType: ACTION_TYPE_MAP.withdrawal,
			transactionHash: `withdrawal-${item.recipient.toBase58()}-${item.amount}`
		})
	}

	return actionsToInsert
}

/**
 * Main indexing loop logic with error handling and retries
 * Fetches data from all points modules and inserts into database
 */
async function runIndexingLoop(db: PostgresJsDatabase, state: IndexerState): Promise<void> {
	if (!state.isRunning) {
		return
	}

	logger.info("Running indexing loop...")
	logger.info(`Last fetched block: ${state.lastFetchedBlock}`)

	try {
		const fromBlock = state.lastFetchedBlock
		const toBlock = fromBlock + 10_000 - 1 // Fetch exactly 10k blocks per iteration

		// Fetch actions using the helper
		const actionsToInsert = await fetchAllActions(fromBlock, toBlock)

		// Batch insert actions and update leaderboard
		if (actionsToInsert.length > 0) {
			await batchInsertActionsAndUpdateLeaderboard({
				db,
				actionsToInsert,
				config: scoreConfig,
				updateMode: "inserted" // Only update wallets with new actions
			})
			await triggerDistributorBroadcast()
		}

		// ONLY update lastFetchedBlock on successful completion
		state.lastFetchedBlock = toBlock + 1 // Start next iteration at the next block
		state.lastRunTimestamp = Date.now()
		state.consecutiveErrors = 0 // Reset error counter on success

		logger.success("Indexing loop completed successfully")
	} catch (error) {
		state.consecutiveErrors++
		logger.error(
			`Error in indexing loop (attempt ${state.consecutiveErrors}/${state.config.maxRetries}):`,
			error
		)

		// Check if we've exceeded max retries
		if (state.consecutiveErrors >= state.config.maxRetries) {
			logger.error("Max retries exceeded, stopping indexer")
			state.isRunning = false
			return
		}

		// Wait a bit longer before retrying (exponential backoff)
		const retryDelay = state.config.intervalSeconds * 2 ** (state.consecutiveErrors - 1)
		logger.info(`Retrying in ${retryDelay}s...`)
		await wait(retryDelay)
	}

	// Recursively call for next iteration
	if (state.isRunning) {
		await wait(state.config.intervalSeconds)
		await runIndexingLoop(db, state)
	} else {
		logger.info("Indexer has been stopped.")
	}
}

/**
 * Indexer class to manage the indexing process
 */
export class Indexer {
	#state: IndexerState
	#db: PostgresJsDatabase

	constructor(db: PostgresJsDatabase) {
		this.#db = db
		this.#state = {
			isRunning: false,
			lastRunTimestamp: null,
			lastFetchedBlock: 0,
			consecutiveErrors: 0,
			config: {
				startingBlock: 0,
				intervalSeconds: 2,
				maxRetries: 5
			}
		}
	}

	/**
	 * Start the indexing loop
	 */
	start(config?: Partial<IndexerConfig>) {
		try {
			if (this.#state.isRunning) {
				return { success: false, message: "Indexer is already running" } as const
			}

			// Update config if provided
			if (config) {
				if (config.startingBlock !== undefined) {
					this.#state.config.startingBlock = config.startingBlock
					this.#state.lastFetchedBlock = config.startingBlock
				}
				if (config.intervalSeconds !== undefined) {
					this.#state.config.intervalSeconds = config.intervalSeconds
				}
				if (config.maxRetries !== undefined) {
					this.#state.config.maxRetries = config.maxRetries
				}
			}

			this.#state.isRunning = true
			this.#state.consecutiveErrors = 0

			// Start the recursive loop
			runIndexingLoop(this.#db, this.#state).catch((error) => {
				logger.error("Fatal error in indexing loop:", error)
				this.#state.isRunning = false
			})

			return {
				success: true,
				message: "Indexing loop started",
				config: this.#state.config
			} as const
		} catch (error) {
			return {
				success: false,
				message: `Failed to start indexing loop: ${(error as Error).message}`
			} as const
		}
	}

	/**
	 * Stop the indexing loop
	 */
	stop() {
		if (!this.#state.isRunning) {
			return { success: false, message: "Indexer is not running" }
		}

		this.#state.isRunning = false

		return {
			success: true,
			message: "Indexing loop stopped",
			lastFetchedBlock: this.#state.lastFetchedBlock
		}
	}

	/**
	 * Get current indexer status
	 */
	getStatus() {
		return {
			isRunning: this.#state.isRunning,
			lastRunTimestamp: this.#state.lastRunTimestamp,
			lastRunDate: this.#state.lastRunTimestamp
				? new Date(this.#state.lastRunTimestamp).toISOString()
				: null,
			lastFetchedBlock: this.#state.lastFetchedBlock,
			consecutiveErrors: this.#state.consecutiveErrors,
			config: this.#state.config
		}
	}

	/**
	 * Recalculate: Rebuild leaderboard from existing actions in the database
	 * This does NOT touch the actions table or fetch from blockchain
	 * It only recalculates scores from existing actions
	 */
	async recalculate() {
		// Remember if we were running before
		const wasRunning = this.#state.isRunning
		const previousConfig = { ...this.#state.config }

		// Step 1: Stop the loop if running
		if (this.#state.isRunning) {
			logger.info("[Recalculate] Stopping indexer...")
			this.stop()
		}

		try {
			// Step 2: Recalculate leaderboard from existing actions
			logger.info("[Recalculate] Starting leaderboard recalculation...")
			const result = await recalculateLeaderboard(this.#db, scoreConfig)

			logger.success("[Recalculate] Recalculation completed successfully")

			// Step 3: Restart the indexing loop if it was running before
			if (wasRunning) {
				logger.info("[Recalculate] Restarting indexing loop...")
				this.start(previousConfig)
			}

			return {
				success: true,
				message: "Recalculation completed successfully",
				restarted: wasRunning,
				...result
			} as const
		} catch (error) {
			logger.error("[Recalculate] Error during recalculation:", error)
			return {
				success: false,
				message: `Recalculation failed: ${(error as Error).message}`
			} as const
		}
	}

	/**
	 * Rebuild: Reconstruct the entire actions table from scratch by fetching from blockchain,
	 * then recalculate the leaderboard
	 * This is a full rebuild of both tables
	 */
	async rebuild(initialBlock = 0) {
		// Remember if we were running before
		const wasRunning = this.#state.isRunning
		const previousConfig = { ...this.#state.config }

		// Step 1: Stop the loop if running
		if (this.#state.isRunning) {
			logger.info("[Rebuild] Stopping indexer...")
			this.stop()
		}

		try {
			// Step 2: Clear both tables
			logger.info("[Rebuild] Clearing actions and leaderboard tables...")
			const { actions: actionsTable, leaderboard: leaderboardTable } = await import(
				"@leaderboard/api"
			)
			await this.#db.delete(leaderboardTable)
			await this.#db.delete(actionsTable)

			// Step 3: Fetch all actions from blockchain starting from initialBlock
			logger.info(`[Rebuild] Fetching actions from block ${initialBlock}...`)
			const actionsToInsert = await fetchAllActions(initialBlock)

			// Step 4: Insert all actions and build leaderboard
			if (actionsToInsert.length > 0) {
				logger.info(`[Rebuild] Inserting ${actionsToInsert.length} actions...`)
				await batchInsertActionsAndUpdateLeaderboard({
					db: this.#db,
					actionsToInsert,
					config: scoreConfig,
					updateMode: "all" // Rebuild should update all wallets
				})
			}

			logger.success("[Rebuild] Rebuild completed successfully")

			// Step 5: Restart the indexing loop if it was running before
			if (wasRunning) {
				logger.info("[Rebuild] Restarting indexing loop...")
				this.start(previousConfig)
			}

			return {
				success: true,
				message: "Rebuild completed successfully",
				restarted: wasRunning,
				actionsProcessed: actionsToInsert.length
			} as const
		} catch (error) {
			logger.error("[Rebuild] Error during rebuild:", error)
			return {
				success: false,
				message: `Rebuild failed: ${(error as Error).message}`
			} as const
		}
	}
}
