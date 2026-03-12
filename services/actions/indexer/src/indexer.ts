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

interface HandlerResult {
	lastFetchedBlock: number | null
}

interface IndexingLoopDependencies {
	outer: (db: PostgresJsDatabase) => Promise<HandlerResult>
	inner: (db: PostgresJsDatabase) => Promise<HandlerResult>
	now: () => number
	wait: (seconds: number, signal: AbortSignal) => Promise<void>
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
	signal: AbortSignal,
	deps: Partial<IndexingLoopDependencies> = {}
): Promise<void> {
	const baseDelay = Math.max(1, state.config.intervalSeconds)
	const outer = deps.outer ?? outerHandler
	const inner = deps.inner ?? innerHandler
	const now = deps.now ?? Date.now
	const wait = deps.wait ?? waitForDelay

	while (state.isRunning) {
		const [outerResult, innerResult] = await Promise.allSettled([outer(db), inner(db)])
		const hasSuccess = outerResult.status === "fulfilled" || innerResult.status === "fulfilled"

		if (outerResult.status === "fulfilled") {
			state.lastFetchedBlock.outer =
				outerResult.value.lastFetchedBlock ?? state.lastFetchedBlock.outer
		}

		if (innerResult.status === "fulfilled") {
			state.lastFetchedBlock.inner =
				innerResult.value.lastFetchedBlock ?? state.lastFetchedBlock.inner
		}

		if (hasSuccess) {
			state.lastRunTimestamp = now()
			state.consecutiveErrors = 0
			logger.info(
				`runIndexingLoop: finished run (outer=${state.lastFetchedBlock.outer ?? 0}, inner=${state.lastFetchedBlock.inner ?? 0})`
			)
		}

		const failures = [
			{ stream: "outer", result: outerResult },
			{ stream: "inner", result: innerResult }
		].filter(
			(entry): entry is { stream: "outer" | "inner"; result: PromiseRejectedResult } =>
				entry.result.status === "rejected"
		)

		for (const failure of failures) {
			const error = failure.result.reason
			const missingParents = (error as { missingParents?: string[] }).missingParents
			const message = error instanceof Error ? error.message : String(error)

			logger.error(`runIndexingLoop ${failure.stream} error:`, error)
			if (missingParents) {
				logger.warn(
					`[runIndexingLoop] ${failure.stream} ordering failed; missing parents:`,
					`${missingParents.length} (sample: ${missingParents.slice(0, 5).join(", ")})`
				)
			} else {
				logger.warn(`[runIndexingLoop] ${failure.stream} iteration failed: ${message}`)
			}
		}

		if (failures.length === 2) {
			if (!state.isRunning || signal.aborted) break

			state.consecutiveErrors += 1
			const retryDelay = Math.min(45, baseDelay * state.consecutiveErrors + 1)
			logger.info(`Linear backoff: retrying in ${retryDelay}s`)
			await wait(retryDelay, signal)
			continue
		}

		if (!state.isRunning || signal.aborted) break
		await wait(state.config.intervalSeconds, signal)
	}
}

export class Indexer {
	#db: PostgresJsDatabase
	#state: IndexerState
	#loopPromise: Promise<void> | null = null
	#loopAbortController: AbortController | null = null
	#loopDeps: Partial<IndexingLoopDependencies>
	#resetInProgress = false

	constructor(
		db: PostgresJsDatabase,
		opts?: { autostart?: boolean; loopDeps?: Partial<IndexingLoopDependencies> }
	) {
		this.#db = db
		this.#loopDeps = opts?.loopDeps ?? {}
		this.#state = {
			isRunning: false,
			lastRunTimestamp: null,
			lastFetchedBlock: { outer: null, inner: null },
			consecutiveErrors: 0,
			config: { intervalSeconds: 15 }
		}

		if (opts?.autostart !== false) {
			this.#start({ intervalSeconds: this.#state.config.intervalSeconds })
		}
	}

	#start(input?: { intervalSeconds?: number }) {
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
		this.#loopPromise = runIndexingLoop(
			this.#db,
			this.#state,
			abortController.signal,
			this.#loopDeps
		)
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

	start(input?: { intervalSeconds?: number }) {
		if (this.#resetInProgress) {
			return {
				success: false,
				message: "A reset is already in progress",
				status: this.getStatus()
			}
		}

		return this.#start(input)
	}

	#setConfig(input: { intervalSeconds?: number }) {
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

	setConfig(input: { intervalSeconds?: number }) {
		return this.#setConfig(input)
	}

	async #stop() {
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

	async stop() {
		if (this.#resetInProgress) {
			return {
				success: false,
				message: "A reset is already in progress",
				status: this.getStatus()
			}
		}

		return this.#stop()
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

	async #rebuild() {
		const wasRunning = this.#state.isRunning
		const previousConfig = { ...this.#state.config }

		if (this.#state.isRunning) {
			await this.#stop()
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
				this.#start(previousConfig)
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

	async rebuild() {
		if (this.#resetInProgress) {
			return {
				success: false,
				message: "A reset is already in progress",
				status: this.getStatus()
			}
		}

		return this.#rebuild()
	}

	async #reset() {
		const previousConfig = { ...this.#state.config }

		if (this.#state.isRunning) {
			await this.#stop()
		}

		try {
			await this.#db.transaction(async (tx) => {
				await clearAllTables(tx)
			})

			this.#state.lastRunTimestamp = null
			this.#state.lastFetchedBlock = { outer: null, inner: null }
			this.#state.consecutiveErrors = 0

			const startResult = this.#start(previousConfig)
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

	async reset() {
		if (this.#resetInProgress) {
			return {
				success: false,
				message: "A reset is already in progress",
				status: this.getStatus()
			}
		}

		this.#resetInProgress = true

		try {
			return await this.#reset()
		} finally {
			this.#resetInProgress = false
		}
	}
}
