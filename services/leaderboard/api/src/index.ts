import { createYoga } from "graphql-yoga"
import * as v from "valibot"
import type { BroadcastPayload } from "../module"
import type { Context } from "./builder"
import { type CloudflareContext, rc, useDatabase } from "./db"
import { schema } from "./graphql"

const BroadcastPayloadSchema = v.object({
	maxBlockHeight: v.pipe(v.number(), v.integer(), v.minValue(0)),
	hasNewEntries: v.boolean()
}) satisfies v.GenericSchema<BroadcastPayload>

const yoga = createYoga<{ cloudflare: CloudflareContext }>({
	schema,
	cors: (request) => ({
		origin: request.headers.get("Origin") ?? "localhost:4000",
		credentials: true,
		allowedHeaders: [request.headers.get("Access-Control-Request-Headers") ?? "Content-Type"],
		methods: ["*"],
		exposedHeaders: ["*"]
	}),
	context: ({ cloudflare }) => {
		const { env, context: cloudflareContext } = cloudflare
		return {
			env,
			cloudflareContext,
			database: useDatabase(cloudflare)
		} satisfies Context
	}
})

export default {
	async fetch(request, env, context) {
		const url = new URL(request.url)
		if (url.pathname === "/broadcast") {
			console.log("[/broadcast] Received broadcast request")
			const auth = request.headers.get("Authorization")
			if (auth !== `Bearer ${env.AUTH_TOKEN}`) {
				console.log("[/broadcast] Unauthorized request")
				return new Response("Unauthorized", { status: 401 })
			}

			const body = await request.json()
			const parseResult = v.safeParse(BroadcastPayloadSchema, body)

			if (!parseResult.success) {
				console.log("[/broadcast] Invalid payload:", parseResult.issues)
				return Response.json(
					{ error: "Invalid payload", issues: parseResult.issues },
					{ status: 400 }
				)
			}

			const { maxBlockHeight, hasNewEntries } = parseResult.output
			const timestamp = Date.now()

			const payload = {
				type: "LEADERBOARD_UPDATE",
				data: { maxBlockHeight, hasNewEntries },
				timestamp
			} as const

			console.log(
				"[/broadcast] Creating broadcast promises for",
				env.TOTAL_SHARDS,
				"shards",
				payload
			)
			const broadcastPromises = Array.from({ length: env.TOTAL_SHARDS }, (_, shardId) => {
				const shardName = `distributor-${shardId}`
				const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
				const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)
				return distributorStub.broadcast(payload)
			})

			context.waitUntil(
				Promise.all(broadcastPromises)
					.then((results) => {
						console.log("[/broadcast] All broadcasts completed successfully:", results)
					})
					.catch((error) => {
						console.error("[/broadcast] Broadcast failed:", error)
					})
			)

			return new Response("OK")
		}

		if (url.pathname === "/graphql") {
			const cloudflare = { request, env, context }
			rc.set(request, { cloudflare })
			const response = await yoga(request, { cloudflare })
			const C = rc.get(request)
			if (C?.db) context.waitUntil(C.db[1].end())
			if (C?.noCacheDb) context.waitUntil(C.noCacheDb[1].end())
			rc.delete(request)
			return response
		}
		return new Response("Not Found", { status: 404 })
	}
} satisfies ExportedHandler<Env>

export { DistributorDO, UserDo } from "./do"
