import { actions as actionsTable, leaderboard as leaderboardTable } from "@leaderboard/api"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
	type ActionToInsert,
	type ActionType,
	batchInsertActionsAndUpdateLeaderboard,
	batchInsertManualAdjustmentsAndUpdateLeaderboard,
	type ManualAdjustmentToInsert,
	recalculateLeaderboard,
	scoreConfig
} from "./db"
import {
	type ActionConfig,
	type ActionsConfig,
	broadcast,
	getMaxBlockHeight,
	logger,
	wait
} from "./helper"
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
	endBlock?: number
}

interface IndexerState {
	isRunning: boolean
	lastRunTimestamp: number | null
	moduleStates: Record<string, ModuleState>
	config: IndexerConfig
	consecutiveErrors: number
	lastMaxBlockHeight?: number
}

type ModuleName = keyof ActionsConfig

/**
 * Normalize block number (convert 0 to 1 due to archive bug)
 */
const normalizeBlock = (block: number): number => (block === 0 ? 1 : block)

/**
 * Create module state from action config
 */
const createModuleState = (config: ActionConfig): ModuleState => ({
	lastFetchedBlock: normalizeBlock(config.startBlock),
	endBlock: config.endBlock === Number.POSITIVE_INFINITY ? undefined : config.endBlock ?? undefined
})

/**
 * Create all module states from actions config with defaults
 */
