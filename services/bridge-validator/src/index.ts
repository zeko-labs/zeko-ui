import { Sandbox as SandboxContainer } from "@cloudflare/sandbox"
import { hasValidBearerToken, isValidatorEnabled, type ValidatorEnv } from "./env"
import { handleBridgeValidatorRequest } from "./request"
import { buildScheduledValidations } from "./validator"
import { BridgeValidationWorkflow } from "./workflow"

export { SandboxContainer as Sandbox, BridgeValidationWorkflow }

const unauthorized = () =>
	Response.json(
		{
			ok: false,
			error: "Unauthorized"
		},
		{
			status: 401,
			headers: {
				"www-authenticate": "Bearer"
			}
		}
	)

const worker: ExportedHandler<ValidatorEnv> = {
	async fetch(request, env) {
		if (!hasValidBearerToken({ request, env })) {
			return unauthorized()
		}

		return handleBridgeValidatorRequest({ request, env })
	},

	async scheduled(controller, env, ctx) {
		if (!isValidatorEnabled(env)) {
			return
		}

		for (const validation of buildScheduledValidations({
			scheduledTime: controller.scheduledTime
		})) {
			ctx.waitUntil(env.BRIDGE_VALIDATION_WORKFLOW.create(validation))
		}
	}
} satisfies ExportedHandler<ValidatorEnv>

export default worker

export * from "./env"
export * from "./request"
export * from "./routes"
export * from "./runtime"
export * from "./service-info"
export * from "./slack"
export * from "./types"
export * from "./validator"
export * from "./workflow"
