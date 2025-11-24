import { actions, commitActions, witnessActions } from "@zeko/actions-api"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ActionsInsert, CommitInsert, WitnessInsert } from "./db"
import {
	batchInsert,
	clearAllTables,
	deleteActionsFromIndex,
	getActionsFromBlock,
	getLastFinalAction
} from "./db"
import { getNetworkTip, l1Client, logger, wait } from "./helper"
import { handler as innerHandler } from "./modules/inner"
import { handler as outerHandler } from "./modules/outer"

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
			const tip = await getNetworkTip(l1Client)
			const lastFinal = await getLastFinalAction(db)
			const startBlock = lastFinal?.blockHeight ? lastFinal.blockHeight + 1 : 0
			logger.info(`runIndexingLoop: tip=${tip}, startBlock=${startBlock}`)
			const outerResult = await outerHandler.fetch({ startBlock })
			//TODO: handle withdrawalResult when withdrawal module is functional

			// Prefetch DB chain from startBlock for performant lookups
			const dbActions = await getActionsFromBlock(db, startBlock)

			// Compare fetched events with DB chain to detect forks or missing actions
			let currentIndex = lastFinal?.index ?? -1
			let forkAtIndex = null
			let insertFromIndex = null

			for (let i = 0; i < outerResult.data.length; i++) {
				const item = outerResult.data[i]
				const dbItem = i > dbActions.length ? undefined : dbActions[i]
				currentIndex++

				if (
					dbItem &&
					(dbItem.beforeState !== item.beforeState || dbItem.afterState !== item.afterState) &&
					!forkAtIndex
				) {
					forkAtIndex = currentIndex
				}

				if (forkAtIndex || !dbItem) {
					insertFromIndex = i
					break
				}
			}

			const { actionsToInsert, commitToInsert, witnessToInsert } = buildOuter(
				outerResult.data.slice(insertFromIndex ?? Number.MAX_VALUE),
				currentIndex
			)

			if (forkAtIndex) {
				// Rollback DB to the detected fork
				await db.transaction(async (tx) => {
					await deleteActionsFromIndex(tx, forkAtIndex)
					await insertOuter({
						db: tx,
						actionsToInsert,
						commitToInsert,
						witnessToInsert
					})
				})
			} else {
				// Insert new events normally (ensure parent action rows are inserted before their children)
				if (actionsToInsert.length) {
					await db.transaction(async (tx) => {
						await insertOuter({
							db: tx,
							actionsToInsert,
							commitToInsert,
							witnessToInsert
						})
					})
				}
			}
			// Fetch withdrawal result and update state for completeness
			const withdrawalResult = await innerHandler.fetch({
				startBlock: state.lastFetchedBlock.inner ?? 0
			})

			state.lastRunTimestamp = Date.now()
			state.lastFetchedBlock.outer = outerResult.lastFetchedBlock ?? state.lastFetchedBlock.outer
			state.lastFetchedBlock.inner =
				withdrawalResult.lastFetchedBlock ?? state.lastFetchedBlock.inner
			state.consecutiveErrors = 0
			logger.info(
				`runIndexingLoop: finished run (outer=${state.lastFetchedBlock.outer ?? 0}, inner=${state.lastFetchedBlock.inner ?? 0})`
			)
		} catch (err: unknown) {
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
			// Clear existing tables and re-fetch all actions from scratch
			// rebuild in a single transaction (clear and insert) so rollback works on error
			const startBlock = 0
			const depositResult = await outerHandler.fetch({ startBlock })
			const withdrawalResult = await innerHandler.fetch({ startBlock })

			const { actionsToInsert, commitToInsert, witnessToInsert } = buildOuter(depositResult.data, 0)
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
				const orderedActions = orderActionsWithParents(actionsToInsert, new Set())
				await insertOuter({
					db: tx,
					actionsToInsert: orderedActions,
					commitToInsert,
					witnessToInsert
				})
			})

			this.#state.lastFetchedBlock.outer = depositResult.lastFetchedBlock ?? null
			this.#state.lastFetchedBlock.inner = withdrawalResult.lastFetchedBlock ?? null
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

type OuterItem = Awaited<ReturnType<typeof outerHandler.fetch>>["data"][number]

function buildOuter(items: OuterItem[], currIndex: number) {
	const actionsToInsert: ActionsInsert[] = []
	const commitToInsert: CommitInsert[] = []
	const witnessToInsert: WitnessInsert[] = []

	for (const item of items) {
		actionsToInsert.push({
			afterState: item.afterState,
			kind: item.kind,
			beforeState: item.beforeState,
			index: currIndex,
			blockHeight: item.blockHeight,
			slotRangeLower: BigInt(item.slotRangeLower),
			slotRangeUpper: BigInt(item.slotRangeUpper),
			markedAsCanonicalAt: item.markedAsCanonicalAt
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
		currIndex++
	}

	return { actionsToInsert, commitToInsert, witnessToInsert }
}

async function insertOuter({
	db,
	actionsToInsert,
	commitToInsert,
	witnessToInsert,
	deffered = true
}: {
	db: PostgresJsDatabase
	actionsToInsert: ActionsInsert[]
	commitToInsert: CommitInsert[]
	witnessToInsert: WitnessInsert[]
	deffered?: boolean
}) {
	logger.debug(
		`[insertOuter] inserting ${actionsToInsert.length} actions, ${commitToInsert.length} commits, ${witnessToInsert.length} witnesses`
	)
	if (deffered) {
		await db.execute(sql`SET CONSTRAINTS ALL DEFERRED;`)
	}
	if (actionsToInsert.length) await batchInsert({ db, table: actions, values: actionsToInsert })
	if (commitToInsert.length) await batchInsert({ db, table: commitActions, values: commitToInsert })
	if (witnessToInsert.length)
		await batchInsert({ db, table: witnessActions, values: witnessToInsert })
}

function orderActionsWithParents(actions: ActionsInsert[], existingAfterStates: Set<string>) {
	const pending = new Map(actions.map((a) => [a.afterState, a]))
	const ordered: ActionsInsert[] = []
	const inserted = new Set(existingAfterStates)

	let progress = true
	while (pending.size && progress) {
		progress = false
		for (const [afterState, act] of Array.from(pending.entries())) {
			const before = act.beforeState ?? null
			if (before === null || (typeof before === "string" && inserted.has(before))) {
				ordered.push(act)
				inserted.add(afterState)
				pending.delete(afterState)
				progress = true
			}
		}
	}

	if (pending.size) {
		const missing = new Set<string>()
		for (const [, act] of pending) {
			if (act.beforeState) missing.add(act.beforeState)
		}
		const missingArr = Array.from(missing)
		const err = new Error(
			`Missing parent after_state(s) for insert: ${missingArr.slice(0, 10).join(", ")}` +
				(missingArr.length > 10 ? ` (+${missingArr.length - 10} more)` : "")
		) as Error & { missingParents?: string[] }
		err.missingParents = missingArr
		throw err
	}
	return ordered
}
