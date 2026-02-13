import { toWebRequest } from "h3"

type CloudflareContext = { env: Env }

export default defineEventHandler(async (event) => {
	try {
		const cloudflare = event.context.cloudflare as unknown as CloudflareContext | undefined
		const env = cloudflare?.env
		if (!env) {
			throw new Error("Missing Cloudflare env")
		}

		const request = toWebRequest(event)
		const envelopeBytes = await request.clone().arrayBuffer()
		const envelope = new TextDecoder().decode(envelopeBytes)
		const piece = envelope.split("\n")[0]
		if (!piece) {
			throw new Error("Invalid envelope: empty first line")
		}
		const header = JSON.parse(piece) as { dsn: string }
		const dsn = new URL(header.dsn)
		const project_id = dsn.pathname.replace("/", "")
		const configured_project_id = env.SENTRY_PROJECT_ID
		if (dsn.hostname !== env.SENTRY_HOST) {
			throw new Error(`Invalid sentry hostname: ${dsn.hostname}`)
		}
		if (!project_id || project_id !== configured_project_id) {
			throw new Error(`Invalid sentry project id: ${project_id}`)
		}
		const upstream_sentry_url = `https://${env.SENTRY_HOST}/api/${project_id}/envelope/`
		const response = await fetch(upstream_sentry_url, { method: "POST", body: envelopeBytes })
		return response
	} catch (e) {
		console.error("error tunneling to sentry", e)
		const message = e instanceof Error ? JSON.stringify(e) : "unknown error"
		return Response.json({ message }, { status: 500 })
	}
})
