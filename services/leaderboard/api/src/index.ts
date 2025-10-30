import { createYoga } from "graphql-yoga"
import type { Context } from "./builder"
import { type CloudflareContext, rc, useDatabase } from "./db"
import { schema } from "./graphql"

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

const TOTAL_SHARDS = 100

export default {
	async fetch(request, env, context) {
		const url = new URL(request.url)
		if (url.pathname === "/broadcast") {
			const auth = request.headers.get("Authorization")
			if (auth !== `Bearer ${env.AUTH_TOKEN}`) return new Response("Unauthorized", { status: 401 })
			const broadcastPromises = Array.from({ length: TOTAL_SHARDS }, async (_, shardId) => {
				const shardName = `distributor-${shardId}`
				const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
				const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

				const payload = {
					type: "LEADERBOARD_UPDATE",
					data: { message: "Scores updated", timestamp: Date.now() },
					timestamp: Date.now()
				} as const

				return distributorStub.broadcast(payload)
			})
			context.waitUntil(Promise.all(broadcastPromises))
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
