import { Sandbox as SandboxContainer } from "@cloudflare/sandbox"
import { type WorkflowEvent, type WorkflowStep, WorkflowEntrypoint } from "cloudflare:workers"
import { getValidatorRoute } from "./routes"
import { BRIDGE_VALIDATOR_SERVICE_INFO } from "./service-info"
import { buildSlackFailureMessage, buildSlackSuccessMessage, postSlackMessage } from "./slack"
import type { BridgeCommandCallbackPayload, BridgeValidationParams } from "./types"
import {
	type BridgeValidationSummary,
	BRIDGE_CLI_SPECIFIER,
	BridgeValidationError,
	buildScheduledValidations,
	destroyBridgeSandbox,
	getBridgeCommandStatus,
	getBridgeSandbox,
	parseBridgeJson,
	readBridgeHistoryLog,
	BRIDGE_CALLBACK_PATH,
	BRIDGE_STATUS_PATH,
	startBridgeCommand,
	validateBridgeCompletion
} from "./validator"

const NO_STEP_RETRIES = {
	limit: 0,
	delay: "1 second"
} as const

const BRIDGE_COMMAND_START_STEP_TIMEOUT = "5 minutes"
const BRIDGE_COMMAND_CALLBACK_EVENT = "bridge-command-complete"
const BRIDGE_COMMAND_CALLBACK_TIMEOUT = "2 hours"

type ValidatorSecretKey = "WALLET_PRIVATE_KEY" | "SLACK_BOT_TOKEN" | "SLACK_CHANNEL_ID"

const normalizeSecret = (value: string | undefined) => {
	const trimmed = value?.trim()
	if (!trimmed) {
		return ""
	}

	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1).trim()
	}

	return trimmed
}

const requireSecret = (env: Env, key: ValidatorSecretKey) => {
	const value = normalizeSecret(env[key])
	if (!value) {
		throw new Error(`Missing required environment variable ${key}`)
	}

	return value
}

const isBridgeValidationError = (error: unknown): error is BridgeValidationError =>
	error instanceof BridgeValidationError

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

const parseBridgeCommandCallbackPayload = (value: unknown): BridgeCommandCallbackPayload => {
	if (!isRecord(value)) {
		throw new Error("Bridge command callback payload must be an object")
	}

	const { instanceId, token, exitCode, stdout, stderr } = value
	if (
		typeof instanceId !== "string" ||
		typeof token !== "string" ||
		typeof exitCode !== "number" ||
		typeof stdout !== "string" ||
		typeof stderr !== "string"
	) {
		throw new Error("Bridge command callback payload has invalid fields")
	}

	return { instanceId, token, exitCode, stdout, stderr }
}

const notifySlackFailure = async ({
	slackBotToken,
	slackChannelId,
	instanceId,
	routeKey,
	stage,
	exitCode,
	stdout,
	progress,
	message
}: {
	slackBotToken: string
	slackChannelId: string
	instanceId: string
	routeKey: BridgeValidationParams["routeKey"]
	stage: string
	exitCode?: number
	stdout?: string
	progress?: string
	message: string
}) => {
	await postSlackMessage({
		token: slackBotToken,
		channelId: slackChannelId,
		text: buildSlackFailureMessage({
			instanceId,
			route: getValidatorRoute(routeKey),
			cliVersion: BRIDGE_CLI_SPECIFIER,
			stage,
			exitCode,
			stdout,
			stderr: progress,
			message
		})
	})
}

const reportSlackFailure = async (payload: Parameters<typeof notifySlackFailure>[0]) => {
	try {
		await notifySlackFailure(payload)
	} catch (error) {
		console.error(
			`Bridge validator failure notification failed: ${
				error instanceof Error ? error.message : String(error)
			}`
		)
	}
}

