import {
	commitActions,
	ethereumAssetRecords,
	ethereumAssetRegistryCheckpoints,
	ethereumAssetRegistryMemberships,
	innerActions,
	outerActions,
	witnessActions
} from "@zeko/actions-api"
import { and, desc, gte, type InferInsertModel, inArray, isNull, lt, not, sql } from "drizzle-orm"
import type { AnyPgTable } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "./env"
import { logger } from "./helper"

export function createDatabase(connectionString?: string): PostgresJsDatabase {
	const str =
		connectionString ?? env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5434/actions"
	const client = postgres(str, { max: 5 })
	return drizzle({ client })
}

export function createTestDatabase(connectionString?: string) {
	const str =
		connectionString ?? env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5434/actions"
	const url = new URL(str)
	const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"
	if (!isLocalhost) {
		throw new Error(
			"[SAFETY] Test database must use localhost connection. Aborting to avoid accidental production changes"
		)
	}
	const client = postgres(str, { max: 5 })
	const db = drizzle({ client })
	return {
		db,
		async clean() {
			await db.delete(witnessActions)
			await db.delete(commitActions)
			await db.delete(outerActions)
			await db.delete(innerActions)
		}
	}
}

// Typed batch insert helpers to avoid query parameter limits and centralize logic
export type OuterActionsInsert = typeof outerActions.$inferInsert
export type CommitInsert = typeof commitActions.$inferInsert
export type WitnessInsert = typeof witnessActions.$inferInsert
export type InnerActionsInsert = typeof innerActions.$inferInsert

export interface CanonicalProgressStream {
	lastFinalIndex: number | null
	lastFinalBlockHeight: number | null
	nonCanonicalTailCount: number
}

export interface CanonicalProgressSnapshot {
	outer: CanonicalProgressStream
	inner: CanonicalProgressStream
}

export interface ActionIndexRow {
	afterState: string
	beforeState: string | null
	index: number
}

export interface LinkedActionIndexGap {
	afterState: string
	beforeState: string
	index: number
	expectedIndex: number
}

export interface ActionIndexIntegrity {
	label: "outer" | "inner"
	count: number
	minIndex: number | null
	maxIndex: number | null
	expectedCount: number
	isDense: boolean
	firstMissingIndex: number | null
	linkedGapCount: number
	linkedRepairIndex: number | null
	linkedGapSample: LinkedActionIndexGap[]
}

export interface ActionIndexIntegritySnapshot {
	outer: ActionIndexIntegrity
	inner: ActionIndexIntegrity
}

export interface ActionRepairAnchor {
	repairIndex: number
	previousAfterState: string | null
	startBlock: number
}

// Keep promotion batches close to Postgres' bind limit without risking overflow.
const canonicalPromotionChunkSize = 50_000

export async function batchInsert<TTable extends AnyPgTable>({
	db,
	table,
	values,
	chunkSize = 100
}: {
	db: PostgresJsDatabase
	table: TTable
	values: InferInsertModel<TTable>[]
	chunkSize?: number
}): Promise<void> {
	const totalChunks = Math.ceil(values.length / chunkSize)
	logger.info(
		`[batchInsert] inserting ${values.length} rows in ${totalChunks} chunks (chunkSize=${chunkSize})`
	)
	for (let i = 0; i < values.length; i += chunkSize) {
		const chunk = values.slice(i, i + chunkSize)
		const chunkNum = Math.floor(i / chunkSize) + 1
		logger.info(`[batchInsert] chunk ${chunkNum}/${totalChunks} (${chunk.length} rows)`)
		await db.insert(table).values(chunk)
	}
	logger.info(`[batchInsert] done inserting ${values.length} rows`)
}

