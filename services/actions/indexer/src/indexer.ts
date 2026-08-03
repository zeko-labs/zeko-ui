import { setTimeout as sleep } from "node:timers/promises"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { clearAllTables } from "./db"
import { env } from "./env"
import { logger } from "./helper"
import { handler as innerHandler, rebuild as innerRebuild } from "./modules/inner"
import { handler as outerHandler, rebuild as outerRebuild } from "./modules/outer"
import { handler as registryHandler, rebuild as registryRebuild } from "./modules/registry"

interface IndexerConfig {
	intervalSeconds: number
}

interface IndexerState {
	isRunning: boolean
	lastRunTimestamp: number | null
	lastFetchedBlock: { outer: number | null; inner: number | null; registry: number | null }
	config: IndexerConfig
	consecutiveErrors: number
}

interface HandlerResult {
	lastFetchedBlock: number | null
}

interface IndexingLoopDependencies {
	outer: (db: PostgresJsDatabase) => Promise<HandlerResult>
	inner: (db: PostgresJsDatabase) => Promise<HandlerResult>
	registry: (db: PostgresJsDatabase) => Promise<HandlerResult>
	now: () => number
	wait: (seconds: number, signal: AbortSignal) => Promise<void>
}

type IndexStream = keyof IndexerState["lastFetchedBlock"]

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
	const handlers: Array<{
		stream: IndexStream
		run: (db: PostgresJsDatabase) => Promise<HandlerResult>
	}> = [
		...(deps.outer || env.INDEX_OUTER
			? [{ stream: "outer" as const, run: deps.outer ?? outerHandler }]
			: []),
		...(deps.inner || env.INDEX_INNER
			? [{ stream: "inner" as const, run: deps.inner ?? innerHandler }]
			: []),
		...(deps.registry || env.INDEX_REGISTRY
			? [{ stream: "registry" as const, run: deps.registry ?? registryHandler }]
			: [])
	]
	const now = deps.now ?? Date.now
	const wait = deps.wait ?? waitForDelay

	while (state.isRunning) {
		const settled = await Promise.allSettled(handlers.map(({ run }) => run(db)))
		const failures: Array<{
			stream: IndexStream
			result: PromiseRejectedResult
		}> = []
		let successCount = 0

		for (const [index, handler] of handlers.entries()) {
			const result = settled[index]
			if (!result) continue
			if (result.status === "fulfilled") {
				successCount += 1
				state.lastFetchedBlock[handler.stream] =
					result.value.lastFetchedBlock ?? state.lastFetchedBlock[handler.stream]
			} else {
				failures.push({ stream: handler.stream, result })
			}
		}

		if (successCount > 0 || handlers.length === 0) {
			state.lastRunTimestamp = now()
		}

		if (failures.length === 0) {
			state.consecutiveErrors = 0
			logger.info(
				`runIndexingLoop: finished run (outer=${state.lastFetchedBlock.outer ?? 0}, inner=${state.lastFetchedBlock.inner ?? 0}, registry=${state.lastFetchedBlock.registry ?? 0})`
			)
		} else {
			state.consecutiveErrors += 1
		}

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

		if (handlers.length > 0 && failures.length === handlers.length) {
			if (!state.isRunning || signal.aborted) break

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
			lastFetchedBlock: { outer: null, inner: null, registry: null },
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
			consecutiveErrors: this.#state.consecutiveErrors,
			streams: {
				outer: env.INDEX_OUTER,
				inner: env.INDEX_INNER,
				registry: env.INDEX_REGISTRY
			}
		}
	}

	async #rebuild() {
		const wasRunning = this.#state.isRunning
		const previousConfig = { ...this.#state.config }

		if (this.#state.isRunning) {
			await this.#stop()
		}

		try {
			const rebuilds: Array<{
				stream: IndexStream
				run: () => Promise<{ data?: unknown[]; lastFetchedBlock: number | null }>
			}> = [
				...(env.INDEX_OUTER
					? [{ stream: "outer" as const, run: () => outerRebuild(this.#db) }]
					: []),
				...(env.INDEX_INNER
					? [{ stream: "inner" as const, run: () => innerRebuild(this.#db) }]
					: []),
				...(env.INDEX_REGISTRY
					? [{ stream: "registry" as const, run: () => registryRebuild(this.#db) }]
					: [])
			]
			const settled = await Promise.allSettled(rebuilds.map(({ run }) => run()))
			const failures: string[] = []
			let actionsProcessed = 0

			for (const [index, rebuild] of rebuilds.entries()) {
				const result = settled[index]
				if (!result) continue
				if (result.status === "fulfilled") {
					this.#state.lastFetchedBlock[rebuild.stream] = result.value.lastFetchedBlock ?? null
					actionsProcessed += result.value.data?.length ?? 0
					continue
				}
				const message =
					result.reason instanceof Error ? result.reason.message : String(result.reason)
				logger.error(`Error during ${rebuild.stream} rebuild:`, result.reason)
				failures.push(`${rebuild.stream}: ${message}`)
			}

			if (wasRunning) {
				this.#start(previousConfig)
			}

			if (failures.length > 0) {
				return {
					success: false,
					message: `Indexer rebuild failed (${failures.join("; ")})`,
					status: this.getStatus()
				}
			}

			return {
				success: true,
				message: "Indexer rebuilt from archive data",
				actionsProcessed,
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
			this.#state.lastFetchedBlock = { outer: null, inner: null, registry: null }
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