const reportSlackSuccess = async ({
	slackBotToken,
	slackChannelId,
	instanceId,
	routeKey,
	summary
}: {
	slackBotToken: string
	slackChannelId: string
	instanceId: string
	routeKey: BridgeValidationParams["routeKey"]
	summary: BridgeValidationSummary
}) => {
	try {
		await postSlackMessage({
			token: slackBotToken,
			channelId: slackChannelId,
			text: buildSlackSuccessMessage({
				instanceId,
				route: getValidatorRoute(routeKey),
				cliVersion: BRIDGE_CLI_SPECIFIER,
				summary
			})
		})
	} catch (error) {
		console.error(
			`Bridge validator success notification failed: ${
				error instanceof Error ? error.message : String(error)
			}`
		)
	}
}

export class BridgeValidationWorkflow extends WorkflowEntrypoint<Env, BridgeValidationParams> {
	override async run(event: WorkflowEvent<BridgeValidationParams>, step: WorkflowStep) {
		const route = getValidatorRoute(event.payload.routeKey)
		const walletPrivateKey = requireSecret(this.env, "WALLET_PRIVATE_KEY")
		const slackBotToken = requireSecret(this.env, "SLACK_BOT_TOKEN")
		const slackChannelId = requireSecret(this.env, "SLACK_CHANNEL_ID")
		const sandboxId = `bridge-validator-${event.instanceId}`
		let runtime:
			| {
					sandboxId: string
			  }
			| undefined
		let failureReported = false

		try {
			await step.do("record workflow start time", async () => Date.now())
			runtime = { sandboxId }

			const callbackToken = await step.do("create bridge callback token", async () =>
				crypto.randomUUID()
			)

			await step.do(
				"start bridge validation command",
				{ retries: NO_STEP_RETRIES, timeout: BRIDGE_COMMAND_START_STEP_TIMEOUT },
				async () =>
					startBridgeCommand({
						routeKey: route.key,
						sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId),
						walletPrivateKey,
						instanceId: event.instanceId,
						callbackToken
					})
			)

			const commandEvent = await step.waitForEvent<BridgeCommandCallbackPayload>(
				"wait for bridge command completion",
				{
					type: BRIDGE_COMMAND_CALLBACK_EVENT,
					timeout: BRIDGE_COMMAND_CALLBACK_TIMEOUT
				}
			)
			const commandResult = commandEvent.payload

			if (commandResult.instanceId !== event.instanceId || commandResult.token !== callbackToken) {
				throw new Error("Bridge command callback did not match this workflow instance")
			}

			if (commandResult.exitCode !== 0) {
				console.error(
					JSON.stringify({
						service: "bridge-validator",
						instanceId: event.instanceId,
						route: route.route,
						cliVersion: BRIDGE_CLI_SPECIFIER,
						stage: "process",
						exitCode: commandResult.exitCode,
						stdout: commandResult.stdout,
						stderr: commandResult.stderr
					})
				)

				await step.do("notify slack failure", async () =>
					reportSlackFailure({
						slackBotToken,
						slackChannelId,
						instanceId: event.instanceId,
						routeKey: route.key,
						stage: "process",
						exitCode: commandResult.exitCode,
						stdout: commandResult.stdout,
						progress: commandResult.stderr,
						message: "Bridge command exited non-zero"
					})
				)
				failureReported = true

				throw new Error(`Bridge validation failed for ${route.route}`)
			}

			let validationSummary: BridgeValidationSummary

			try {
				const result = await step.do(
					"parse bridge result",
					{ retries: NO_STEP_RETRIES },
					async () => parseBridgeJson(commandResult.stdout)
				)

				validationSummary = await step.do(
					"validate bridge completion",
					{ retries: NO_STEP_RETRIES },
					async () =>
						validateBridgeCompletion({
							route,
							result,
							historyLog: await readBridgeHistoryLog({
								sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId),
								logPath: result.log_path
							})
						})
				)
			} catch (error) {
				if (isBridgeValidationError(error)) {
					await step.do("notify slack validation failure", async () =>
						reportSlackFailure({
							slackBotToken,
							slackChannelId,
							instanceId: event.instanceId,
							routeKey: route.key,
							stage: error.stage,
							progress: error.stderr || commandResult.stderr,
							stdout: error.stdout || commandResult.stdout,
							message: error.message
						})
					)
					failureReported = true
				}

				throw error
			}

