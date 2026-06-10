import { createOpsSnapshot, type OpsEnv, resolveOpsNetwork } from "../../utils/ops"

type CloudflareContext = { env?: OpsEnv }

export default defineEventHandler(async (event) => {
	const cloudflare = event.context.cloudflare as CloudflareContext | undefined
	if (!cloudflare?.env) {
		throw createError({
			statusCode: 500,
			statusMessage: "Missing Cloudflare env"
		})
	}
	const query = getQuery(event)
	return createOpsSnapshot(resolveOpsNetwork(query.network), cloudflare.env)
})
