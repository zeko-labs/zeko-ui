import { commitActions, innerActions, outerActions, witnessActions } from "@zeko/actions-api"
import { and, desc, type InferInsertModel, inArray, isNull, not, sql } from "drizzle-orm"
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
		await db.insert(table).values(chunk).onConflictDoNothing()
	}
	logger.info(`[batchInsert] done inserting ${values.length} rows`)
}

export async function clearAllTables(tx: PostgresJsDatabase) {
	await tx.delete(witnessActions)
	await tx.delete(commitActions)
	await tx.delete(outerActions)
	await tx.delete(innerActions)
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

export async function deleteOuterActionsFromIndex(tx: PostgresJsDatabase, index: number) {
	logger.info(`[deleteOuterActionsFromIndex] deleting from index >= ${index}`)
	await tx.delete(outerActions).where(sql`${outerActions.index} >= ${index}`)
}

export async function deleteInnerActionsFromIndex(tx: PostgresJsDatabase, index: number) {
	logger.info(`[deleteInnerActionsFromIndex] deleting from index >= ${index}`)
	await tx.delete(innerActions).where(sql`${innerActions.index} >= ${index}`)
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
