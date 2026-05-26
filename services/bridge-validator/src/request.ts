import type { ValidatorEnv } from "./env"
import { BRIDGE_VALIDATOR_SERVICE_INFO } from "./service-info"
import {
	destroyBridgeSandbox,
	BRIDGE_STATUS_PATH,
	getBridgeCommandDiagnostics,
	getBridgeCommandStatus,
	getBridgeStatusSandbox,
	getBridgeSandbox
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
	const sandbox = getBridgeStatusSandbox(env.Sandbox, sandboxId)

	return Response.json({
		ok: true,
		instanceId,
		sandboxId,
		command: await getBridgeCommandStatus({ sandbox }),
		...(parseIncludeLogs(url) ? { files: await getBridgeCommandDiagnostics({ sandbox }) } : {})
	})
}

const bridgeCleanup = async ({ url, env }: { url: URL; env: ValidatorEnv }) => {
	const instanceId = url.searchParams.get("instanceId")?.trim()
	if (!instanceId) {
		return badRequest("Missing instanceId")
	}

	const sandboxId = `bridge-validator-${instanceId}`
	await destroyBridgeSandbox({
		sandbox: getBridgeSandbox(env.Sandbox, sandboxId)
	})

	return Response.json({
		ok: true,
		instanceId,
		sandboxId,
		cleanup: "destroyed"
	})
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
		if (request.method === "GET" && url.pathname === BRIDGE_STATUS_PATH) {
			return await bridgeStatus({ url, env })
		}

		if (request.method === "POST" && url.pathname === "/bridge-cleanup") {
			return await bridgeCleanup({ url, env })
		}

		return Response.json(BRIDGE_VALIDATOR_SERVICE_INFO)
	} catch (error) {
		return badRequest(error instanceof Error ? error.message : String(error))
	}
}
