import { actions, commitActions, witnessActions } from "@zeko/actions-api"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ActionsInsert, CommitInsert, WitnessInsert } from "./db"
import { batchInsert, clearAllTables } from "./db"
import { logger, wait } from "./helper"
import { handler as depositHandler } from "./modules/deposit.handler"
import { handler as withdrawalHandler } from "./modules/withdrawal.handler"

interface IndexerConfig {
	intervalSeconds: number
}

interface IndexerState {
	isRunning: boolean
	lastRunTimestamp: number | null
	lastFetchedBlock: { deposit: number | null; withdrawal: number | null }
	config: IndexerConfig
	consecutiveErrors: number
}

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

			const { actionsToInsert, commitToInsert, witnessToInsert } = buildDeposits(depositResult.data)
			//TODO: handle withdrawalResult when withdrawal module is functional

			if (actionsToInsert.length || commitToInsert.length || witnessToInsert.length) {
				await insertDeposits({ db, actionsToInsert, commitToInsert, witnessToInsert })
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
			const retryDelay = Math.min(45, baseDelay * state.consecutiveErrors)
			logger.error(`runIndexingLoop error: ${err instanceof Error ? err.message : String(err)}`)
			logger.info(`Linear backoff: retrying in ${retryDelay}s`)
			await wait(retryDelay)
			continue
		}

		await wait(state.config.intervalSeconds)
	}
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
		if (opts?.autostart !== false) this.start()
	}

	start(input?: { intervalSeconds?: number }) {
		if (this.#state.isRunning) return { success: false, message: "Indexer already running" }
		if (input?.intervalSeconds) this.#state.config.intervalSeconds = input.intervalSeconds
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

			const { actionsToInsert, commitToInsert, witnessToInsert } = buildDeposits(depositResult.data)
			//TODO: handle withdrawalResult when withdrawal module is functional

			if (
				actionsToInsert.length === 0 &&
				commitToInsert.length === 0 &&
				witnessToInsert.length === 0
			) {
				throw new Error("No actions to insert during rebuild")
			}

			await this.#db.transaction(async (tx) => {
				await clearAllTables(tx)
				await insertDeposits({ db: tx, actionsToInsert, commitToInsert, witnessToInsert })
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

type DepositItem = Awaited<ReturnType<typeof depositHandler.fetch>>["data"][number]

function buildDeposits(items: DepositItem[]) {
	const actionsToInsert: ActionsInsert[] = []
	const commitToInsert: CommitInsert[] = []
	const witnessToInsert: WitnessInsert[] = []

	for (const item of items) {
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

	return { actionsToInsert, commitToInsert, witnessToInsert }
}

async function insertDeposits({
	db,
	actionsToInsert,
	commitToInsert,
	witnessToInsert
}: {
	db: PostgresJsDatabase
	actionsToInsert: ActionsInsert[]
	commitToInsert: CommitInsert[]
	witnessToInsert: WitnessInsert[]
}) {
	if (actionsToInsert.length) await batchInsert({ db, table: actions, values: actionsToInsert })
	if (commitToInsert.length) await batchInsert({ db, table: commitActions, values: commitToInsert })
	if (witnessToInsert.length)
		await batchInsert({ db, table: witnessActions, values: witnessToInsert })
}
