import { setTimeout as sleep } from "node:timers/promises"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { clearAllTables } from "./db"
import { logger } from "./helper"
import { handler as innerHandler, rebuild as innerRebuild } from "./modules/inner"
import { handler as outerHandler, rebuild as outerRebuild } from "./modules/outer"

interface IndexerConfig {
	intervalSeconds: number
}

interface IndexerState {
	isRunning: boolean
	lastRunTimestamp: number | null
	lastFetchedBlock: { outer: number | null; inner: number | null }
	config: IndexerConfig
	consecutiveErrors: number
}

const waitForDelay = async (seconds: number, signal: AbortSignal): Promise<void> => {
	try {
		await sleep(seconds * 1000, undefined, { signal })
	} catch (error) {
		if (!(error instanceof Error) || error.name !== "AbortError") {
			throw error
		}
	}
}

export async function runIndexingLoop(
	db: PostgresJsDatabase,
	state: IndexerState,
	signal: AbortSignal
): Promise<void> {
	const baseDelay = Math.max(1, state.config.intervalSeconds)

	while (state.isRunning) {
		try {
			const [outerResult, innerResult] = await Promise.all([outerHandler(db), innerHandler(db)])

			state.lastRunTimestamp = Date.now()
			state.lastFetchedBlock.outer = outerResult.lastFetchedBlock ?? state.lastFetchedBlock.outer
			state.lastFetchedBlock.inner = innerResult.lastFetchedBlock ?? state.lastFetchedBlock.inner
			state.consecutiveErrors = 0
			logger.info(
				`runIndexingLoop: finished run (outer=${state.lastFetchedBlock.outer ?? 0}, inner=${state.lastFetchedBlock.inner ?? 0})`
			)
		} catch (error) {
			if (!state.isRunning || signal.aborted) break

			state.consecutiveErrors += 1
			const retryDelay = Math.min(45, baseDelay * state.consecutiveErrors + 1)
			const missingParents = (error as { missingParents?: string[] }).missingParents

			logger.error("runIndexingLoop error:", error)
			logger.warn(
				"[runIndexingLoop] ordering failed; missing parents:",
				missingParents
					? `${missingParents.length} (sample: ${missingParents.slice(0, 5).join(", ")})`
					: String(error)
			)
			logger.info(`Linear backoff: retrying in ${retryDelay}s`)
			await waitForDelay(retryDelay, signal)
			continue
		}

		if (!state.isRunning || signal.aborted) break
		await waitForDelay(state.config.intervalSeconds, signal)
	}
}

export class Indexer {
	#db: PostgresJsDatabase
	#state: IndexerState
	#loopPromise: Promise<void> | null = null
	#loopAbortController: AbortController | null = null

	constructor(db: PostgresJsDatabase, opts?: { autostart?: boolean }) {
		this.#db = db
		this.#state = {
			isRunning: false,
			lastRunTimestamp: null,
			lastFetchedBlock: { outer: null, inner: null },
			consecutiveErrors: 0,
			config: { intervalSeconds: 15 }
		}

		if (opts?.autostart !== false) {
			this.start()
		}
	}

	start(input?: { intervalSeconds?: number }) {
		if (this.#state.isRunning) {
			return {
				success: false,
				message: "Indexer already running",
				status: this.getStatus()
			}
		}

		if (input?.intervalSeconds) {
			this.#state.config.intervalSeconds = input.intervalSeconds
		}

		this.#state.isRunning = true
		this.#state.consecutiveErrors = 0

		const abortController = new AbortController()
		this.#loopAbortController = abortController
		this.#loopPromise = runIndexingLoop(this.#db, this.#state, abortController.signal)
			.catch((error: unknown) => {
				if (error instanceof Error && error.name === "AbortError") return
				logger.error("Fatal error in indexing loop:", error)
				this.#state.isRunning = false
			})
			.finally(() => {
				this.#loopPromise = null
				this.#loopAbortController = null
			})

		return { success: true, message: "Indexer started", status: this.getStatus() }
	}

	setConfig(input: { intervalSeconds?: number }) {
		if (input.intervalSeconds) {
			this.#state.config.intervalSeconds = input.intervalSeconds
		}

		return {
			success: true,
			message: "Config updated",
			config: this.#state.config,
			status: this.getStatus()
		}
	}

	async stop() {
		if (!this.#state.isRunning) {
			return {
				success: false,
				message: "Indexer is not running",
				status: this.getStatus()
			}
		}

		this.#state.isRunning = false
		this.#loopAbortController?.abort()

		if (this.#loopPromise) {
			await this.#loopPromise
		}

		return { success: true, message: "Indexer stopped", status: this.getStatus() }
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
			await this.stop()
		}

		try {
			const [outerResult, innerResult] = await Promise.all([
				outerRebuild(this.#db),
				innerRebuild(this.#db)
			])

			this.#state.lastFetchedBlock = {
				outer: outerResult.lastFetchedBlock ?? null,
				inner: innerResult.lastFetchedBlock ?? null
			}

			if (wasRunning) {
				this.start(previousConfig)
			}

			return {
				success: true,
				message: "Indexer rebuilt from archive data",
				actionsProcessed: outerResult.data.length + innerResult.data.length,
				status: this.getStatus()
			}
		} catch (error) {
			logger.error("Error during rebuild:", error)
			return { success: false, message: error instanceof Error ? error.message : String(error) }
		}
	}

	async reset() {
		const previousConfig = { ...this.#state.config }

		if (this.#state.isRunning) {
			await this.stop()
		}

		try {
			await this.#db.transaction(async (tx) => {
				await clearAllTables(tx)
			})

			this.#state.lastRunTimestamp = null
			this.#state.lastFetchedBlock = { outer: null, inner: null }
			this.#state.consecutiveErrors = 0

			const startResult = this.start(previousConfig)
			if (!startResult.success) {
				return {
					success: false,
					message: `Reset cleared indexed tables but failed to restart: ${startResult.message}`
				}
			}

			return {
				success: true,
				message: "Indexer reset: cleared indexed tables and restarted from scratch",
				status: this.getStatus()
			}
		} catch (error) {
			logger.error("Error during reset:", error)
			return { success: false, message: error instanceof Error ? error.message : String(error) }
		}
	}
}
