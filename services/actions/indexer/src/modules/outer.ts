import { commitActions, witnessActions } from "@zeko/actions-api"
import { emptyActionsList } from "@zeko-labs/bridge-sdk"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { outerActions } from "../../../api/drizzle/schema"
import { checkAndRepairActionIndexDrift } from "../action-repair"
import {
	batchInsert,
	type CommitInsert,
	clearOuterActionTables,
	deleteOuterActionsFromIndex,
	getLastFinalOuterAction,
	getOuterActionIndexIntegrity,
	getOuterActionRepairAnchor,
	getOuterActionsFromBlock,
	type OuterActionsInsert,
	promoteOuterCanonicalActions,
	type WitnessInsert
} from "../db"
import { env } from "../env"
import type { ArchiveEvent } from "../helper"
import { fetchActions, getNetworkTip, handleFork, l1Client, logger } from "../helper"

/**
 * Handler for fetching outer actions (deposits) from the L1 archive.
 */

const EMPTY_ACTIONS_STATE = emptyActionsList.toString()
let lastIntegrityCheckAt: number | null = null

export async function fetch({ startBlock }: { startBlock: number }) {
	logger.info(`[outer.fetch] Fetching from ${startBlock}`)

	const actions = await fetchActions({
		client: l1Client,
		fromBlock: startBlock,
		pk: env.OUTER_PK
	})

	const data = actions.map((item: ArchiveEvent) => {
		const beforeState =
			item.beforeActionState === EMPTY_ACTIONS_STATE ? null : item.beforeActionState
		const afterState = item.afterActionState
		const kind = item.action[0] === "0" ? "commit" : "witness"
		const blockHeight = item.blockInfo.height
		const markedAsCanonicalAt =
			item.blockInfo.distanceFromMaxBlockHeight >= env.L1_FINALITY ? new Date() : null

		if (kind === "commit")
			return {
				kind: "commit" as const,
				fields: item.action,
				timestamp: item.timestamp,
				hash: item.hash,
				afterState,
				beforeState,
				blockHeight,
				ledger: item.action[1].toString(),
				innerActionState: item.action[2].toString(),
				innerActionStateLength: Number(item.action[3].toString()),
				synchronizedOuterActionState: item.action[4].toString(),
				synchronizedOuterActionStateLength: Number(item.action[5].toString()),
				slotRangeLower: Number(item.action[6].toString()),
				slotRangeUpper: Number(item.action[7].toString()),
				markedAsCanonicalAt
			}

		return {
			kind: "witness" as const,
			fields: item.action,
			timestamp: item.timestamp,
			hash: item.hash,
			afterState,
			beforeState,
			blockHeight,
			aux: item.action[1].toString(),
			slotRangeLower: Number(item.action[3].toString()),
			slotRangeUpper: Number(item.action[4].toString()),
			markedAsCanonicalAt
		}
	})

	// Debug: log a small sample of beforeStates and afterStates to help diagnose missing parents
	if (data.length) {
		const sample = data.slice(0, 5)
		logger.info(
			`[outer.fetch] fetched ${data.length} actions; sample beforeStates: ${sample.map((d) => d.beforeState ?? "NULL").join(", ")}`
		)
	}

	const lastFetchedBlock = actions.length
		? actions[actions.length - 1].blockInfo.height
		: startBlock
	return { data, lastFetchedBlock }
}

export type OuterItem = Awaited<ReturnType<typeof fetch>>["data"][number]

function buildOuter(items: OuterItem[], currIndex: number) {
	const actionsToInsert: OuterActionsInsert[] = []
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
			timestamp: new Date(+item.timestamp),
			txnHash: item.hash,
			fields: item.fields,
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

async function insertOuter(
	db: PostgresJsDatabase,
	{
		actionsToInsert,
		commitToInsert,
		witnessToInsert,
		deffered = true
	}: {
		actionsToInsert: OuterActionsInsert[]
		commitToInsert: CommitInsert[]
		witnessToInsert: WitnessInsert[]
		deffered?: boolean
	}
) {
	logger.info(
		`[outer.insert] inserting ${actionsToInsert.length} actions, ${commitToInsert.length} commits, ${witnessToInsert.length} witnesses`
	)
	if (deffered) {
		await db.execute(sql`SET CONSTRAINTS ALL DEFERRED;`)
	}
	if (actionsToInsert.length)
		await batchInsert({ db, table: outerActions, values: actionsToInsert })
	if (commitToInsert.length) await batchInsert({ db, table: commitActions, values: commitToInsert })
	if (witnessToInsert.length)
		await batchInsert({ db, table: witnessActions, values: witnessToInsert })
}

export async function handler(db: PostgresJsDatabase) {
	const now = Date.now()
	const repairCheck = await checkAndRepairActionIndexDrift(db, {
		lastCheckedAt: lastIntegrityCheckAt,
		now,
		getIntegrity: getOuterActionIndexIntegrity,
		getRepairAnchor: getOuterActionRepairAnchor,
		fetchActions: async (startBlock: number) => fetch({ startBlock }),
		build: buildOuter,
		deleteFromIndex: deleteOuterActionsFromIndex,
		insert: insertOuter
	})
	lastIntegrityCheckAt = repairCheck.lastCheckedAt
	if (repairCheck.repairResult.repaired) {
		return { lastFetchedBlock: repairCheck.repairResult.lastFetchedBlock }
	}

	const tip = await getNetworkTip(l1Client)
	const lastFinal = await getLastFinalOuterAction(db)
	const startBlock = lastFinal?.blockHeight ? lastFinal.blockHeight + 1 : 1
	logger.info(
		`[outer.handler] runIndexingLoop: tip=${tip}, startBlock=${startBlock}, lastFinal=${lastFinal ? `index=${lastFinal.index} block=${lastFinal.blockHeight} canonical=${lastFinal.markedAsCanonicalAt}` : "<none>"}`
	)

	const outerResult = await handleFork(db, {
		startBlock,
		lastFinalIndex: lastFinal?.index ?? -1,
		fetchActions: async (startBlock: number) => fetch({ startBlock }),
		getDbActions: getOuterActionsFromBlock,
		build: buildOuter,
		deleteFromIndex: deleteOuterActionsFromIndex,
		insert: insertOuter
	})

	await promoteOuterCanonicalActions(
		db,
		outerResult.data
			.filter((item) => item.markedAsCanonicalAt !== null)
			.map((item) => item.afterState)
	)

	return outerResult
}

export async function rebuild(db: PostgresJsDatabase) {
	logger.info(`[outer.rebuild] rebuilding from block 0`)

	const startBlock = 0
	const fetchResult = await fetch({ startBlock })

	const dataToInsert = buildOuter(fetchResult.data, 0)

	if (
		dataToInsert.actionsToInsert.length === 0 &&
		dataToInsert.commitToInsert.length === 0 &&
		dataToInsert.witnessToInsert.length === 0
	) {
		throw new Error("No actions to insert during rebuild")
	}

	await db.transaction(async (tx) => {
		await clearOuterActionTables(tx)
		await insertOuter(tx, dataToInsert)
	})

	return fetchResult
}
