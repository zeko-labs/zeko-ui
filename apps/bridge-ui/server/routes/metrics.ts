import * as v from "valibot"
import { MetricEventSchema } from "../../machines/metrics.schema"

const ALLOWED_ORIGINS = [
	"https://bridge.zeko.io",
	"https://testnet.bridge.zeko.io",
	"https://alpha.bridge.zeko.io",
	...(process.dev ? ["http://localhost:3090"] : [])
]

/**
 * POST /metrics - Bridge analytics ingestion endpoint.
 *
 * Accepts metric events from the bridge UI and writes to Cloudflare Analytics Engine.
 * Validates origin, schema, and stores data in BRIDGE_METRICS dataset.
 *
 * Storage format (Analytics Engine):
 * - index[0]: category (for filtering)
 * - blobs: [category, action, label, source, destination, userAgent, walletAddress, language, screenResolution]
 * - doubles: [durationMs, amount, success(1/0/-1), timestamp, cpuCores]
 */
export default defineEventHandler(async (event) => {
	try {
		const env = event.context.cloudflare.env as unknown as Env
		const origin = getHeader(event, "origin") ?? ""

		// Allow same-origin requests (no origin header) or explicit origins
		if (origin && !ALLOWED_ORIGINS.includes(origin)) {
			return Response.json({ message: "Forbidden" }, { status: 403 })
		}

		const body = await readBody(event)
		const result = v.safeParse(MetricEventSchema, body)

		if (!result.success) {
			return Response.json({ message: "Invalid payload" }, { status: 400 })
		}

		const data = result.output

		env.BRIDGE_METRICS.writeDataPoint({
			indexes: [data.category],
			blobs: [
				data.category,
				data.action,
				data.label ?? "",
				data.source ?? "",
				data.destination ?? "",
				data.userAgent ?? "",
				data.walletAddress ?? "",
				data.language ?? "",
				data.screenResolution ?? ""
			],
			doubles: [
				data.durationMs ?? 0,
				data.amount ?? 0,
				data.success === true ? 1 : data.success === false ? 0 : -1,
				data.timestamp ?? Date.now(),
				data.cpuCores ?? 0
			]
		})

		return Response.json({ ok: true }, { status: 200 })
	} catch (e) {
		console.error("error writing metric", e)
		const message = e instanceof Error ? e.message : "unknown error"
		return Response.json({ message }, { status: 500 })
	}
})
