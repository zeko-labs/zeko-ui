import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ActionsInsert, CommitInsert, WitnessInsert } from "./db"
import {
	batchInsertActions,
	batchInsertCommitActions,
	batchInsertWitnessActions,
	clearAllTables
} from "./db"
import { logger, wait } from "./helper"
import { handler as depositHandler } from "./modules/deposit.handler"
import { handler as withdrawalHandler } from "./modules/withdrawal.handler"

interface IndexerConfig {
	intervalSeconds: number
}

// Run loop is implemented as a top-level `runIndexingLoop(db, state)` below.

interface IndexerState {
	isRunning: boolean
	lastRunTimestamp: number | null
	lastFetchedBlock: { deposit: number | null; withdrawal: number | null }
	config: IndexerConfig
	consecutiveErrors: number
}

export class Indexer {
	#db: PostgresJsDatabase
	#state: IndexerState

	constructor(db: PostgresJsDatabase, opts?: { autostart?: boolean }) {
		this.#db = db
		this.#state = {
			isRunning: false,
			lastRunTimestamp: null,
			lastFetchedBlock: { deposit: null, withdrawal: null },
			consecutiveErrors: 0,
			config: { intervalSeconds: 15 }
		}
		// Auto-start by default unless explicitly disabled
		if (opts?.autostart !== false) this.start()
	}

	// External run loop will modify the provided state directly. Expose a state ref.
	public getStateRef(): IndexerState {
		return this.#state
	}

	async fetchAndInsert(): Promise<{
		inserted: number
		depositLastFetched?: number
		withdrawalLastFetched?: number
	}> {
		logger.info("Starting fetch for new actions from L1 archive")
		const depositResult = await depositHandler.fetch({
			startBlock: this.#state.lastFetchedBlock.deposit ?? 0
		})
		const withdrawalResult = await withdrawalHandler.fetch({
			startBlock: this.#state.lastFetchedBlock.withdrawal ?? 0
		})

		// Convert archive events into typed DB insert shapes (defined below)
		const depositItems = depositResult.data
		// withdrawalItems remains unused (withdrawal module is stub), collected for future logic

		// Convert to DB rows and insert in batch within a transaction

		const actionsToInsert: ActionsInsert[] = []
		const commitToInsert: CommitInsert[] = []
		const witnessToInsert: WitnessInsert[] = []

		for (const item of depositItems) {
			actionsToInsert.push({
				afterState: item.afterState,
				kind: item.kind,
				beforeState: item.beforeState ?? null,
				length: item.length,
				blockHeight: item.blockHeight,
				slotRangeLower: item.kind === "commit" ? item.slotRangeLower ?? 0 : 0,
				slotRangeUpper: item.kind === "commit" ? item.slotRangeUpper ?? 0 : 0
			})
			if (item.kind === "commit") {
				commitToInsert.push({
					afterState: item.afterState,
					ledger: item.ledger,
					innerActionState: item.innerActionState,
					innerActionStateLength: item.innerActionStateLength,
					synchronizedOuterActionState: item.synchronizedOuterActionState,
					synchronizedOuterActionStateLength: item.synchronizedOuterActionStateLength
				})
			} else {
				witnessToInsert.push({ afterState: item.afterState, aux: item.aux })
			}
		}

		//TODO: Withdrawal handler is a stub for now; parse similarly in future
		// for (const item of withdrawalItems) {
		// 	actionsToInsert.push({
		// 		afterState: item.afterState,
		// 		kind: item.kind,
		// 		beforeState: item.beforeState ?? null,
		// 		length: item.length,
		// 		blockHeight: item.blockHeight,
		// 		slotRangeLower: item.kind === "commit" ? item.slotRangeLower ?? 0 : 0,
		// 		slotRangeUpper: item.kind === "commit" ? item.slotRangeUpper ?? 0 : 0
		// 	})
		// 	if (item.kind === "commit") {
		// 		commitToInsert.push({
		// 			afterState: item.afterState,
		// 			ledger: item.ledger,
		// 			innerActionState: item.innerActionState,
		// 			innerActionStateLength: item.innerActionStateLength,
		// 			synchronizedOuterActionState: item.synchronizedOuterActionState,
		// 			synchronizedOuterActionStateLength: item.synchronizedOuterActionStateLength
		// 		})
		// 	} else {
		// 		witnessToInsert.push({ afterState: item.afterState, aux: item.aux })
		// 	}
		// }

		if (
			actionsToInsert.length === 0 &&
			commitToInsert.length === 0 &&
			witnessToInsert.length === 0
		) {
			return { inserted: 0 }
		}

		await this.#db.transaction(async (tx) => {
			if (actionsToInsert.length) await batchInsertActions(tx, actionsToInsert)
			if (commitToInsert.length) await batchInsertCommitActions(tx, commitToInsert)
			if (witnessToInsert.length) await batchInsertWitnessActions(tx, witnessToInsert)
		})

		const inserted = actionsToInsert.length
		const depositLastFetched =
			depositResult.lastFetchedBlock ?? this.#state.lastFetchedBlock.deposit ?? 0
		const withdrawalLastFetched =
			withdrawalResult.lastFetchedBlock ?? this.#state.lastFetchedBlock.withdrawal ?? 0
		if (!inserted) {
			logger.info("No new actions returned from archive")
			return { inserted: 0 }
		}
		logger.info(`Fetched/Inserted ${inserted} actions`)
		return { inserted, depositLastFetched, withdrawalLastFetched }
	}

	// Run loop is implemented as a top-level exported function `runIndexingLoop(indexer)` below.

	start(input?: { intervalSeconds?: number }) {
		if (this.#state.isRunning) return { success: false, message: "Indexer already running" }
		if (input?.intervalSeconds) this.#state.config.intervalSeconds = input.intervalSeconds
		// Always start from 0; per-module cursor reset
		this.#state.lastFetchedBlock.deposit = 0
		this.#state.lastFetchedBlock.withdrawal = 0

		this.#state.isRunning = true
		this.#state.consecutiveErrors = 0
		runIndexingLoop(this.#db, this.#state).catch((error: unknown) => {
			logger.error("Fatal error in indexing loop:", error)
			this.#state.isRunning = false
		})
		return { success: true, message: "Indexer started" }
	}

	setConfig(input: { intervalSeconds?: number }) {
		if (input?.intervalSeconds) this.#state.config.intervalSeconds = input.intervalSeconds
		return { success: true, message: "Config updated", config: this.#state.config }
	}

	stop() {
		if (!this.#state.isRunning) return { success: false, message: "Indexer is not running" }
		this.#state.isRunning = false
		return { success: true, message: "Indexer stopped" }
	}

	getStatus() {
		return {
			isRunning: this.#state.isRunning,
			lastRunTimestamp: this.#state.lastRunTimestamp,
			lastFetchedBlock: this.#state.lastFetchedBlock,
			config: this.#state.config,
			consecutiveErrors: this.#state.consecutiveErrors
		}
	}

	async rebuild() {
		const wasRunning = this.#state.isRunning
		const previousConfig = { ...this.#state.config }
		if (this.#state.isRunning) {
			this.stop()
		}
		try {
			// Clear existing tables and re-fetch all actions from scratch
			// rebuild in a single transaction (clear and insert) so rollback works on error
			const startBlock = 0
			const depositResult = await depositHandler.fetch({ startBlock })
			const withdrawalResult = await withdrawalHandler.fetch({ startBlock })

			const actionsToInsert: ActionsInsert[] = []
			const commitToInsert: CommitInsert[] = []
			const witnessToInsert: WitnessInsert[] = []

			for (const item of depositResult.data) {
				actionsToInsert.push({
					afterState: item.afterState,
					kind: item.kind,
					beforeState: item.beforeState ?? null,
					length: item.length,
					blockHeight: item.blockHeight,
					slotRangeLower: item.kind === "commit" ? item.slotRangeLower ?? 0 : 0,
					slotRangeUpper: item.kind === "commit" ? item.slotRangeUpper ?? 0 : 0
				})
				if (item.kind === "commit") {
					commitToInsert.push({
						afterState: item.afterState,
						ledger: item.ledger,
						innerActionState: item.innerActionState,
						innerActionStateLength: item.innerActionStateLength,
						synchronizedOuterActionState: item.synchronizedOuterActionState,
						synchronizedOuterActionStateLength: item.synchronizedOuterActionStateLength
					})
				} else {
					witnessToInsert.push({ afterState: item.afterState, aux: item.aux })
				}
			}
			//TODO: implement withdrawal rebuild logic
			// for (const item of withdrawalResult.data) {
			// 	actionsToInsert.push({
			// 		afterState: item.afterState,
			// 		kind: item.kind,
			// 		beforeState: item.beforeState ?? null,
			// 		length: item.length,
			// 		blockHeight: item.blockHeight,
			// 		slotRangeLower: item.kind === "commit" ? item.slotRangeLower ?? 0 : 0,
			// 		slotRangeUpper: item.kind === "commit" ? item.slotRangeUpper ?? 0 : 0
			// 	})
			// 	if (item.kind === "commit") {
			// 		commitToInsert.push({
			// 			afterState: item.afterState,
			// 			ledger: item.ledger,
			// 			innerActionState: item.innerActionState,
			// 			innerActionStateLength: item.innerActionStateLength,
			// 			synchronizedOuterActionState: item.synchronizedOuterActionState,
			// 			synchronizedOuterActionStateLength: item.synchronizedOuterActionStateLength
			// 		})
			// 	} else {
			// 		witnessToInsert.push({ afterState: item.afterState, aux: item.aux })
			// 	}
			// }

			await this.#db.transaction(async (tx) => {
				await clearAllTables(tx)
				if (actionsToInsert.length) await batchInsertActions(tx, actionsToInsert)
				if (commitToInsert.length) await batchInsertCommitActions(tx, commitToInsert)
				if (witnessToInsert.length) await batchInsertWitnessActions(tx, witnessToInsert)
			})

			this.#state.lastFetchedBlock.deposit = depositResult.lastFetchedBlock ?? null
			this.#state.lastFetchedBlock.withdrawal = withdrawalResult.lastFetchedBlock ?? null
			if (wasRunning) {
				this.start(previousConfig)
			}
			const actionsProcessed = actionsToInsert.length
			return { success: true, actionsProcessed }
		} catch (error) {
			logger.error("Error during rebuild:", error)
			return { success: false, message: error instanceof Error ? error.message : String(error) }
		}
	}
}