			await step.do("report bridge validation success", async () => {
				console.log(
					JSON.stringify({
						service: "bridge-validator",
						instanceId: event.instanceId,
						cliVersion: BRIDGE_CLI_SPECIFIER,
						...validationSummary
					})
				)

				await reportSlackSuccess({
					slackBotToken,
					slackChannelId,
					instanceId: event.instanceId,
					routeKey: route.key,
					summary: validationSummary
				})
			})

			return {
				route: validationSummary.route,
				cliVersion: BRIDGE_CLI_SPECIFIER,
				status: "completed",
				operationId: validationSummary.operationId,
				finalHash: validationSummary.finalHash,
				logPath: validationSummary.logPath,
				submittedTransactionCount: validationSummary.submittedTransactionCount,
				queueAdvanceCount: validationSummary.queueAdvanceCount,
				historyEventCount: validationSummary.historyEventCount
			}
		} catch (error) {
			if (!failureReported) {
				await step.do("notify slack runtime failure", async () =>
					reportSlackFailure({
						slackBotToken,
						slackChannelId,
						instanceId: event.instanceId,
						routeKey: route.key,
						stage: "runtime",
						message: `Bridge validator runtime failed: ${
							error instanceof Error ? error.message : String(error)
						}`
					})
				)
			}

			throw error
		} finally {
			if (runtime) {
				const sandboxIdToDestroy = runtime.sandboxId
				try {
					await step.do("destroy bridge sandbox", async () =>
						destroyBridgeSandbox({
							sandbox: getBridgeSandbox(this.env.Sandbox, sandboxIdToDestroy)
						})
					)
				} catch (error) {
					console.error(
						`Bridge validator sandbox cleanup failed: ${
							error instanceof Error ? error.message : String(error)
						}`
					)
				}
			}
		}
	}
}

export { SandboxContainer as Sandbox }

const worker: ExportedHandler<Env> = {
	async fetch(request, env) {
		const url = new URL(request.url)
		if (request.method === "POST" && url.pathname === BRIDGE_CALLBACK_PATH) {
			try {
				const payload = parseBridgeCommandCallbackPayload(await request.json())
				const instance = await env.BRIDGE_VALIDATION_WORKFLOW.get(payload.instanceId)
				await instance.sendEvent({
					type: BRIDGE_COMMAND_CALLBACK_EVENT,
					payload
				})

				return Response.json({ ok: true })
			} catch (error) {
				return Response.json(
					{
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					},
					{ status: 400 }
				)
			}
		}

		if (request.method === "GET" && url.pathname === BRIDGE_STATUS_PATH) {
			const instanceId = url.searchParams.get("instanceId")?.trim()
			if (!instanceId) {
				return Response.json(
					{
						ok: false,
						error: "Missing instanceId"
					},
					{ status: 400 }
				)
			}

			return Response.json({
				ok: true,
				instanceId,
				sandboxId: `bridge-validator-${instanceId}`,
				command: await getBridgeCommandStatus({
					sandbox: getBridgeSandbox(env.Sandbox, `bridge-validator-${instanceId}`)
				})
			})
		}

		return Response.json(BRIDGE_VALIDATOR_SERVICE_INFO)
	},

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		const validations = buildScheduledValidations({
			scheduledTime: controller.scheduledTime
		})

		for (const validation of validations) {
			ctx.waitUntil(env.BRIDGE_VALIDATION_WORKFLOW.create(validation))
		}
	}
} satisfies ExportedHandler<Env>

export default worker

export * from "./routes"
export * from "./service-info"
export * from "./slack"
export * from "./types"
export * from "./validator"
export * from "./runtime"
