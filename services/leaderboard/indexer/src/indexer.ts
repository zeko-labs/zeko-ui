import { actions as actionsTable, leaderboard as leaderboardTable } from "@leaderboard/api"
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
	intervalSeconds: number
	maxRetries: number
}

interface ModuleState {
	lastFetchedBlock: number
}

interface IndexerState {
	isRunning: boolean
	lastRunTimestamp: number | null
	moduleStates: Record<string, ModuleState>
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
 * Helper: Recursively Fetch all actions from blockchain starting from a given block per module
 */
async function fetchAllActions(moduleStates: Record<string, ModuleState>): Promise<{
	actionsToInsert: ActionToInsert[]
	updatedModuleStates: Record<string, ModuleState>
}> {
	logger.box(`📡 Fetching all actions from their respective module states`)
	logger.info("Module states:", moduleStates)
	logger.info("Initiating parallel fetch across all point modules...")

	const [depositResult, faucetResult, liquidityResult, swapResult, withdrawalResult] =
		await Promise.all([
			deposit.fetch(moduleStates.deposit.lastFetchedBlock),
			faucet.fetch(moduleStates.faucet.lastFetchedBlock),
			liquidity.fetch(moduleStates.liquidity.lastFetchedBlock),
			swap.fetch(moduleStates.swap.lastFetchedBlock),
			withdrawal.fetch(moduleStates.withdrawal.lastFetchedBlock)
		])

	logger.success("✅ All modules fetched successfully")
	logger.info("📊 Fetch results summary:", {
		deposit: `${depositResult.data.length} events (block ${depositResult.lastFetchedBlock})`,
		faucet: `${faucetResult.data.length} events (block ${faucetResult.lastFetchedBlock})`,
		liquidity: `${liquidityResult.data.length} events (block ${liquidityResult.lastFetchedBlock})`,
		swap: `${swapResult.data.length} events (block ${swapResult.lastFetchedBlock})`,
		withdrawal: `${withdrawalResult.data.length} events (block ${withdrawalResult.lastFetchedBlock})`
	})

	// Update module states with new last fetched blocks
	const updatedModuleStates = {
		deposit: { lastFetchedBlock: depositResult.lastFetchedBlock + 1 },
		faucet: { lastFetchedBlock: faucetResult.lastFetchedBlock + 1 },
		liquidity: { lastFetchedBlock: liquidityResult.lastFetchedBlock + 1 },
		swap: { lastFetchedBlock: swapResult.lastFetchedBlock + 1 },
		withdrawal: { lastFetchedBlock: withdrawalResult.lastFetchedBlock + 1 }
	}

	logger.info("Updated module states:", updatedModuleStates)
	logger.info("📋 Converting events to actions...")

	const actionsToInsert: ActionToInsert[] = []

	for (const item of depositResult.data) {
		if (!item.recipient || !item.amount) continue
		actionsToInsert.push({
			wallet: item.recipient,
			actionType: ACTION_TYPE_MAP.deposit,
			timestamp: item.timestamp,
			transactionHash: item.transactionHash
		})
	}

	for (const item of faucetResult.data) {
		if (!item.claimer || !item.amount) continue
		actionsToInsert.push({
			wallet: item.claimer,
			actionType: ACTION_TYPE_MAP.faucet,
			transactionHash: item.transactionHash,
			timestamp: item.timestamp
		})
	}

	for (const item of liquidityResult.data) {
		if (!item.sender || !item.amountIn) continue
		actionsToInsert.push({
			wallet: item.sender,
			actionType: ACTION_TYPE_MAP.liquidity,
			transactionHash: item.transactionHash,
			timestamp: item.timestamp
		})
	}

	for (const item of swapResult.data) {
		if (!item.sender || !item.amountToken0In) continue
		actionsToInsert.push({
			wallet: item.sender,
			actionType: ACTION_TYPE_MAP.swap,
			transactionHash: item.transactionHash,
			timestamp: item.timestamp
		})
	}

	for (const item of withdrawalResult.data) {
		if (!item.recipient || !item.amount) continue
		actionsToInsert.push({
			wallet: item.recipient,
			actionType: ACTION_TYPE_MAP.withdrawal,
			transactionHash: item.transactionHash,
			timestamp: item.timestamp
		})
	}

	logger.success(`✅ Converted to ${actionsToInsert.length} total actions`)
	return { actionsToInsert, updatedModuleStates }
}

/**
 * Main indexing loop logic with error handling and retries
 * Fetches data from all points modules and inserts into database
 */
async function runIndexingLoop(db: PostgresJsDatabase, state: IndexerState): Promise<void> {
	if (!state.isRunning) {
		return
	}

	logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	logger.info("🔄 Starting indexing loop iteration")
	logger.info("📍 Current module states:", state.moduleStates)

	try {
		// Fetch all available actions recursively until no more events are found
		const { actionsToInsert, updatedModuleStates } = await fetchAllActions(state.moduleStates)

		logger.info("🏁 Fetch complete for all modules")
		logger.info(`💾 Ready to process ${actionsToInsert.length} actions`)

		// Batch insert actions and update leaderboard
		if (actionsToInsert.length > 0) {
			logger.info("🔨 Inserting actions and updating leaderboard...")
			await batchInsertActionsAndUpdateLeaderboard({
				db,
				actionsToInsert,
				config: scoreConfig,
				updateMode: "inserted" // Only update wallets with new actions
			})
			logger.success("✅ Database updated successfully")

			logger.info("📢 Triggering distributor broadcast...")
			await triggerDistributorBroadcast()
		} else {
			logger.info("⏭️  No new actions to process")
		}

		// ONLY update moduleStates on successful completion
		state.moduleStates = updatedModuleStates
		state.lastRunTimestamp = Date.now()
		state.consecutiveErrors = 0 // Reset error counter on success

		logger.success("✨ Indexing loop completed successfully")
		logger.info("⏭️  Next iteration will start from updated module states")
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
			moduleStates: {
				deposit: { lastFetchedBlock: 1 },
				faucet: { lastFetchedBlock: 1 },
				liquidity: { lastFetchedBlock: 1 },
				swap: { lastFetchedBlock: 1 },
				withdrawal: { lastFetchedBlock: 1 }
			},
			consecutiveErrors: 0,
			config: {
				intervalSeconds: 2,
				maxRetries: 5
			}
		}
	}

