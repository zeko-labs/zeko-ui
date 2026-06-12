import {
	type ControlAction,
	type OpsEnv,
	resolveControlNetwork,
	resolveRouteEnv,
	runIndexerControl
} from "../../utils/ops"

const allowedActions = new Set<ControlAction>(["start", "stop", "rebuild", "reset"])
type CloudflareContext = { env?: OpsEnv }

export default defineEventHandler(async (event) => {
	const cloudflare = event.context.cloudflare as CloudflareContext | undefined
	const env = resolveRouteEnv(cloudflare?.env)
	const body = (await readBody(event)) as { action?: unknown; network?: unknown }
	const action = typeof body.action === "string" ? body.action : ""

	if (!allowedActions.has(action as ControlAction)) {
		setResponseStatus(event, 400)
		return { success: false, message: "Unsupported control action" }
	}

	let network: "mainnet" | "testnet"
	try {
		network = resolveControlNetwork(body.network)
	} catch (error) {
		setResponseStatus(event, 400)
		return {
			success: false,
			action,
			message: error instanceof Error ? error.message : String(error)
		}
	}

	try {
		const result = await runIndexerControl(action as ControlAction, network, env)
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
