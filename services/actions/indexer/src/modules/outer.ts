import { commitActions, witnessActions } from "@zeko/actions-api"
import { emptyActionsList } from "@zeko/bridge-sdk"
import { sql } from "drizzle-orm"
import { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { outerActions } from "services/actions/api/drizzle/schema"
import {
	batchInsert,
	clearAllTables,
	CommitInsert,
	deleteOuterActionsFromIndex,
	getLastFinalOuterAction,
	getOuterActionsFromBlock,
	OuterActionsInsert,
	WitnessInsert
} from "../db"
import { env } from "../env"
import type { ArchiveEvent } from "../helper"
import { fetchActions, getNetworkTip, l1Client, logger } from "../helper"

/**
 * Handler for fetching outer actions (deposits) from the L1 archive.
 */

async function fetch({ startBlock }: { startBlock: number }) {
	logger.info(`[outer.handler] Fetching from ${startBlock}`)

	const actions = await fetchActions({
		client: l1Client,
		fromBlock: startBlock,
		pk: env.OUTER_PK
	})

	const data = actions.map((item: ArchiveEvent) => {
		const beforeState = item.beforeActionState.equals(emptyActionsList).toBoolean()
			? null
			: item.beforeActionState.toString()
		const afterState = item.afterActionState.toString()
		const kind = item.action[0].equals(0).toBoolean() ? "commit" : "witness"
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
			`[outer.handler] fetched ${data.length} actions; sample beforeStates: ${sample.map((d) => d.beforeState ?? "NULL").join(", ")}`
		)
	}

	const lastFetchedBlock = actions.length
		? actions[actions.length - 1].blockInfo.height
		: startBlock
	return { data, lastFetchedBlock }
}

type OuterItem = Awaited<ReturnType<typeof fetch>>["data"][number]

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
			fields: item.fields.map((x) => x.toString()),
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
	actionsToInsert: OuterActionsInsert[]
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
	if (actionsToInsert.length)
		await batchInsert({ db, table: outerActions, values: actionsToInsert })
	if (commitToInsert.length) await batchInsert({ db, table: commitActions, values: commitToInsert })
	if (witnessToInsert.length)
		await batchInsert({ db, table: witnessActions, values: witnessToInsert })
}

export async function handler(db: PostgresJsDatabase) {
	const tip = await getNetworkTip(l1Client)
	const lastFinal = await getLastFinalOuterAction(db)
	const startBlock = lastFinal?.blockHeight ? lastFinal.blockHeight + 1 : 1
	logger.info(`runIndexingLoop: tip=${tip}, startBlock=${startBlock}`)
	const outerResult = await fetch({ startBlock })

	// Prefetch DB chain from startBlock for performant lookups
	const dbActions = await getOuterActionsFromBlock(db, startBlock)

	// Compare fetched events with DB chain to detect forks or missing actions
	let currentIndex = lastFinal?.index ?? -1
	let forkAtIndex = null
	let insertFromIndex = null

	for (let i = 0; i < outerResult.data.length; i++) {
		const item = outerResult.data[i]
		const dbItem = i > dbActions.length ? undefined : dbActions[i]
		currentIndex++

		if (dbItem && dbItem.afterState !== item.afterState && !forkAtIndex) {
			logger.info(
				`[outer.handler] fork at index ${currentIndex}: ${dbItem.afterState} -> ${item.afterState}`
			)
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
			await deleteOuterActionsFromIndex(tx, forkAtIndex)
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

	return outerResult
}

export async function rebuild(db: PostgresJsDatabase) {
	const startBlock = 0
	const fetchResult = await fetch({ startBlock })

	const { actionsToInsert, commitToInsert, witnessToInsert } = buildOuter(fetchResult.data, 0)

	if (actionsToInsert.length === 0 && commitToInsert.length === 0 && witnessToInsert.length === 0) {
		throw new Error("No actions to insert during rebuild")
	}

	await db.transaction(async (tx) => {
		await clearAllTables(tx)
		await insertOuter({
			db: tx,
			actionsToInsert,
			commitToInsert,
			witnessToInsert
		})
	})

	return fetchResult
}