const createModuleStates = (
	actions: Partial<ActionsConfig>,
	defaultStartBlock: number
): Record<ModuleName, ModuleState> => {
	const modules: ModuleName[] = ["deposit", "faucet", "liquidity", "swap", "withdrawal"]
	const result: Record<string, ModuleState> = {}

	for (const module of modules) {
		const actionConfig = actions[module] ?? {
			startBlock: defaultStartBlock,
			endBlock: Number.POSITIVE_INFINITY
		}
		result[module] = createModuleState(actionConfig)
	}

	return result as Record<ModuleName, ModuleState>
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
	maxBlockHeight: number
}> {
	logger.box(`📡 Fetching all actions from their respective module states`)
	logger.info("Module states:", moduleStates)
	logger.info("Initiating parallel fetch across all point modules...")

	const [
		depositResult,
		faucetResult,
		liquidityResult,
		swapResult,
		withdrawalResult,
		maxBlockHeight
	] = await Promise.all([
		deposit.fetch({
			startBlock: moduleStates.deposit.lastFetchedBlock,
			endBlock: moduleStates.deposit.endBlock ?? Number.POSITIVE_INFINITY
		}),
		faucet.fetch({
			startBlock: moduleStates.faucet.lastFetchedBlock,
			endBlock: moduleStates.faucet.endBlock ?? Number.POSITIVE_INFINITY
		}),
		liquidity.fetch({
			startBlock: moduleStates.liquidity.lastFetchedBlock,
			endBlock: moduleStates.liquidity.endBlock ?? Number.POSITIVE_INFINITY
		}),
		swap.fetch({
			startBlock: moduleStates.swap.lastFetchedBlock,
			endBlock: moduleStates.swap.endBlock ?? Number.POSITIVE_INFINITY
		}),
		withdrawal.fetch({
			startBlock: moduleStates.withdrawal.lastFetchedBlock,
			endBlock: moduleStates.withdrawal.endBlock ?? Number.POSITIVE_INFINITY
		}),
		getMaxBlockHeight("L2")
	])

	logger.success("✅ All modules fetched successfully")
	logger.info("📊 Fetch results summary:", {
		deposit: `${depositResult.data.length} events (block ${depositResult.lastFetchedBlock})`,
		faucet: `${faucetResult.data.length} events (block ${faucetResult.lastFetchedBlock})`,
		liquidity: `${liquidityResult.data.length} events (block ${liquidityResult.lastFetchedBlock})`,
		swap: `${swapResult.data.length} events (block ${swapResult.lastFetchedBlock})`,
		withdrawal: `${withdrawalResult.data.length} events (block ${withdrawalResult.lastFetchedBlock})`
	})

	logger.info(`📏 Max L2 block height: ${maxBlockHeight}`)

	// Update module states with new last fetched blocks, preserving endBlock
	const updatedModuleStates = {
		deposit: {
			lastFetchedBlock: depositResult.lastFetchedBlock + 1,
			endBlock: moduleStates.deposit.endBlock
		},
		faucet: {
			lastFetchedBlock: faucetResult.lastFetchedBlock + 1,
			endBlock: moduleStates.faucet.endBlock
		},
		liquidity: {
			lastFetchedBlock: liquidityResult.lastFetchedBlock + 1,
			endBlock: moduleStates.liquidity.endBlock
		},
		swap: {
			lastFetchedBlock: swapResult.lastFetchedBlock + 1,
			endBlock: moduleStates.swap.endBlock
		},
		withdrawal: {
			lastFetchedBlock: withdrawalResult.lastFetchedBlock + 1,
			endBlock: moduleStates.withdrawal.endBlock
		}
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
		if (!item.sender) continue
		actionsToInsert.push({
			wallet: item.sender,
			actionType: ACTION_TYPE_MAP.liquidity,
			transactionHash: item.transactionHash,
			timestamp: item.timestamp
		})
	}

	for (const item of swapResult.data) {
		if (!item.sender) continue
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
	return { actionsToInsert, updatedModuleStates, maxBlockHeight }
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
		const { actionsToInsert, updatedModuleStates, maxBlockHeight } = await fetchAllActions(
			state.moduleStates
		)

		logger.info("🏁 Fetch complete for all modules")
		logger.info(`💾 Ready to process ${actionsToInsert.length} actions`)

		// Batch insert actions and update leaderboard
		const writeNewEntries = async () => {
			if (actionsToInsert.length === 0) {
				logger.info("⏭️  No new actions to process")
				return false
			}

			logger.info("🔨 Inserting actions and updating leaderboard...")
			const result = await batchInsertActionsAndUpdateLeaderboard({
				db,
				actionsToInsert,
				config: scoreConfig,
				updateMode: "inserted" // Only update wallets with new actions
			})
			logger.success("✅ Database updated successfully")
			return result
		}

		const hasNewEntries = await writeNewEntries()

		// Only broadcast when maxBlockHeight changes (store previous value in state)
		const previousMaxBlockHeight = state.lastMaxBlockHeight ?? 0
		if (maxBlockHeight !== previousMaxBlockHeight) {
			logger.info("📢 Broadcasting to all connected clients...")
			broadcast({ maxBlockHeight, hasNewEntries })
			state.lastMaxBlockHeight = maxBlockHeight
		} else {
			logger.info("⏭️  No broadcast needed (maxBlockHeight unchanged)")
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
			config: { intervalSeconds: 5, maxRetries: 10 },
			lastMaxBlockHeight: undefined
		}
	}

	/**
	 * Start the indexing loop
	 */
	start(input?: {
		startingBlock?: number
		intervalSeconds?: number
		maxRetries?: number
		actions?: Partial<ActionsConfig>
	}) {
		try {
			if (this.#state.isRunning) {
				return { success: false, message: "Indexer is already running" } as const
			}

			// Update config if provided
			if (input) {
				if (input.startingBlock !== undefined || input.actions !== undefined) {
					const defaultStartBlock = input.startingBlock ?? 0
					this.#state.moduleStates = createModuleStates(input.actions ?? {}, defaultStartBlock)
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
	async rebuild(initialBlock = 0, actions?: Partial<ActionsConfig>) {
		// Remember if we were running before
		const wasRunning = this.#state.isRunning
		const previousConfig = { ...this.#state.config }

		// Step 1: Stop the loop if running
		if (this.#state.isRunning) {
			logger.info("[Rebuild] Stopping indexer...")
			this.stop()
		}

		try {
			// Step 1: Reset all module states to initial block with action-specific configs
			const initialModuleStates = createModuleStates(actions ?? {}, initialBlock)

			// Step 2: Fetch all actions from blockchain starting from initialBlock
			logger.info(`[Rebuild] Fetching all actions from configured blocks...`)
			const { actionsToInsert, updatedModuleStates, maxBlockHeight } =
				await fetchAllActions(initialModuleStates)
			logger.info(`[Rebuild] Fetched all events from blockchain (max block: ${maxBlockHeight})`)

			if (actionsToInsert.length === 0)
				throw new Error("No actions fetched from blockchain for rebuild")

			await this.#db.transaction(async (tx) => {
				// Step 3: Clear both tables
				logger.info("[Rebuild] Clearing actions and leaderboard tables...")

				await tx.delete(leaderboardTable)
				await tx.delete(actionsTable)

				// Step 4: Insert all actions and build leaderboard

				logger.info(`[Rebuild] Inserting ${actionsToInsert.length} actions...`)
				await batchInsertActionsAndUpdateLeaderboard({
					db: tx,
					actionsToInsert,
					config: scoreConfig,
					updateMode: "all" // Rebuild should update all wallets
				})
			})

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

	async adjust(adjustments: ManualAdjustmentToInsert[]) {
		try {
			await this.#db.transaction(async (tx) => {
				await batchInsertManualAdjustmentsAndUpdateLeaderboard({
					db: tx,
					adjustments
				})
			})

			return { success: true, message: "Manual adjustments applied successfully" } as const
		} catch (error) {
			logger.error("[Adjust] Error applying manual adjustments:", error)
			return {
				success: false,
				message: `Manual adjustments failed: ${(error as Error).message}`
			} as const
		}
	}
}
