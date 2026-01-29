import { bearer } from "@elysiajs/bearer"
import { cors } from "@elysiajs/cors"
import { Elysia, t } from "elysia"
import { checkDatabaseHealth, createDatabase } from "./db"
import { env } from "./env"
import { Indexer } from "./indexer"

const db = createDatabase(env.DATABASE_URL)
const indexer = new Indexer(db)

const authToken = env.AUTH_TOKEN

export const server = new Elysia()
	.use(bearer())
	.use(
		cors({
			origin: "*",
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Authorization", "Content-Type"]
		})
	)
	.get("/health", async ({ set }) => {
		const dbHealth = await checkDatabaseHealth(db)
		const indexerStatus = indexer.getStatus()

		const overallHealthy =
			dbHealth.healthy && indexerStatus.isRunning && indexerStatus.consecutiveErrors < 5

		const response = {
			status: overallHealthy ? "healthy" : dbHealth.healthy ? "degraded" : "unhealthy",
			timestamp: new Date().toISOString(),
			service: {
				name: "actions-indexer",
				environment: env.ENVIRONMENT || "unknown"
			},
			database: {
				status: dbHealth.healthy ? "up" : "down",
				latency_ms: Math.round(dbHealth.latency),
				...(dbHealth.error && { error: dbHealth.error })
			},
			indexer: {
				status: indexerStatus.isRunning ? "running" : "stopped",
				lastFetchedBlock: indexerStatus.lastFetchedBlock,
				consecutiveErrors: indexerStatus.consecutiveErrors
			}
		}

		set.status = overallHealthy ? 200 : 503
		return response
	})
	.guard({
		beforeHandle: ({ bearer, status }) => {
			if (bearer !== authToken) return status(401, { success: false, message: "Unauthorized" })
		}
	})
	.get("/status", () => indexer.getStatus())
	.post("/start", ({ status }) => {
		const result = indexer.start()
		return status(result.success ? 200 : 500, result)
	})
	.post("/stop", ({ status }) => {
		const result = indexer.stop()
		return status(result.success ? 200 : 500, result)
	})
	.post("/rebuild", async ({ status }) => {
		const result = await indexer.rebuild()
		return status(result.success ? 200 : 500, result)
	})
	.post(
		"/config",
		({ body, status }) => {
			const result = indexer.setConfig({ intervalSeconds: body.intervalSeconds })
			return status(200, result)
		},
		{ body: t.Object({ intervalSeconds: t.Number() }) }
	)

export type App = typeof server
