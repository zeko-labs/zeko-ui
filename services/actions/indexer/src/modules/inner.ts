import { innerActions } from "@zeko/actions-api"
import { emptyActionsList } from "@zeko-labs/bridge-sdk"
import { sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { checkAndRepairActionIndexDrift } from "../action-repair"
import {
	batchInsert,
	clearAllTables,
	deleteInnerActionsFromIndex,
	getInnerActionIndexIntegrity,
	getInnerActionRepairAnchor,
	getInnerActionsFromBlock,
	getLastFinalInnerAction,
	type InnerActionsInsert,
	promoteInnerCanonicalActions
} from "../db"
import { env } from "../env"
import type { ArchiveAction, ArchiveEvent } from "../helper"
import { fetchActions, getNetworkTip, handleFork, l2Client, logger } from "../helper"

/**
 * Handler for fetching inner actions (withdrawals) from the L2 archive.
 */

const EMPTY_ACTIONS_STATE = emptyActionsList.toString()
let lastIntegrityCheckAt: number | null = null

export const isCanonicalInnerActionBlock = ({
	chainStatus
}: Pick<ArchiveAction["blockInfo"], "chainStatus">) => chainStatus === "canonical"

async function fetch({ startBlock }: { startBlock: number }) {
	logger.info(`[inner.fetch] Fetching from ${startBlock}`)

	const actions = await fetchActions({
		client: l2Client,
		fromBlock: startBlock,
		pk: env.INNER_PK
	})

	const data = actions.map((item: ArchiveEvent) => {
		const beforeState =
			item.beforeActionState === EMPTY_ACTIONS_STATE ? null : item.beforeActionState
		const afterState = item.afterActionState
		const blockHeight = item.blockInfo.height
		const markedAsCanonicalAt = isCanonicalInnerActionBlock(item.blockInfo) ? new Date() : null

		return {
			fields: item.action,
			timestamp: item.timestamp,
			hash: item.hash,
			afterState,
			beforeState,
			blockHeight,
			markedAsCanonicalAt,
			aux: item.action[1].toString()
		}
	})

	// Debug: log a small sample of beforeStates and afterStates to help diagnose missing parents
	if (data.length) {
		const sample = data.slice(0, 5)
		logger.info(
			`[inner.fetch] fetched ${data.length} actions; sample beforeStates: ${sample.map((d) => d.beforeState ?? "NULL").join(", ")}`
		)
	}

	const lastFetchedBlock = actions.length
		? actions[actions.length - 1].blockInfo.height
		: startBlock
	return { data, lastFetchedBlock }
}

export type InnerItem = Awaited<ReturnType<typeof fetch>>["data"][number]

function buildInner(items: InnerItem[], currIndex: number) {
	const actionsToInsert: InnerActionsInsert[] = []

	for (const item of items) {
		actionsToInsert.push({
			afterState: item.afterState,
			beforeState: item.beforeState,
			index: currIndex,
			blockHeight: item.blockHeight,
			timestamp: new Date(+item.timestamp),
			txnHash: item.hash,
			fields: item.fields,
			markedAsCanonicalAt: item.markedAsCanonicalAt,
			aux: item.aux
		})
		currIndex++
	}

	return { actionsToInsert }
}

async function insertInner(
	db: PostgresJsDatabase,
	{
		actionsToInsert,
		deffered = true
	}: {
		actionsToInsert: InnerActionsInsert[]
		deffered?: boolean
	}
) {
	logger.info(`[inner.insert] inserting ${actionsToInsert.length} actions`)
	if (deffered) {
		await db.execute(sql`SET CONSTRAINTS ALL DEFERRED;`)
	}
	if (actionsToInsert.length)
		await batchInsert({ db, table: innerActions, values: actionsToInsert })
}

export async function handler(db: PostgresJsDatabase) {
	const now = Date.now()
	const repairCheck = await checkAndRepairActionIndexDrift(db, {
		lastCheckedAt: lastIntegrityCheckAt,
		now,
		getIntegrity: getInnerActionIndexIntegrity,
		getRepairAnchor: getInnerActionRepairAnchor,
		fetchActions: async (startBlock: number) => fetch({ startBlock }),
		build: buildInner,
		deleteFromIndex: deleteInnerActionsFromIndex,
		insert: insertInner
	})
	lastIntegrityCheckAt = repairCheck.lastCheckedAt
	if (repairCheck.repairResult.repaired) {
		return { lastFetchedBlock: repairCheck.repairResult.lastFetchedBlock }
	}

	const tip = await getNetworkTip(l2Client)
	const lastFinal = await getLastFinalInnerAction(db)
	const startBlock = lastFinal?.blockHeight ? lastFinal.blockHeight + 1 : 1
	logger.info(
		`[inner.handler] runIndexingLoop: tip=${tip}, startBlock=${startBlock}, lastFinal=${lastFinal ? `index=${lastFinal.index} block=${lastFinal.blockHeight} canonical=${lastFinal.markedAsCanonicalAt}` : "<none>"}`
	)

	const innerResult = await handleFork(db, {
		startBlock,
		lastFinalIndex: lastFinal?.index ?? -1,
		fetchActions: async (startBlock: number) => fetch({ startBlock }),
		getDbActions: getInnerActionsFromBlock,
		build: buildInner,
		deleteFromIndex: deleteInnerActionsFromIndex,
		insert: insertInner
	})

	await promoteInnerCanonicalActions(
		db,
		innerResult.data
			.filter((item) => item.markedAsCanonicalAt !== null)
			.map((item) => item.afterState)
	)

	return innerResult
}

export async function rebuild(db: PostgresJsDatabase) {
	logger.info(`[inner.rebuild] rebuilding from block 0`)

	const startBlock = 0
	const fetchResult = await fetch({ startBlock })

	const dataToInsert = buildInner(fetchResult.data, 0)

	if (dataToInsert.actionsToInsert.length === 0) {
		throw new Error("No actions to insert during rebuild")
	}

	await db.transaction(async (tx) => {
		await clearAllTables(tx)
		await insertInner(tx, dataToInsert)
	})

	return fetchResult
}
