import { actions, commitActions, witnessActions } from "@zeko/actions-api"
import { desc, InferInsertModel, isNull, not, sql } from "drizzle-orm"
import { AnyPgTable } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "./env"
import { logger } from "./helper"

export function createDatabase(connectionString?: string): PostgresJsDatabase {
	const str =
		connectionString ?? env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5434/actions"
	const client = postgres(str, { max: 5 })
	return drizzle(client)
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
	const db = drizzle(client)
	return {
		db,
		async clean() {
			await db.delete(witnessActions)
			await db.delete(commitActions)
			await db.delete(actions)
		}
	}
}

// Typed batch insert helpers to avoid query parameter limits and centralize logic
export type ActionsInsert = typeof actions.$inferInsert
export type CommitInsert = typeof commitActions.$inferInsert
export type WitnessInsert = typeof witnessActions.$inferInsert

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
	for (let i = 0; i < values.length; i += chunkSize) {
		const chunk = values.slice(i, i + chunkSize)
		await db.insert(table).values(chunk).onConflictDoNothing()
	}
}

export async function clearAllTables(tx: PostgresJsDatabase) {
	await tx.delete(witnessActions)
	await tx.delete(commitActions)
	await tx.delete(actions)
}

export async function getLastFinalAction(db: PostgresJsDatabase) {
	logger.debug("[getLastFinalAction] querying")
	const result = await db
		.select()
		.from(actions)
		.where(not(isNull(actions.markedAsCanonicalAt)))
		.orderBy(desc(actions.index))
		.limit(1)

	const action = result.at(0) ?? null
	logger.debug(`[getLastFinalAction] got action: ${action?.afterState ?? "<none>"}`)
	return action
}

export async function getActionsFromBlock(db: PostgresJsDatabase, startBlock: number) {
	logger.debug(`[getActionsFromBlock] querying block >= ${startBlock}`)
	const actionsList = await db
		.select()
		.from(actions)
		.where(sql`${actions.blockHeight} >= ${startBlock}`)
		.orderBy(actions.blockHeight)
	logger.debug(`[getActionsFromBlock] got ${actionsList.length} rows`)
	return actionsList
}

export async function getNextActionByBeforeState(
	db: PostgresJsDatabase,
	beforeState: string | null
) {
	logger.debug(`[getNextActionByBeforeState] querying beforeState=${beforeState ?? "NULL"}`)
	const [action] = await db
		.select()
		.from(actions)
		.where(
			beforeState === null
				? sql`${actions.beforeState} IS NULL`
				: sql`${actions.beforeState} = ${beforeState}`
		)
		.orderBy(actions.blockHeight)
		.limit(1)
	logger.debug(`[getNextActionByBeforeState] got action: ${action?.afterState ?? "<none>"}`)
	return action
}

export async function deleteActionsFromIndex(tx: PostgresJsDatabase, index: number) {
	logger.debug(`[deleteActionsFromBlock] deleting from index >= ${index}`)
	await tx.delete(actions).where(sql`${actions.index} >= ${index}`)
}
