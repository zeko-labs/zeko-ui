import { bearer } from "@elysiajs/bearer"
import { cors } from "@elysiajs/cors"
import { node } from "@elysiajs/node"
import { Elysia, t } from "elysia"
import { runActionProcessing } from "./action-processing/runtime"
import { generateSyntheticArchiveBlocks } from "./benchmark/action-processing-synthetic"
import { checkDatabaseHealth, createDatabase } from "./db"
import { env } from "./env"
import { computeHealthStatus, createDatabaseHealthMonitor } from "./health"
import { Indexer } from "./indexer"

const db = createDatabase(env.DATABASE_URL)
const indexer = new Indexer(db)
const testActionProcessingBlocks =
	env.ENVIRONMENT === "test"
		? generateSyntheticArchiveBlocks({
				blockCount: 120,
				actionsPerBlock: 12,
				fieldsPerAction: 6,
				seed: 42
			})
		: null
const dbHealthMonitor = createDatabaseHealthMonitor({
	refreshIntervalMs: 10_000,
	check: async () => checkDatabaseHealth(db)
})
dbHealthMonitor.start()

const authToken = env.AUTH_TOKEN

export const server = new Elysia({
	adapter: node()
})
	.use(bearer())
	.use(
		cors({
			origin: "*",
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Authorization", "Content-Type"]
		})
	)
	.get("/health", ({ set }) => {
		const result = computeHealthStatus({
			now: Date.now(),
			dbHealth: dbHealthMonitor.getSnapshot(),
			indexerStatus: indexer.getStatus(),
			staleAfterMs: 60_000,
			environment: env.ENVIRONMENT || "unknown"
		})

		set.status = result.httpStatus
		return result.response
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
	.post("/reset", async ({ status }) => {
		const result = await indexer.reset()
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
	.post(
		"/test/action-processing",
		async ({ body, status }) => {
			if (env.ENVIRONMENT !== "test") {
				return status(404, { success: false, message: "Not found" })
			}

			const startedAt = performance.now()
			const blocks =
				body.blockCount && body.actionsPerBlock && body.fieldsPerAction
					? generateSyntheticArchiveBlocks({
							blockCount: body.blockCount,
							actionsPerBlock: body.actionsPerBlock,
							fieldsPerAction: body.fieldsPerAction,
							seed: body.seed
						})
					: testActionProcessingBlocks

			if (!blocks) {
				return status(500, { success: false, message: "Test workload is unavailable" })
			}

			const result = await runActionProcessing({
				blocks,
				preferWorker: true,
				workerThreads: body.workerThreads,
				fallbackToMain: false
			})

			return status(200, {
				success: true,
				strategy: result.stats.strategy,
				events: result.events.length,
				totalMs: result.stats.totalMs,
				elapsedMs: performance.now() - startedAt
			})
		},
		{
			body: t.Object({
				blockCount: t.Optional(t.Number()),
				actionsPerBlock: t.Optional(t.Number()),
				fieldsPerAction: t.Optional(t.Number()),
				seed: t.Optional(t.Number()),
				workerThreads: t.Optional(t.Number())
			})
		}
	)

export type App = typeof server
