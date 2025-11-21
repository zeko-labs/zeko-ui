import { actions, commitActions, witnessActions } from "@zeko/actions-api"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ActionsInsert, CommitInsert, WitnessInsert } from "./db"
import {
	batchInsert,
	clearAllTables,
	deleteActionsFromBlock,
	getActionsFromBlock,
	getLastActionBeforeOrEqual,
	getNextActionByBeforeState
} from "./db"
import { env } from "./env"
import { getNetworkTip, l1Client, logger, wait } from "./helper"
import { handler as depositHandler } from "./modules/deposit"
import { handler as withdrawalHandler } from "./modules/withdrawal"

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
			const tip = await getNetworkTip(l1Client)
			const finality = Number(env.L1_FINALITY ?? 290)
			const finalHeight = Math.max(0, tip - finality)
			const lastFinal = await getLastActionBeforeOrEqual(db, finalHeight)
			const startBlock = lastFinal?.blockHeight ?? 0
			logger.info(
				`runIndexingLoop: tip=${tip}, finalHeight=${finalHeight}, startBlock=${startBlock}`
			)
			const depositResult = await depositHandler.fetch({ startBlock })
			//TODO: handle withdrawalResult when withdrawal module is functional

			// Prefetch DB chain from startBlock for performant lookups
			const dbActions = await getActionsFromBlock(db, startBlock)
			const dbByBefore = new Map<string | null, typeof actions.$inferSelect>()
			for (const a of dbActions) {
				dbByBefore.set(a.beforeState ?? null, a)
			}

			// Compare fetched events with DB chain to detect forks or missing actions
			let lastKnownAfterState = lastFinal?.afterState ?? null
			let forkDetected = false
			const actionsToInsert: ActionsInsert[] = []
			const commitToInsert: CommitInsert[] = []
			const witnessToInsert: WitnessInsert[] = []

			for (const item of depositResult.data) {
				const computedAfter = item.afterState
				// Prefer the in-memory map for speed; fallback to DB if we don't have it in the map
				const dbNext =
					dbByBefore.get(lastKnownAfterState ?? null) ??
					(await getNextActionByBeforeState(db, lastKnownAfterState ?? null))
				if (dbNext) {
					if (dbNext.afterState !== computedAfter) {
						forkDetected = true
						break
					}
					// otherwise the action matches the stored chain
					lastKnownAfterState = dbNext.afterState
					continue
				}
				// DB doesn't have the action yet — collect for insertion
				actionsToInsert.push({
					afterState: computedAfter,
					kind: item.kind,
					beforeState: item.beforeState ?? null,
					length: item.length,
					blockHeight: item.blockHeight,
					slotRangeLower: item.kind === "commit" ? item.slotRangeLower ?? 0 : 0,
					slotRangeUpper: item.kind === "commit" ? item.slotRangeUpper ?? 0 : 0
				})
				if (item.kind === "commit") {
					commitToInsert.push({
						afterState: computedAfter,
						ledger: item.ledger,
						innerActionState: item.innerActionState,
						innerActionStateLength: item.innerActionStateLength,
						synchronizedOuterActionState: item.synchronizedOuterActionState,
						synchronizedOuterActionStateLength: item.synchronizedOuterActionStateLength
					})
				} else {
					witnessToInsert.push({ afterState: computedAfter, aux: item.aux })
				}
			}

			if (forkDetected) {
				// Rollback DB to last final action and re-insert the events
				const rollbackStart = lastFinal?.blockHeight ?? 0
				const {
					actionsToInsert: allActions,
					commitToInsert: allCommits,
					witnessToInsert: allWitness
				} = buildDeposits(depositResult.data)
				await db.transaction(async (tx) => {
					await deleteActionsFromBlock(tx, rollbackStart + 1)
					await insertDeposits({
						db: tx,
						actionsToInsert: allActions,
						commitToInsert: allCommits,
						witnessToInsert: allWitness
					})
				})
			} else {
				// Insert new events normally (ensure parent action rows are inserted before their children)
				if (actionsToInsert.length) {
					const existingAfterStates = new Set(dbActions.map((a) => a.afterState))
					const orderedActions = orderActionsWithParents(actionsToInsert, existingAfterStates)
					await db.transaction(async (tx) => {
						await insertDeposits({
							db: tx,
							actionsToInsert: orderedActions,
							commitToInsert,
							witnessToInsert
						})
					})
				}
			}
			// Fetch withdrawal result and update state for completeness
			const withdrawalResult = await withdrawalHandler.fetch({
				startBlock: state.lastFetchedBlock.withdrawal ?? 0
			})

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
				const orderedActions = orderActionsWithParents(actionsToInsert, new Set())
				await insertDeposits({
					db: tx,
					actionsToInsert: orderedActions,
					commitToInsert,
					witnessToInsert
				})
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
	witnessToInsert,
	deffered = true
}: {
	db: PostgresJsDatabase
	actionsToInsert: ActionsInsert[]
	commitToInsert: CommitInsert[]
	witnessToInsert: WitnessInsert[]
	deffered?: boolean
}) {
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