	/**
	 * Start the indexing loop
	 */
	start(input?: { startingBlock?: number; intervalSeconds?: number; maxRetries?: number }) {
		try {
			if (this.#state.isRunning) {
				return { success: false, message: "Indexer is already running" } as const
			}

			// Update config if provided
			if (input) {
				if (input.startingBlock !== undefined) {
					//TODO: There is a bug with the block 0 https://linear.app/zeko-labs/issue/EXT-17/archive-node-queries-block-0-is-not-functioning-properly
					const sb = input.startingBlock === 0 ? 1 : input.startingBlock
					// Update all module states to start from this block
					this.#state.moduleStates = {
						deposit: { lastFetchedBlock: sb },
						faucet: { lastFetchedBlock: sb },
						liquidity: { lastFetchedBlock: sb },
						swap: { lastFetchedBlock: sb },
						withdrawal: { lastFetchedBlock: sb }
					}
				}
				if (input.intervalSeconds !== undefined) {
					this.#state.config.intervalSeconds = input.intervalSeconds
				}
				if (input.maxRetries !== undefined) {
					this.#state.config.maxRetries = input.maxRetries
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
			moduleStates: this.#state.moduleStates
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
			moduleStates: this.#state.moduleStates,
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
	async rebuild(initialBlock = 1) {
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
			await this.#db.delete(leaderboardTable)
			await this.#db.delete(actionsTable)

			// Step 3: Reset all module states to initial block
			const initialModuleStates = {
				deposit: { lastFetchedBlock: initialBlock },
				faucet: { lastFetchedBlock: initialBlock },
				liquidity: { lastFetchedBlock: initialBlock },
				swap: { lastFetchedBlock: initialBlock },
				withdrawal: { lastFetchedBlock: initialBlock }
			}

			// Step 4: Fetch all actions from blockchain starting from initialBlock
			logger.info(`[Rebuild] Fetching all actions from block ${initialBlock}...`)
			const { actionsToInsert, updatedModuleStates } = await fetchAllActions(initialModuleStates)

			logger.info("[Rebuild] Fetched all events from blockchain")

			// Step 5: Insert all actions and build leaderboard
			if (actionsToInsert.length > 0) {
				logger.info(`[Rebuild] Inserting ${actionsToInsert.length} actions...`)
				await batchInsertActionsAndUpdateLeaderboard({
					db: this.#db,
					actionsToInsert,
					config: scoreConfig,
					updateMode: "all" // Rebuild should update all wallets
				})
			}

			this.#state.moduleStates = updatedModuleStates

			logger.success("[Rebuild] Rebuild completed successfully")

			// Step 6: Restart the indexing loop if it was running before
			if (wasRunning) {
				logger.info("[Rebuild] Restarting indexing loop...")
				this.start(previousConfig)
			}

			return {
				success: true,
				message: "Rebuild completed successfully",
				restarted: wasRunning,
				actionsProcessed: actionsToInsert.length,
				moduleStates: updatedModuleStates
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
