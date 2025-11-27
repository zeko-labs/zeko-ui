import { innerActions } from "@zeko/actions-api"
import { emptyActionsList } from "@zeko/bridge-sdk"
import { sql } from "drizzle-orm"
import { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
	batchInsert,
	clearAllTables,
	deleteInnerActionsFromIndex,
	getInnerActionsFromBlock,
	getLastFinalInnerAction,
	InnerActionsInsert
} from "../db"
import { env } from "../env"
import type { ArchiveEvent } from "../helper"
import { fetchActions, getNetworkTip, l2Client, logger } from "../helper"

/**
 * Handler for fetching inner actions (withdrawals) from the L2 archive.
 */

async function fetch({ startBlock }: { startBlock: number }) {
	logger.info(`[inner.handler] Fetching from ${startBlock}`)

	const actions = await fetchActions({
		client: l2Client,
		fromBlock: startBlock,
		pk: env.INNER_PK
	})

	const data = actions.map((item: ArchiveEvent) => {
		const beforeState = item.beforeActionState.equals(emptyActionsList).toBoolean()
			? null
			: item.beforeActionState.toString()
		const afterState = item.afterActionState.toString()
		const blockHeight = item.blockInfo.height
		const now = +new Date()
		const blockTimestamp = +new Date(+item.blockInfo.timestamp)
		const diffMs = now - blockTimestamp
		const markedAsCanonicalAt =
			diffMs / (1000 * 60 * 60) >= env.L2_FINALITY_TIMEH ? new Date() : null

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
			`[inner.handler] fetched ${data.length} actions; sample beforeStates: ${sample.map((d) => d.beforeState ?? "NULL").join(", ")}`
		)
	}

	const lastFetchedBlock = actions.length
		? actions[actions.length - 1].blockInfo.height
		: startBlock
	return { data, lastFetchedBlock }
}

type InnerItem = Awaited<ReturnType<typeof fetch>>["data"][number]

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
			fields: item.fields.map((x) => x.toString()),
			markedAsCanonicalAt: item.markedAsCanonicalAt,
			aux: item.aux
		})
		currIndex++
	}

	return { actionsToInsert }
}

async function insertInner({
	db,
	actionsToInsert,
	deffered = true
}: {
	db: PostgresJsDatabase
	actionsToInsert: InnerActionsInsert[]
	deffered?: boolean
}) {
	logger.debug(`[insertInner] inserting ${actionsToInsert.length} actions`)
	if (deffered) {
		await db.execute(sql`SET CONSTRAINTS ALL DEFERRED;`)
	}
	if (actionsToInsert.length)
		await batchInsert({ db, table: innerActions, values: actionsToInsert })
}

export async function handler(db: PostgresJsDatabase) {
	const tip = await getNetworkTip(l2Client)
	const lastFinal = await getLastFinalInnerAction(db)
	const startBlock = lastFinal?.blockHeight ? lastFinal.blockHeight + 1 : 1
	logger.info(`runIndexingLoop: tip=${tip}, startBlock=${startBlock}`)
	const innerResult = await fetch({ startBlock })

	// Prefetch DB chain from startBlock for performant lookups
	const dbActions = await getInnerActionsFromBlock(db, startBlock)

	// Compare fetched events with DB chain to detect forks or missing actions
	let currentIndex = lastFinal?.index ?? -1
	let forkAtIndex = null
	let insertFromIndex = null

	for (let i = 0; i < innerResult.data.length; i++) {
		const item = innerResult.data[i]
		const dbItem = i > dbActions.length ? undefined : dbActions[i]
		currentIndex++

		if (dbItem && dbItem.afterState !== item.afterState && !forkAtIndex) {
			logger.info(
				`[inner.handler] fork at index ${currentIndex}: ${dbItem.afterState} -> ${item.afterState}`
			)
			forkAtIndex = currentIndex
		}

		if (forkAtIndex || !dbItem) {
			insertFromIndex = i
			break
		}
	}

	const { actionsToInsert } = buildInner(
		innerResult.data.slice(insertFromIndex ?? Number.MAX_VALUE),
		currentIndex
	)

	if (forkAtIndex) {
		// Rollback DB to the detected fork
		await db.transaction(async (tx) => {
			await deleteInnerActionsFromIndex(tx, forkAtIndex)
			await insertInner({
				db: tx,
				actionsToInsert
			})
		})
	} else {
		// Insert new events normally (ensure parent action rows are inserted before their children)
		if (actionsToInsert.length) {
			await db.transaction(async (tx) => {
				await insertInner({
					db: tx,
					actionsToInsert
				})
			})
		}
	}

	return innerResult
}

export async function rebuild(db: PostgresJsDatabase) {
	const startBlock = 0
	const fetchResult = await fetch({ startBlock })

	const { actionsToInsert } = buildInner(fetchResult.data, 0)

	if (actionsToInsert.length === 0) {
		throw new Error("No actions to insert during rebuild")
	}

	await db.transaction(async (tx) => {
		await clearAllTables(tx)
		await insertInner({
			db: tx,
			actionsToInsert
		})
	})

	return fetchResult
}
