import { bearer } from "@elysiajs/bearer"
import { cors } from "@elysiajs/cors"
import { Elysia, t } from "elysia"
import { createDatabase } from "./db"
import { Indexer } from "./indexer"

const db = createDatabase()
const indexer = new Indexer(db)

const authToken = process.env.AUTH_TOKEN || "admin"

const ActionConfigSchema = t.Object({
	startBlock: t.Number(),
	endBlock: t.Number()
})

const PartialActionsConfigSchema = t.Partial(
	t.Object({
		deposit: ActionConfigSchema,
		faucet: ActionConfigSchema,
		liquidity: ActionConfigSchema,
		swap: ActionConfigSchema,
		withdrawal: ActionConfigSchema
	})
)

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
	.post(
		"/start",
		({ body, status }) => {
			const result = indexer.start(body)
			return status(result.success ? 200 : 500, result)
		},
		{
			body: t.Object({
				startingBlock: t.Optional(t.Number()),
				intervalSeconds: t.Optional(t.Number()),
				maxRetries: t.Optional(t.Number()),
				actions: t.Optional(PartialActionsConfigSchema)
			})
		}
	)
	.post("/stop", ({ status }) => {
		const result = indexer.stop()
		return status(result.success ? 200 : 500, result)
	})
	.post("/recalculate", async ({ status }) => {
		const result = await indexer.recalculate()
		return status(result.success ? 200 : 500, result)
	})
	.post(
		"/rebuild",
		async ({ status, body }) => {
			const result = await indexer.rebuild(body.fromBlock, body.actions)
			return status(result.success ? 200 : 500, result)
		},
		{
			body: t.Object({
				fromBlock: t.Optional(t.Number()),
				actions: t.Optional(PartialActionsConfigSchema)
			})
		}
	)

export type App = typeof server
