import { createOpsSnapshot, type OpsEnv, resolveOpsNetwork } from "../../utils/ops"

const getEventEnv = (event: { context: unknown }): OpsEnv => {
	const context = event.context as { cloudflare?: { env?: OpsEnv } }
	return context.cloudflare?.env ?? process.env
}

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	return createOpsSnapshot(resolveOpsNetwork(query.network), getEventEnv(event))
})
