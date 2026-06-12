import { createOpsSnapshot, type OpsEnv, resolveOpsNetwork, resolveRouteEnv } from "../../utils/ops"

type CloudflareContext = { env?: OpsEnv }

export default defineEventHandler(async (event) => {
	const cloudflare = event.context.cloudflare as CloudflareContext | undefined
	const env = resolveRouteEnv(cloudflare?.env)
	const query = getQuery(event)
	return createOpsSnapshot(resolveOpsNetwork(query.network), env)
})
