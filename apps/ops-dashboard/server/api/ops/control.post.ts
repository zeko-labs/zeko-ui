import {
	type ControlAction,
	type OpsEnv,
	resolveOpsNetwork,
	runIndexerControl
} from "../../utils/ops"

const allowedActions = new Set<ControlAction>(["start", "stop", "rebuild", "reset"])
type CloudflareContext = { env?: OpsEnv }

export default defineEventHandler(async (event) => {
	const cloudflare = event.context.cloudflare as CloudflareContext | undefined
	if (!cloudflare?.env) {
		throw createError({
			statusCode: 500,
			statusMessage: "Missing Cloudflare env"
		})
	}
	const body = (await readBody(event)) as { action?: unknown; network?: unknown }
	const action = typeof body.action === "string" ? body.action : ""
	const network = resolveOpsNetwork(body.network)

	if (!allowedActions.has(action as ControlAction)) {
		setResponseStatus(event, 400)
		return { success: false, message: "Unsupported control action" }
	}

	try {
		const result = await runIndexerControl(action as ControlAction, network, cloudflare.env)
		return { success: true, action, network, result }
	} catch (error) {
		setResponseStatus(event, 502)
		return {
			success: false,
			action,
			network,
			message: error instanceof Error ? error.message : String(error)
		}
	}
})
