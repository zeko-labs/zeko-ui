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

export interface ActionRepairCheckResult {
	checked: boolean
	lastCheckedAt: number | null
	repairResult: ActionRepairResult
}

export const actionIntegrityCheckIntervalMs = 5 * 60 * 1000

export function shouldCheckActionIndexIntegrity({
	lastCheckedAt,
	now
}: {
	lastCheckedAt: number | null
	now: number
}): boolean {
	return lastCheckedAt === null || now - lastCheckedAt >= actionIntegrityCheckIntervalMs
}

const getActionIndexRepairIndex = (integrity: ActionIndexIntegrity): number | null => {
	const repairIndexes = [
		...(integrity.firstMissingIndex === null ? [] : [integrity.firstMissingIndex]),
		...(integrity.linkedRepairIndex === null ? [] : [integrity.linkedRepairIndex])
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

export async function checkAndRepairActionIndexDrift<
	FetchedAction extends ActionRepairItem,
	DataToInsert
>(
	db: PostgresJsDatabase,
	{
		build,
		deleteFromIndex,
		fetchActions,
		getIntegrity,
		getRepairAnchor,
		insert,
		lastCheckedAt,
		now
	}: {
		lastCheckedAt: number | null
		now: number
		getIntegrity: (db: PostgresJsDatabase) => Promise<ActionIndexIntegrity>
		getRepairAnchor: (db: PostgresJsDatabase, repairIndex: number) => Promise<ActionRepairAnchor>
		fetchActions: (
			startBlock: number
		) => Promise<{ data: FetchedAction[]; lastFetchedBlock: number }>
		build: (items: FetchedAction[], currIndex: number) => DataToInsert
		deleteFromIndex: (db: PostgresJsDatabase, index: number) => Promise<void>
		insert: (db: PostgresJsDatabase, data: DataToInsert) => Promise<void>
	}
): Promise<ActionRepairCheckResult> {
	const idleResult = {
		repaired: false,
		repairIndex: null,
		lastFetchedBlock: null
	}

	if (!shouldCheckActionIndexIntegrity({ lastCheckedAt, now })) {
		return {
			checked: false,
			lastCheckedAt,
			repairResult: idleResult
		}
	}

	const integrity = await getIntegrity(db)
	const repairResult = await repairActionIndexDrift(db, {
		integrity,
		getRepairAnchor,
		fetchActions,
		build,
		deleteFromIndex,
		insert
	})

	return {
		checked: true,
		lastCheckedAt: now,
		repairResult
	}
}
