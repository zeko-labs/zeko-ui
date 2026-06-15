import {
	type ControlAction,
	isControlRequestAllowed,
	type OpsEnv,
	resolveControlRequestOrigin,
	resolveControlNetwork,
	resolveRouteEnv,
	runIndexerControl
} from "../../utils/ops"

const allowedActions = new Set<ControlAction>(["start", "stop", "rebuild", "reset"])
type CloudflareContext = { env?: OpsEnv }

const readHeader = (headers: Record<string, string | string[] | undefined>, name: string) => {
	const value = headers[name]
	if (Array.isArray(value)) return value[0] ?? null
	return value ?? null
}

export default defineEventHandler(async (event) => {
	const headers = event.node.req.headers
	if (
		!isControlRequestAllowed({
			contentType: readHeader(headers, "content-type"),
			origin: readHeader(headers, "origin"),
			requestOrigin: resolveControlRequestOrigin(headers),
			secFetchSite: readHeader(headers, "sec-fetch-site")
		})
	) {
		setResponseStatus(event, 403)
		return { success: false, message: "Control requests must be same-origin JSON." }
	}

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
