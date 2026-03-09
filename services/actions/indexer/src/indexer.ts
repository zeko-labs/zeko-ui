import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { logger, wait } from "./helper"
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

export async function runIndexingLoop(db: PostgresJsDatabase, state: IndexerState): Promise<void> {
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
		} catch (err: unknown) {
			state.consecutiveErrors += 1
			const retryDelay = Math.min(45, baseDelay * (state.consecutiveErrors ?? 0) + 1)
			const missingParents: string[] | undefined = (err as unknown as { missingParents?: string[] })
				?.missingParents
			logger.error("runIndexingLoop error:", err)
			logger.warn(
				"[runIndexingLoop] ordering failed; missing parents:",
				missingParents
					? `${missingParents.length} (sample: ${missingParents.slice(0, 5).join(", ")})`
					: String(err)
			)
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
			lastFetchedBlock: { outer: null, inner: null },
			consecutiveErrors: 0,
			config: { intervalSeconds: 15 }
		}
		if (opts?.autostart !== false) this.start()
	}

	start(input?: { intervalSeconds?: number }) {
		if (this.#state.isRunning) return { success: false, message: "Indexer already running" }
		if (input?.intervalSeconds) this.#state.config.intervalSeconds = input.intervalSeconds
		this.#state.lastFetchedBlock.outer = 0
		this.#state.lastFetchedBlock.inner = 0

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
			const [outerResult, innerResult] = await Promise.all([
				outerRebuild(this.#db),
				innerRebuild(this.#db)
			])

			this.#state.lastFetchedBlock.outer = outerResult.lastFetchedBlock ?? null
			this.#state.lastFetchedBlock.inner = innerResult.lastFetchedBlock ?? null
			if (wasRunning) {
				this.start(previousConfig)
			}
			const actionsProcessed = outerResult.data.length + innerResult.data.length
			return { success: true, actionsProcessed }
		} catch (error) {
			logger.error("Error during rebuild:", error)
			return { success: false, message: error instanceof Error ? error.message : String(error) }
		}
	}
}
