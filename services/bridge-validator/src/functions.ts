import { Inngest } from "inngest"
import { readValidatorEnv } from "./config"
import { validatorRoutes, type BridgeValidatorRequest, type BridgeValidatorRoute } from "./routes"
import { buildSlackFailureMessage, postSlackFailure } from "./slack"
import { BridgeValidationError, validatePublishedBridge } from "./validator"

export const inngest = new Inngest({ id: "bridge-validator" })

const createValidatorFunction = (route: BridgeValidatorRoute) =>
	inngest.createFunction(
		{ id: route.functionId },
		{ event: route.eventName },
		async ({ event, step }) => {
			const env = readValidatorEnv()
			const mergedEnv = {
				...process.env,
				ZEKO_BRIDGE_MINA_PRIVATE_KEY: env.minaPrivateKey,
				ZEKO_BRIDGE_ZEKO_PRIVATE_KEY: env.zekoPrivateKey
			}

			try {
				const validation = await step.run("run-bridge", () =>
					validatePublishedBridge({
						route,
						cliVersion: (event.data as BridgeValidatorRequest).cliVersion,
						env: mergedEnv
					})
				)

				return {
					route: route.route,
					cliVersion: (event.data as BridgeValidatorRequest).cliVersion,
					status: validation.result.status,
					operationId: validation.result.operation_id
				}
			} catch (error) {
				const failure =
					error instanceof BridgeValidationError
						? error
						: new BridgeValidationError(
								error instanceof Error ? error.message : String(error),
								"command"
							)

				await step.run("notify-slack", () =>
					postSlackFailure({
						token: env.slackBotToken,
						channelId: env.slackChannelId,
						text: buildSlackFailureMessage({
							route,
							cliVersion: (event.data as BridgeValidatorRequest).cliVersion,
							stage: failure.stage,
							exitCode: failure.exitCode,
							stdout: failure.stdout,
							stderr: failure.stderr,
							message: failure.message
						})
					})
				)

				throw error
			}
		}
	)

export const functions = [
	createValidatorFunction(validatorRoutes.minaToZeko),
	createValidatorFunction(validatorRoutes.zekoToMina)
]
