import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ActionIndexIntegrity, ActionRepairAnchor } from "./db"
import { logger } from "./helper"

export interface ActionRepairItem {
	beforeState: string | null
}

export interface ActionRepairResult {
	repaired: boolean
	repairIndex: number | null
	lastFetchedBlock: number | null
}

const getActionIndexRepairIndex = (integrity: ActionIndexIntegrity): number | null => {
	const linkedRepairIndexes = integrity.linkedGapSample.map((gap) =>
		gap.expectedIndex < gap.index ? gap.expectedIndex : gap.index
	)
	const repairIndexes = [
		...(integrity.firstMissingIndex === null ? [] : [integrity.firstMissingIndex]),
		...linkedRepairIndexes
	]
	return repairIndexes.length === 0 ? null : Math.min(...repairIndexes)
}

export async function repairActionIndexDrift<FetchedAction extends ActionRepairItem, DataToInsert>(
	db: PostgresJsDatabase,
	{
		build,
		deleteFromIndex,
		fetchActions,
		getRepairAnchor,
		insert,
		integrity
	}: {
		integrity: ActionIndexIntegrity
		getRepairAnchor: (db: PostgresJsDatabase, repairIndex: number) => Promise<ActionRepairAnchor>
		fetchActions: (
			startBlock: number
		) => Promise<{ data: FetchedAction[]; lastFetchedBlock: number }>
		build: (items: FetchedAction[], currIndex: number) => DataToInsert
		deleteFromIndex: (db: PostgresJsDatabase, index: number) => Promise<void>
		insert: (db: PostgresJsDatabase, data: DataToInsert) => Promise<void>
	}
): Promise<ActionRepairResult> {
	const repairIndex = getActionIndexRepairIndex(integrity)
	if (repairIndex === null) {
		return {
			repaired: false,
			repairIndex: null,
			lastFetchedBlock: null
		}
	}

	const anchor = await getRepairAnchor(db, repairIndex)
	logger.warn(
		`[action-repair:${integrity.label}] repairing from index=${repairIndex} startBlock=${anchor.startBlock}`
	)

	const fetched = await fetchActions(anchor.startBlock)
	const repairStart = fetched.data.findIndex(
		(item) => item.beforeState === anchor.previousAfterState
	)
	if (repairStart < 0) {
		throw new Error(
			`Cannot repair ${integrity.label} action index ${repairIndex}: archive data does not connect to previous afterState`
		)
	}

	const repairData = build(fetched.data.slice(repairStart), repairIndex)
	await db.transaction(async (tx) => {
		await deleteFromIndex(tx, repairIndex)
		await insert(tx, repairData)
	})

	return {
		repaired: true,
		repairIndex,
		lastFetchedBlock: fetched.lastFetchedBlock
	}
}
