export default defineEventHandler(async (event) => {
	try {
		const { env } = event.context.cloudflare

		const request = toWebRequest(event)
		const envelopeBytes = await request.clone().arrayBuffer()
		const envelope = new TextDecoder().decode(envelopeBytes)
		const piece = envelope.split("\n")[0]
		const header = JSON.parse(piece) as { dsn: string }
		const dsn = new URL(header.dsn)
		const project_id = dsn.pathname?.replace("/", "")
		if (dsn.hostname !== env.SENTRY_HOST) {
			throw new Error(`Invalid sentry hostname: ${dsn.hostname}`)
		}
		if (!project_id || !env.SENTRY_PROJECT_IDS.includes(project_id)) {
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
