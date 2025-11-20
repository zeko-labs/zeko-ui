import { bearer } from "@elysiajs/bearer"
import { cors } from "@elysiajs/cors"
import { Elysia, t } from "elysia"
import { createDatabase } from "./db"
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
