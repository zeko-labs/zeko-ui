import { actions, commitActions, witnessActions } from "@zeko/actions-api"
import { desc, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "./env"

export function createDatabase(connectionString?: string): PostgresJsDatabase {
	const str =
		connectionString ?? env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/actions"
	const client = postgres(str, { max: 5 })
	return drizzle(client)
}

export function createTestDatabase(connectionString?: string) {
	const str =
		connectionString ?? env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/actions"
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

export async function batchInsert<
	T extends typeof actions | typeof commitActions | typeof witnessActions
>({
	db,
	table,
	values,
	chunkSize = 16000
}: {
	db: PostgresJsDatabase
	table: T
	values: T["$inferInsert"][]
	chunkSize?: number
}): Promise<void> {
	for (let i = 0; i < values.length; i += chunkSize) {
		const chunk = values.slice(i, i + chunkSize)
		await db
			.insert(table)
			.values(chunk as any)
			.onConflictDoNothing({ target: table.afterState })
	}
}

export async function clearAllTables(tx: PostgresJsDatabase) {
	await tx.delete(witnessActions)
	await tx.delete(commitActions)
	await tx.delete(actions)
}

export async function getLastActionBeforeOrEqual(db: PostgresJsDatabase, height: number) {
	const [action] = await db
		.select()
		.from(actions)
		.where(sql`${actions.blockHeight} <= ${height}`)
		.orderBy(desc(actions.blockHeight))
		.limit(1)
	return action
}

export async function getActionsFromBlock(db: PostgresJsDatabase, startBlock: number) {
	const actionsList = await db
		.select()
		.from(actions)
		.where(sql`${actions.blockHeight} >= ${startBlock}`)
		.orderBy(actions.blockHeight)
	return actionsList
}

export async function getNextActionByBeforeState(
	db: PostgresJsDatabase,
	beforeState: string | null
) {
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
	return action
}

export async function deleteActionsFromBlock(tx: PostgresJsDatabase, blockHeight: number) {
	await tx.delete(actions).where(sql`${actions.blockHeight} >= ${blockHeight}`)
}