export function analyzeActionIndexIntegrity({
	label,
	rows
}: {
	label: "outer" | "inner"
	rows: ActionIndexRow[]
}): ActionIndexIntegrity {
	const orderedRows = [...rows].sort((a, b) => a.index - b.index)
	const count = orderedRows.length
	const minIndex = orderedRows.at(0)?.index ?? null
	const maxIndex = orderedRows.at(-1)?.index ?? null
	const expectedCount = maxIndex === null ? 0 : maxIndex + 1
	const indexes = new Set(orderedRows.map((row) => row.index))
	let firstMissingIndex: number | null = null
	if (maxIndex !== null) {
		for (let index = 0; index <= maxIndex; index++) {
			if (!indexes.has(index)) {
				firstMissingIndex = index
				break
			}
		}
	}
	const byAfterState = new Map(orderedRows.map((row) => [row.afterState, row]))
	const linkedGaps = orderedRows.flatMap((row): LinkedActionIndexGap[] => {
		if (row.beforeState === null) return []
		const previous = byAfterState.get(row.beforeState)
		if (!previous) return []
		const expectedIndex = previous.index + 1
		return row.index === expectedIndex
			? []
			: [
					{
						afterState: row.afterState,
						beforeState: row.beforeState,
						index: row.index,
						expectedIndex
					}
				]
	})
	const linkedRepairIndex = linkedGaps.reduce<number | null>((earliest, gap) => {
		const repairIndex = Math.min(gap.expectedIndex, gap.index)
		return earliest === null ? repairIndex : Math.min(earliest, repairIndex)
	}, null)

	return {
		label,
		count,
		minIndex,
		maxIndex,
		expectedCount,
		isDense: count === expectedCount && firstMissingIndex === null,
		firstMissingIndex,
		linkedGapCount: linkedGaps.length,
		linkedRepairIndex,
		linkedGapSample: linkedGaps.slice(0, 10)
	}
}

export function getActionIndexRepairIndex(integrity: ActionIndexIntegrity): number | null {
	const repairIndexes = [
		...(integrity.firstMissingIndex === null ? [] : [integrity.firstMissingIndex]),
		...(integrity.linkedRepairIndex === null ? [] : [integrity.linkedRepairIndex])
	]
	return repairIndexes.length === 0 ? null : Math.min(...repairIndexes)
}

const getActionIndexIntegrity = async ({
	db,
	table,
	label
}: {
	db: PostgresJsDatabase
	table: typeof outerActions | typeof innerActions
	label: "outer" | "inner"
}) => {
	const rows = await db
		.select({
			afterState: table.afterState,
			beforeState: table.beforeState,
			index: table.index
		})
		.from(table)
		.orderBy(table.index)

	return analyzeActionIndexIntegrity({ label, rows })
}

export async function getActionIndexIntegritySnapshot(
	db: PostgresJsDatabase
): Promise<ActionIndexIntegritySnapshot> {
	const [outer, inner] = await Promise.all([
		getActionIndexIntegrity({ db, table: outerActions, label: "outer" }),
		getActionIndexIntegrity({ db, table: innerActions, label: "inner" })
	])

	return { outer, inner }
}

export async function getOuterActionIndexIntegrity(
	db: PostgresJsDatabase
): Promise<ActionIndexIntegrity> {
	return getActionIndexIntegrity({ db, table: outerActions, label: "outer" })
}

export async function getInnerActionIndexIntegrity(
	db: PostgresJsDatabase
): Promise<ActionIndexIntegrity> {
	return getActionIndexIntegrity({ db, table: innerActions, label: "inner" })
}

const getActionRepairAnchor = async ({
	db,
	table,
	repairIndex
}: {
	db: PostgresJsDatabase
	table: typeof outerActions | typeof innerActions
	repairIndex: number
}): Promise<ActionRepairAnchor> => {
	const [previousAction] = await db
		.select({
			afterState: table.afterState,
			blockHeight: table.blockHeight
		})
		.from(table)
		.where(lt(table.index, repairIndex))
		.orderBy(desc(table.index))
		.limit(1)
	const [firstTailAction] = await db
		.select({ blockHeight: table.blockHeight })
		.from(table)
		.where(gte(table.index, repairIndex))
		.orderBy(table.index)
		.limit(1)

	if (!firstTailAction) {
		throw new Error(`Cannot repair action index ${repairIndex}: no indexed tail action found`)
	}

	return {
		repairIndex,
		previousAfterState: previousAction?.afterState ?? null,
		startBlock: previousAction?.blockHeight ?? firstTailAction.blockHeight
	}
}

export async function getOuterActionRepairAnchor(
	db: PostgresJsDatabase,
	repairIndex: number
): Promise<ActionRepairAnchor> {
	return getActionRepairAnchor({ db, table: outerActions, repairIndex })
}

export async function getInnerActionRepairAnchor(
	db: PostgresJsDatabase,
	repairIndex: number
): Promise<ActionRepairAnchor> {
	return getActionRepairAnchor({ db, table: innerActions, repairIndex })
}

