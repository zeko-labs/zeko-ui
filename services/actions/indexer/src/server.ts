import { bearer } from "@elysiajs/bearer"
import { cors } from "@elysiajs/cors"
import { node } from "@elysiajs/node"
import { Elysia, t } from "elysia"
import { checkDatabaseHealth, createDatabase } from "./db"
import { env } from "./env"
import { computeHealthStatus, createDatabaseHealthMonitor } from "./health"
import { Indexer } from "./indexer"

const db = createDatabase(env.DATABASE_URL)
const indexer = new Indexer(db)
const dbHealthMonitor = createDatabaseHealthMonitor({
	refreshIntervalMs: 10_000,
	check: async () => checkDatabaseHealth(db)
})
dbHealthMonitor.start()

const authorizeControlRequest = ({
	bearer,
	status
}: {
	bearer?: string
	status: (code: number, body: { success: false; message: string }) => unknown
}) => {
	if (bearer === env.AUTH_TOKEN) return
	return status(401, { success: false, message: "Unauthorized" })
}

const controlStatusCode = (result: { success: boolean; message?: string }): number => {
	if (result.success) return 200
	if (result.message === "A reset is already in progress") return 409
	return 500
}

const controlServer = new Elysia()
	.guard({
		beforeHandle: authorizeControlRequest
	})
	.get("/status", () => indexer.getStatus())
	.post("/start", async ({ status }) => {
		const result = await indexer.start()
		return status(controlStatusCode(result), result)
	})
	.post("/stop", async ({ status }) => {
		const result = await indexer.stop()
		return status(controlStatusCode(result), result)
	})
	.post("/reset", async ({ status }) => {
		const result = await indexer.reset()
		return status(controlStatusCode(result), result)
	})
	.post("/rebuild", async ({ status }) => {
		const result = await indexer.rebuild()
		return status(controlStatusCode(result), result)
	})
	.post(
		"/config",
		async ({ body, status }) => {
			const result = await indexer.setConfig({ intervalSeconds: body.intervalSeconds })
			return status(200, result)
		},
		{ body: t.Object({ intervalSeconds: t.Number() }) }
	)

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
	.use(controlServer)

export type App = typeof server
