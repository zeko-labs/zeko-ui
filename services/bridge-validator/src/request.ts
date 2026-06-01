import type { ValidatorEnv } from "./env"
import { getValidatorRoute, type BridgeValidatorRouteKey } from "./routes"
import { BRIDGE_VALIDATOR_SERVICE_INFO } from "./service-info"
import {
	buildBridgeSandboxIds,
	buildBridgeSandboxId,
	destroyBridgeSandbox,
	BRIDGE_STATUS_PATH,
	getBridgeCommandDiagnostics,
	getBridgeCommandStatus,
	getBridgeStatusSandbox,
	getBridgeSandbox
} from "./validator"

const STATUS_PROBE_TIMEOUT_MS = 2_000

const parseIncludeLogs = (url: URL) =>
	url.searchParams.get("logs") === "1" || url.searchParams.get("logs") === "true"

const parseSandboxTarget = (url: URL, instanceId: string) => {
	const sandboxId = url.searchParams.get("sandboxId")?.trim()
	if (sandboxId) {
		if (!buildBridgeSandboxIds({ instanceId }).includes(sandboxId)) {
			throw new Error("sandboxId must belong to the provided instanceId")
		}

		return sandboxId
	}

	const attemptText = url.searchParams.get("attempt")?.trim()
	if (!attemptText) {
		throw new Error("Missing sandbox target: provide attempt or sandboxId")
	}

	const attempt = Number(attemptText)
	if (!Number.isInteger(attempt) || attempt < 1) {
		throw new Error("attempt must be a positive integer")
	}

	return buildBridgeSandboxId({ instanceId, attempt })
}

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

	const sandboxId = parseSandboxTarget(url, instanceId)
	const sandbox = getBridgeStatusSandbox(env.Sandbox, sandboxId)
	const command = await getBridgeCommandStatus({
		sandbox,
		fileTimeoutMs: STATUS_PROBE_TIMEOUT_MS
	})

	return Response.json({
		ok: true,
		instanceId,
		sandboxId,
		command,
		...(parseIncludeLogs(url) ? { files: await getBridgeCommandDiagnostics({ sandbox }) } : {})
	})
}

const bridgeCleanup = async ({ url, env }: { url: URL; env: ValidatorEnv }) => {
	const instanceId = url.searchParams.get("instanceId")?.trim()
	if (!instanceId) {
		return badRequest("Missing instanceId")
	}

	const sandboxId = parseSandboxTarget(url, instanceId)
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

const parseManualRouteKey = async (request: Request): Promise<BridgeValidatorRouteKey> => {
	const fallback = new URL(request.url).searchParams.get("routeKey")
	const contentType = request.headers.get("content-type") ?? ""
	const body =
		request.method === "POST" && contentType.includes("application/json")
			? await request.json().catch(() => undefined)
			: undefined
	const routeKey =
		typeof body === "object" && body !== null && "routeKey" in body
			? String(body.routeKey)
			: fallback

	if (routeKey !== "mina-to-zeko" && routeKey !== "zeko-to-mina") {
		throw new Error("routeKey must be mina-to-zeko or zeko-to-mina")
	}

	return routeKey
}

const bridgeStart = async ({ request, env }: { request: Request; env: ValidatorEnv }) => {
	const routeKey = await parseManualRouteKey(request)
	const validation = {
		id: `bridge-validator-manual-${routeKey}-${Date.now()}`,
		params: {
			routeKey: getValidatorRoute(routeKey).key
		}
	}
	const workflow = await env.BRIDGE_VALIDATION_WORKFLOW.create(validation)
	const workflowId =
		typeof workflow === "object" && workflow !== null && "id" in workflow
			? String(workflow.id)
			: validation.id

	return Response.json({
		ok: true,
		workflow: {
			id: workflowId
		},
		validation
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

		if (request.method === "POST" && url.pathname === "/bridge-start") {
			return await bridgeStart({ request, env })
		}

		return Response.json(BRIDGE_VALIDATOR_SERVICE_INFO)
	} catch (error) {
		return badRequest(error instanceof Error ? error.message : String(error))
	}
}