export function assertActionIndexIntegrity(integrity: ActionIndexIntegrity): void {
	const linkedMessage =
		integrity.linkedGapCount === 0
			? ""
			: `, linkedGapCount=${integrity.linkedGapCount}, linkedGapSample=${JSON.stringify(integrity.linkedGapSample)}`
	if (integrity.isDense && integrity.linkedGapCount === 0) return
	throw new Error(
		`Sparse ${integrity.label} action indexes: count=${integrity.count}, min=${integrity.minIndex}, max=${integrity.maxIndex}, expectedCount=${integrity.expectedCount}, firstMissingIndex=${integrity.firstMissingIndex}${linkedMessage}`
	)
}

export async function assertActionIndexIntegritySnapshot(db: PostgresJsDatabase): Promise<void> {
	const snapshot = await getActionIndexIntegritySnapshot(db)
	assertActionIndexIntegrity(snapshot.outer)
	assertActionIndexIntegrity(snapshot.inner)
}

export async function clearOuterActionTables(tx: PostgresJsDatabase) {
	await tx.delete(witnessActions)
	await tx.delete(commitActions)
	await tx.delete(outerActions)
}

export async function clearInnerActionTables(tx: PostgresJsDatabase) {
	await tx.delete(innerActions)
}

export async function clearActionTables(tx: PostgresJsDatabase) {
	await clearOuterActionTables(tx)
	await clearInnerActionTables(tx)
}

export async function clearAllTables(tx: PostgresJsDatabase) {
	await clearActionTables(tx)
	await tx.delete(ethereumAssetRegistryMemberships)
	await tx.delete(ethereumAssetRecords)
	await tx.delete(ethereumAssetRegistryCheckpoints)
}

export async function getLastFinalOuterAction(db: PostgresJsDatabase) {
	logger.info("[getLastFinalOuterAction] querying")
	const result = await db
		.select({
			afterState: outerActions.afterState,
			index: outerActions.index,
			blockHeight: outerActions.blockHeight,
			markedAsCanonicalAt: outerActions.markedAsCanonicalAt
		})
		.from(outerActions)
		.where(not(isNull(outerActions.markedAsCanonicalAt)))
		.orderBy(desc(outerActions.index))
		.limit(1)

	const action = result.at(0) ?? null
	logger.info(
		`[getLastFinalOuterAction] result: ${action ? `index=${action.index} blockHeight=${action.blockHeight} afterState=${action.afterState}` : "<none>"}`
	)
	return action
}

export async function getLastFinalInnerAction(db: PostgresJsDatabase) {
	logger.info("[getLastFinalInnerAction] querying")
	const result = await db
		.select({
			afterState: innerActions.afterState,
			index: innerActions.index,
			blockHeight: innerActions.blockHeight,
			markedAsCanonicalAt: innerActions.markedAsCanonicalAt
		})
		.from(innerActions)
		.where(not(isNull(innerActions.markedAsCanonicalAt)))
		.orderBy(desc(innerActions.index))
		.limit(1)

	const action = result.at(0) ?? null
	logger.info(
		`[getLastFinalInnerAction] result: ${action ? `index=${action.index} blockHeight=${action.blockHeight} afterState=${action.afterState}` : "<none>"}`
	)
	return action
}

const countNonCanonicalTail = async ({
	db,
	table,
	lastFinalIndex
}: {
	db: PostgresJsDatabase
	table: typeof outerActions | typeof innerActions
	lastFinalIndex: number | null
}) => {
	const [{ count }] = await db
		.select({
			count: sql<string>`COUNT(*)`
		})
		.from(table)
		.where(
			lastFinalIndex == null
				? isNull(table.markedAsCanonicalAt)
				: and(sql`${table.index} > ${lastFinalIndex}`, isNull(table.markedAsCanonicalAt))
		)

	return Number(count)
}

const buildCanonicalProgressStream = async ({
	db,
	getLastFinalAction,
	table
}: {
	db: PostgresJsDatabase
	getLastFinalAction: typeof getLastFinalOuterAction | typeof getLastFinalInnerAction
	table: typeof outerActions | typeof innerActions
}): Promise<CanonicalProgressStream> => {
	const lastFinal = await getLastFinalAction(db)

	return {
		lastFinalIndex: lastFinal?.index ?? null,
		lastFinalBlockHeight: lastFinal?.blockHeight ?? null,
		nonCanonicalTailCount: await countNonCanonicalTail({
			db,
			table,
			lastFinalIndex: lastFinal?.index ?? null
		})
	}
}

