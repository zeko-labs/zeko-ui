import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

export interface CloudflareContext {
	request: Request
	env: Env
	context: ExecutionContext
}

export const rc = new WeakMap<
	Request,
	{
		noCacheDb?: ReturnType<typeof initializeDrizzle>
		db?: ReturnType<typeof initializeDrizzle>
		cloudflare: CloudflareContext
	}
>()

const formatDatabaseError = (error: unknown): string => {
	if (!(error instanceof Error)) return String(error)
	const cause = (error as Error & { cause?: unknown }).cause
	if (cause === undefined || cause === null) return error.message
	const causeText = cause instanceof Error ? cause.message : String(cause)
	return `${error.message} | cause: ${causeText}`
}

const initializeDrizzle = ({ cache, env }: { cache: boolean; env: Env }) => {
	const isLocal = env.ENVIRONMENT === "local"
	const hyperdrive = cache ? env.HYPERDRIVE : env.HYPERDRIVE_NO_CACHE
	const client = isLocal
		? postgres(env.DATABASE_URL, {
				max: 5,
				fetch_types: false
			})
		: postgres({
				host: hyperdrive.host,
				port: hyperdrive.port,
				database: hyperdrive.database,
				username: hyperdrive.user,
				password: hyperdrive.password,
				max: 1,
				prepare: false,
				fetch_types: false
			})
	const db = drizzle({ client, logger: true })
	return [db, client] as const
}

export const useDatabase =
	({ request, env }: CloudflareContext) =>
	({ cache } = { cache: true }) => {
		const C = rc.get(request)

		// Initialize a db client with cache enabled or disabled, but look for it in the request cache first.
		const getDb = () => {
			if (cache && C?.db) return C.db
			if (!cache && C?.noCacheDb) return C.noCacheDb
			return initializeDrizzle({ cache, env })
		}

		const db = getDb()

		// If the client is not in the request cache, store it there.
		if (C && !C?.db && cache) rc.set(request, { ...C, db })
		if (C && !C?.noCacheDb && !cache) rc.set(request, { ...C, noCacheDb: db })
		const [drizzle, client] = db
		const initDb = performance.now()
		return {
			drizzle,
			client,
			[Symbol.dispose]: () => {
				//NOTE: We are using a request cache instead of disposing here because database() might be called multiple times in a single request.
				console.log(`Executed resolver in ${performance.now() - initDb}ms`)
			}
		}
	}

export type Database = ReturnType<typeof useDatabase>

export async function checkDatabaseHealth(
	cloudflare: CloudflareContext
): Promise<{ healthy: boolean; latency: number; error?: string }> {
	const start = performance.now()
	try {
		using db = useDatabase(cloudflare)({ cache: false })
		await db.drizzle.execute(sql`SELECT 1`)
		return {
			healthy: true,
			latency: performance.now() - start
		}
	} catch (error) {
		return {
			healthy: false,
			latency: performance.now() - start,
			error: formatDatabaseError(error)
		}
	}
}
