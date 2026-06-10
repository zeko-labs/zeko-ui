import { readActionsIndexerToken, resolveOpsNetwork, type OpsEnv } from "../../utils/ops"

type CloudflareContext = { env?: OpsEnv }

export default defineEventHandler((event) => {
	const cloudflare = event.context.cloudflare as CloudflareContext | undefined
	if (!cloudflare?.env) {
		throw createError({
			statusCode: 500,
			statusMessage: "Missing Cloudflare env"
		})
	}

	const network = resolveOpsNetwork(getQuery(event).network)
	const token = readActionsIndexerToken(network, cloudflare.env)
	if (token === undefined) {
		throw createError({
			statusCode: 500,
			statusMessage: `${network.toUpperCase()}_ACTIONS_INDEXER_TOKEN or ACTIONS_INDEXER_TOKEN is required`
		})
	}

	return { token }
})
