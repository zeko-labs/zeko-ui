import { createYoga } from "graphql-yoga"
import type { Context } from "./builder"
import { type CloudflareContext, checkDatabaseHealth, rc, useDatabase } from "./db"
import { schema } from "./graphql"

const yoga = createYoga<{ cloudflare: CloudflareContext }>({
	schema,
	healthCheckEndpoint: "live",
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

const releaseDb = ({ request, context }: { request: Request; context: ExecutionContext }) => {
	const C = rc.get(request)
	if (C?.db) context.waitUntil(C.db[1].end())
	if (C?.noCacheDb) context.waitUntil(C.noCacheDb[1].end())
	rc.delete(request)
}

export default {
	async fetch(request, env, context) {
		const url = new URL(request.url)
		const cloudflare = { request, env, context }
		rc.set(request, { cloudflare })

		if (url.pathname === "/health") {
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
			releaseDb({ request, context })
			return Response.json(response, { status: dbHealth.healthy ? 200 : 503 })
		}
		const response = await yoga(request, { cloudflare })
		releaseDb({ request, context })
		return response
	}
} satisfies ExportedHandler<Env>