// Top-level run loop that operates on DB + state. This makes it easy to test and ensures
// the loop only has access to the minimal state required.
export async function runIndexingLoop(db: PostgresJsDatabase, state: IndexerState): Promise<void> {
	const baseDelay = Math.max(1, state.config.intervalSeconds)
	while (state.isRunning) {
		try {
			const depositStart = state.lastFetchedBlock.deposit ?? 0
			const withdrawalStart = state.lastFetchedBlock.withdrawal ?? 0
			logger.info(
				`runIndexingLoop: fetching deposit from ${depositStart} and withdrawal from ${withdrawalStart}`
			)

			const depositResult = await depositHandler.fetch({ startBlock: depositStart })
			const withdrawalResult = await withdrawalHandler.fetch({ startBlock: withdrawalStart })

			const actionsToInsert: ActionsInsert[] = []
			const commitToInsert: CommitInsert[] = []
			const witnessToInsert: WitnessInsert[] = []

			for (const item of depositResult.data) {
				actionsToInsert.push({
					afterState: item.afterState,
					kind: item.kind,
					beforeState: item.beforeState ?? null,
					length: item.length,
					blockHeight: item.blockHeight,
					slotRangeLower: item.kind === "commit" ? item.slotRangeLower ?? 0 : 0,
					slotRangeUpper: item.kind === "commit" ? item.slotRangeUpper ?? 0 : 0
				})
				if (item.kind === "commit") {
					commitToInsert.push({
						afterState: item.afterState,
						ledger: item.ledger,
						innerActionState: item.innerActionState,
						innerActionStateLength: item.innerActionStateLength,
						synchronizedOuterActionState: item.synchronizedOuterActionState,
						synchronizedOuterActionStateLength: item.synchronizedOuterActionStateLength
					})
				} else {
					witnessToInsert.push({ afterState: item.afterState, aux: item.aux })
				}
			}

			// Deposit-only loop for now; withdrawal is stubbed.
			// If the withdrawal module becomes functional, process it here similar to deposit.

			if (actionsToInsert.length || commitToInsert.length || witnessToInsert.length) {
				await db.transaction(async (tx) => {
					if (actionsToInsert.length) await batchInsertActions(tx, actionsToInsert)
					if (commitToInsert.length) await batchInsertCommitActions(tx, commitToInsert)
					if (witnessToInsert.length) await batchInsertWitnessActions(tx, witnessToInsert)
				})
			}

			state.lastRunTimestamp = Date.now()
			state.lastFetchedBlock.deposit =
				depositResult.lastFetchedBlock ?? state.lastFetchedBlock.deposit
			state.lastFetchedBlock.withdrawal =
				withdrawalResult.lastFetchedBlock ?? state.lastFetchedBlock.withdrawal
			state.consecutiveErrors = 0
			logger.info(
				`runIndexingLoop: finished run (deposit=${state.lastFetchedBlock.deposit ?? 0}, withdrawal=${state.lastFetchedBlock.withdrawal ?? 0})`
			)
		} catch (err: unknown) {
			state.consecutiveErrors = (state.consecutiveErrors ?? 0) + 1
			const retryDelay = Math.min(60, baseDelay * state.consecutiveErrors)
			logger.error(`runIndexingLoop error: ${err instanceof Error ? err.message : String(err)}`)
			logger.info(`Linear backoff: retrying in ${retryDelay}s`)
			await wait(retryDelay)
			continue
		}

		if (!state.isRunning) break
		await wait(state.config.intervalSeconds)
	}
}
