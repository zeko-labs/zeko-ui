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

const initializeDrizzle = ({ cache, env }: { cache: boolean; env: Env }) => {
	const connectionString =
		env.ENVIRONMENT === "local"
			? env.DATABASE_URL
			: cache
				? `${env.HYPERDRIVE.connectionString}`
				: `${env.HYPERDRIVE_NO_CACHE.connectionString}`
	const client = postgres(connectionString, {
		// prepare: false,
		// idle_timeout: 20,
		// max_lifetime: 60 * 30,
		max: 5,
		fetch_types: false
	})
	const db = drizzle(client, { logger: true })
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