export async function getCanonicalProgressSnapshot(
	db: PostgresJsDatabase
): Promise<CanonicalProgressSnapshot> {
	const [outer, inner] = await Promise.all([
		buildCanonicalProgressStream({
			db,
			getLastFinalAction: getLastFinalOuterAction,
			table: outerActions
		}),
		buildCanonicalProgressStream({
			db,
			getLastFinalAction: getLastFinalInnerAction,
			table: innerActions
		})
	])

	return { outer, inner }
}

export async function getOuterActionsFromBlock(db: PostgresJsDatabase, startBlock: number) {
	logger.info(`[getOuterActionsFromBlock] querying block >= ${startBlock}`)
	const start = performance.now()
	const actionsList = await db
		.select()
		.from(outerActions)
		.where(sql`${outerActions.blockHeight} >= ${startBlock}`)
		.orderBy(outerActions.index)
	logger.info(
		`[getOuterActionsFromBlock] got ${actionsList.length} rows (${Math.round(performance.now() - start)}ms)`
	)
	return actionsList
}

export async function getInnerActionsFromBlock(db: PostgresJsDatabase, startBlock: number) {
	logger.info(`[getInnerActionsFromBlock] querying block >= ${startBlock}`)
	const start = performance.now()
	const actionsList = await db
		.select()
		.from(innerActions)
		.where(sql`${innerActions.blockHeight} >= ${startBlock}`)
		.orderBy(innerActions.index)
	logger.info(
		`[getInnerActionsFromBlock] got ${actionsList.length} rows (${Math.round(performance.now() - start)}ms)`
	)
	return actionsList
}

const deleteActionsFromIndex = async ({
	tx,
	table,
	index,
	label
}: {
	tx: PostgresJsDatabase
	table: typeof outerActions | typeof innerActions
	index: number
	label: "outer" | "inner"
}) => {
	logger.info(`[deleteActionsFromIndex:${label}] deleting from index >= ${index}`)
	await tx.update(table).set({ beforeState: null }).where(gte(table.index, index))
	await tx.delete(table).where(gte(table.index, index))
}

export async function deleteOuterActionsFromIndex(tx: PostgresJsDatabase, index: number) {
	await deleteActionsFromIndex({ tx, table: outerActions, index, label: "outer" })
}

export async function deleteInnerActionsFromIndex(tx: PostgresJsDatabase, index: number) {
	await deleteActionsFromIndex({ tx, table: innerActions, index, label: "inner" })
}

const promoteCanonicalActions = async ({
	db,
	table,
	afterStates,
	label
}: {
	db: PostgresJsDatabase
	table: typeof outerActions | typeof innerActions
	afterStates: string[]
	label: "outer" | "inner"
}) => {
	const uniqueAfterStates = [...new Set(afterStates)]
	if (uniqueAfterStates.length === 0) {
		logger.info(`[promoteCanonicalActions:${label}] no canonical actions to promote`)
		return 0
	}

	const markedAsCanonicalAt = new Date()
	let promotedCount = 0
	for (let start = 0; start < uniqueAfterStates.length; start += canonicalPromotionChunkSize) {
		const afterStateChunk = uniqueAfterStates.slice(start, start + canonicalPromotionChunkSize)
		const promoted = await db
			.update(table)
			.set({ markedAsCanonicalAt })
			.where(and(inArray(table.afterState, afterStateChunk), isNull(table.markedAsCanonicalAt)))
			.returning({ afterState: table.afterState })
		promotedCount += promoted.length
	}

	logger.info(
		`[promoteCanonicalActions:${label}] promoted ${promotedCount}/${uniqueAfterStates.length} actions`
	)
	return promotedCount
}

export async function promoteOuterCanonicalActions(db: PostgresJsDatabase, afterStates: string[]) {
	return promoteCanonicalActions({
		db,
		table: outerActions,
		afterStates,
		label: "outer"
	})
}

export async function promoteInnerCanonicalActions(db: PostgresJsDatabase, afterStates: string[]) {
	return promoteCanonicalActions({
		db,
		table: innerActions,
		afterStates,
		label: "inner"
	})
}

export async function checkDatabaseHealth(
	db: PostgresJsDatabase
): Promise<{ healthy: boolean; latency: number; error?: string }> {
	const start = performance.now()
	try {
		await db.execute(sql`SELECT 1`)
		return {
			healthy: true,
			latency: performance.now() - start
		}
	} catch (error) {
		return {
			healthy: false,
			latency: performance.now() - start,
			error: error instanceof Error ? error.message : String(error)
		}
	}
}
