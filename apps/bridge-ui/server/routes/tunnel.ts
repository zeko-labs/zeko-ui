export default defineEventHandler(async (event) => {
	try {
		const { env, request } = event.context.cloudflare
		const envelopeBytes = await request.arrayBuffer()
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
		await fetch(upstream_sentry_url, {
			method: "POST",
			body: envelopeBytes
		})
		return Response.json({}, { status: 200 })
	} catch (e) {
		console.error("error tunneling to sentry", e)
		return Response.json({ error: "error tunneling to sentry" }, { status: 500 })
	}
})
