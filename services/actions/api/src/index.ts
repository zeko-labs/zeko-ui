import { createYoga } from "graphql-yoga"
import type { Context } from "./builder"
import { type CloudflareContext, checkDatabaseHealth, rc, useDatabase } from "./db"
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

export default {
	async fetch(request, env, context) {
		const url = new URL(request.url)

		if (url.pathname === "/health") {
			const cloudflare = { request, env, context }
			const dbHealth = await checkDatabaseHealth(cloudflare)

			const response = {
				status: dbHealth.healthy ? "healthy" : "unhealthy",
				timestamp: new Date().toISOString(),
				service: {
					name: "actions-api",
					environment: env.ENVIRONMENT || "unknown"
				},
				database: {
					status: dbHealth.healthy ? "up" : "down",
					latency_ms: Math.round(dbHealth.latency),
					...(dbHealth.error && { error: dbHealth.error })
				}
			}

			return Response.json(response, {
				status: dbHealth.healthy ? 200 : 503
			})
		}

		const cloudflare = { request, env, context }
		rc.set(request, { cloudflare })
		const response = await yoga(request, { cloudflare })
		const C = rc.get(request)
		if (C?.db) context.waitUntil(C.db[1].end())
		if (C?.noCacheDb) context.waitUntil(C.noCacheDb[1].end())
		rc.delete(request)
		return response
	}
} satisfies ExportedHandler<Env>
