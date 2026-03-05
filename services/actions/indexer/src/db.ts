import { commitActions, innerActions, outerActions, witnessActions } from "@zeko/actions-api"
import { desc, type InferInsertModel, isNull, not, sql } from "drizzle-orm"
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
		.select()
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
		.select()
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
