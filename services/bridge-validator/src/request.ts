import type { ValidatorEnv } from "./env"
import { BRIDGE_VALIDATOR_SERVICE_INFO } from "./service-info"
import {
	BRIDGE_CALLBACK_PATH,
	BRIDGE_COMMAND_CALLBACK_EVENT,
	BRIDGE_STATUS_PATH,
	getBridgeCommandDiagnostics,
	getBridgeCommandStatus,
	getBridgeSandbox,
	parseBridgeCommandCallbackPayload
} from "./validator"

const parseIncludeLogs = (url: URL) =>
	url.searchParams.get("logs") === "1" || url.searchParams.get("logs") === "true"

const badRequest = (error: string) =>
	Response.json(
		{
			ok: false,
			error
		},
		{ status: 400 }
	)

const bridgeStatus = async ({ url, env }: { url: URL; env: ValidatorEnv }) => {
	const instanceId = url.searchParams.get("instanceId")?.trim()
	if (!instanceId) {
		return badRequest("Missing instanceId")
	}

	const sandboxId = `bridge-validator-${instanceId}`
	const sandbox = getBridgeSandbox(env.Sandbox, sandboxId)

	return Response.json({
		ok: true,
		instanceId,
		sandboxId,
		command: await getBridgeCommandStatus({ sandbox }),
		...(parseIncludeLogs(url) ? { files: await getBridgeCommandDiagnostics({ sandbox }) } : {})
	})
}

const bridgeCallback = async ({ request, env }: { request: Request; env: ValidatorEnv }) => {
	const payload = parseBridgeCommandCallbackPayload(await request.json())
	const instance = await env.BRIDGE_VALIDATION_WORKFLOW.get(payload.instanceId)
	await instance.sendEvent({
		type: BRIDGE_COMMAND_CALLBACK_EVENT,
		payload
	})

	return Response.json({ ok: true })
}

export const handleBridgeValidatorRequest = async ({
	request,
	env
}: {
	request: Request
	env: ValidatorEnv
}): Promise<Response> => {
	const url = new URL(request.url)

	try {
		if (request.method === "POST" && url.pathname === BRIDGE_CALLBACK_PATH) {
			return await bridgeCallback({ request, env })
		}

		if (request.method === "GET" && url.pathname === BRIDGE_STATUS_PATH) {
			return await bridgeStatus({ url, env })
		}

		return Response.json(BRIDGE_VALIDATOR_SERVICE_INFO)
	} catch (error) {
		return badRequest(error instanceof Error ? error.message : String(error))
	}
}
