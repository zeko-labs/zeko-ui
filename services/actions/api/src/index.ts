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

export default {
	async fetch(request, env, context) {
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
