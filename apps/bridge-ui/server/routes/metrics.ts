const ALLOWED_ORIGINS = [
	"https://bridge.zeko.io",
	"https://alpha.bridge.zeko.io",
	"http://localhost:3090"
]

export default defineEventHandler(async (event) => {
	try {
		const env = event.context.cloudflare.env as unknown as Env
		const origin = getHeader(event, "origin") ?? ""

		if (!ALLOWED_ORIGINS.includes(origin)) {
			return Response.json({ message: "Forbidden" }, { status: 403 })
		}

		const body = await readBody<{
			category?: string
			action?: string
			label?: string
			durationMs?: number
			amount?: number
			source?: string
			destination?: string
			success?: boolean
			walletAddress?: string
			userAgent?: string
			cpuCores?: number
			language?: string
			screenResolution?: string
			timestamp?: number
		}>(event)

		if (!body?.category || !body?.action) {
			return Response.json({ message: "Missing category or action" }, { status: 400 })
		}

		env.BRIDGE_METRICS.writeDataPoint({
			indexes: [body.category],
			blobs: [
				body.category,
				body.action,
				body.label ?? "",
				body.source ?? "",
				body.destination ?? "",
				body.userAgent ?? "",
				body.walletAddress ?? "",
				body.language ?? "",
				body.screenResolution ?? ""
			],
			doubles: [
				body.durationMs ?? 0,
				body.amount ?? 0,
				body.success === true ? 1 : body.success === false ? 0 : -1,
				body.timestamp ?? Date.now(),
				body.cpuCores ?? 0
			]
		})

		return Response.json({ ok: true }, { status: 200 })
	} catch (e) {
		console.error("error writing metric", e)
		const message = e instanceof Error ? e.message : "unknown error"
		return Response.json({ message }, { status: 500 })
	}
})
