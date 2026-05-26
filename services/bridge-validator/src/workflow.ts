import { type WorkflowEvent, type WorkflowStep, WorkflowEntrypoint } from "cloudflare:workers"
import { buildValidatorUrl, getValidatorSecrets, type ValidatorEnv } from "./env"
import { getValidatorRoute } from "./routes"
import { reportSlackFailure, reportSlackSuccess } from "./slack"
import type { BridgeValidationParams, BridgeValidationTimings, WorkflowPhaseTiming } from "./types"
import {
	type BridgeCommandCallbackPayload,
	type BridgeValidationSummary,
	BRIDGE_CLI_SPECIFIER,
	BridgeValidationError,
	buildBridgeCommandCallbackEventType,
	destroyBridgeSandbox,
	getBridgeSandbox,
	parseBridgeJson,
	readBridgeHistoryLog,
	startBridgeCommand,
	validateBridgeCompletion
} from "./validator"

const NO_STEP_RETRIES = {
	limit: 0,
	delay: "1 second"
} as const

const BRIDGE_COMMAND_START_STEP_TIMEOUT = "5 minutes"
const BRIDGE_COMMAND_CALLBACK_TIMEOUT = "2 hours"

const isBridgeValidationError = (error: unknown): error is BridgeValidationError =>
	error instanceof BridgeValidationError

const finishTimings = ({
	workflowStartedAtMs,
	steps,
	command,
	nowMs = Date.now()
}: {
	workflowStartedAtMs: number
	steps: WorkflowPhaseTiming[]
	command?: BridgeValidationTimings["command"]
	nowMs?: number
}): BridgeValidationTimings => ({
	workflowStartedAtMs,
	workflowFinishedAtMs: nowMs,
	totalDurationMs: Math.max(0, nowMs - workflowStartedAtMs),
	steps,
	...(command ? { command } : {})
})

export class BridgeValidationWorkflow extends WorkflowEntrypoint<
	ValidatorEnv,
	BridgeValidationParams
> {
	override async run(event: WorkflowEvent<BridgeValidationParams>, step: WorkflowStep) {
		const workflowStartedAtMs = Date.now()
		const stepTimings: WorkflowPhaseTiming[] = []
		const timed = async <T>(name: string, action: () => Promise<T>) => {
			const startedAtMs = Date.now()
			try {
				return await action()
			} finally {
				const finishedAtMs = Date.now()
				stepTimings.push({
					name,
					startedAtMs,
					finishedAtMs,
					durationMs: Math.max(0, finishedAtMs - startedAtMs)
				})
			}
		}
		const route = getValidatorRoute(event.payload.routeKey)
		const { walletPrivateKey, slackBotToken, slackChannelId, apiToken } = getValidatorSecrets(
			this.env
		)
		const sandboxId = `bridge-validator-${event.instanceId}`
		let sandboxCreated = false
		let failureReported = false

		try {
			await timed("record workflow start time", () =>
				step.do("record workflow start time", async () => workflowStartedAtMs)
			)
			sandboxCreated = true

			const callbackToken = await timed("create bridge callback token", () =>
				step.do("create bridge callback token", async () => crypto.randomUUID())
			)

			await timed("start bridge validation command", () =>
				step.do(
					"start bridge validation command",
					{ retries: NO_STEP_RETRIES, timeout: BRIDGE_COMMAND_START_STEP_TIMEOUT },
					async () =>
						startBridgeCommand({
							routeKey: route.key,
							sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId),
							walletPrivateKey,
							instanceId: event.instanceId,
							callbackToken,
							callbackUrl: buildValidatorUrl({
								env: this.env,
								path: "/bridge-callback"
							}),
							apiToken
						})
				)
			)

			const commandResult = await timed("wait for bridge command completion", () =>
				this.waitForCommandCallback({
					step,
					instanceId: event.instanceId,
					callbackToken
				})
			)

			if (commandResult.exitCode !== 0) {
				await timed("notify slack failure", () =>
					step.do("notify slack failure", async () =>
						reportSlackFailure({
							slackBotToken,
							slackChannelId,
							instanceId: event.instanceId,
							routeKey: route.key,
							cliVersion: BRIDGE_CLI_SPECIFIER,
							stage: "process",
							exitCode: commandResult.exitCode,
							stdout: commandResult.stdout,
							stderr: commandResult.stderr,
							message: "Bridge command exited non-zero",
							timings: finishTimings({
								workflowStartedAtMs,
								steps: stepTimings,
								command: commandResult.timing
							})
						})
					)
				)
				failureReported = true

				throw new Error(`Bridge validation failed for ${route.route}`)
			}

			let validationSummary: BridgeValidationSummary
			try {
				validationSummary = await this.validateCommandResult({
					step,
					sandboxId,
					commandResult,
					route,
					slackBotToken,
					slackChannelId,
					instanceId: event.instanceId,
					workflowStartedAtMs,
					stepTimings,
					timed
				})
			} catch (error) {
				failureReported = true
				throw error
			}

			await timed("report bridge validation success", () =>
				step.do("report bridge validation success", async () => {
					console.log(
						JSON.stringify({
							service: "bridge-validator",
							instanceId: event.instanceId,
							cliVersion: BRIDGE_CLI_SPECIFIER,
							timings: finishTimings({
								workflowStartedAtMs,
								steps: stepTimings,
								command: commandResult.timing
							}),
							...validationSummary
						})
					)

					await reportSlackSuccess({
						slackBotToken,
						slackChannelId,
						instanceId: event.instanceId,
						routeKey: route.key,
						cliVersion: BRIDGE_CLI_SPECIFIER,
						summary: validationSummary,
						timings: finishTimings({
							workflowStartedAtMs,
							steps: stepTimings,
							command: commandResult.timing
						})
					})
				})
			)

			return {
				route: validationSummary.route,
				cliVersion: BRIDGE_CLI_SPECIFIER,
				status: "completed",
				operationId: validationSummary.operationId,
				finalHash: validationSummary.finalHash,
				logPath: validationSummary.logPath,
				timings: finishTimings({
					workflowStartedAtMs,
					steps: stepTimings,
					command: commandResult.timing
				}),
				submittedTransactionCount: validationSummary.submittedTransactionCount,
				queueAdvanceCount: validationSummary.queueAdvanceCount,
				historyEventCount: validationSummary.historyEventCount
			}
		} catch (error) {
			if (!failureReported) {
				await timed("notify slack runtime failure", () =>
					step.do("notify slack runtime failure", async () =>
						reportSlackFailure({
							slackBotToken,
							slackChannelId,
							instanceId: event.instanceId,
							routeKey: route.key,
							cliVersion: BRIDGE_CLI_SPECIFIER,
							stage: "runtime",
							message: `Bridge validator runtime failed: ${
								error instanceof Error ? error.message : String(error)
							}`,
							timings: finishTimings({
								workflowStartedAtMs,
								steps: stepTimings
							})
						})
					)
				)
			}

			throw error
		} finally {
			if (sandboxCreated) {
				try {
					await timed("destroy bridge sandbox", () =>
						step.do("destroy bridge sandbox", async () =>
							destroyBridgeSandbox({
								sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId)
							})
						)
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

	private async waitForCommandCallback({
		step,
		instanceId,
		callbackToken
	}: {
		step: WorkflowStep
		instanceId: string
		callbackToken: string
	}) {
		const commandEvent = await step.waitForEvent<BridgeCommandCallbackPayload>(
			"wait for bridge command completion",
			{
				type: buildBridgeCommandCallbackEventType(callbackToken),
				timeout: BRIDGE_COMMAND_CALLBACK_TIMEOUT
			}
		)
		const commandResult = commandEvent.payload

		if (commandResult.instanceId !== instanceId || commandResult.token !== callbackToken) {
			throw new Error("Bridge command callback did not match this workflow instance")
		}

		return commandResult
	}

	private async validateCommandResult({
		step,
		sandboxId,
		commandResult,
		route,
		slackBotToken,
		slackChannelId,
		instanceId,
		workflowStartedAtMs,
		stepTimings,
		timed
	}: {
		step: WorkflowStep
		sandboxId: string
		commandResult: BridgeCommandCallbackPayload
		route: ReturnType<typeof getValidatorRoute>
		slackBotToken: string
		slackChannelId: string
		instanceId: string
		workflowStartedAtMs: number
		stepTimings: WorkflowPhaseTiming[]
		timed: <T>(name: string, action: () => Promise<T>) => Promise<T>
	}): Promise<BridgeValidationSummary> {
		let stage: BridgeValidationError["stage"] = "json"

		try {
			const result = await timed("parse bridge result", () =>
				step.do("parse bridge result", { retries: NO_STEP_RETRIES }, async () =>
					parseBridgeJson(commandResult.stdout)
				)
			)

			stage = "history"
			return await timed("validate bridge completion", () =>
				step.do("validate bridge completion", { retries: NO_STEP_RETRIES }, async () =>
					validateBridgeCompletion({
						route,
						result,
						historyLog: await readBridgeHistoryLog({
							sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId),
							logPath: result.log_path
						})
					})
				)
			)
		} catch (error) {
			await timed("notify slack validation failure", () =>
				step.do("notify slack validation failure", async () =>
					reportSlackFailure({
						slackBotToken,
						slackChannelId,
						instanceId,
						routeKey: route.key,
						cliVersion: BRIDGE_CLI_SPECIFIER,
						stage: isBridgeValidationError(error) ? error.stage : stage,
						stdout: isBridgeValidationError(error)
							? error.stdout || commandResult.stdout
							: commandResult.stdout,
						stderr: isBridgeValidationError(error)
							? error.stderr || commandResult.stderr
							: commandResult.stderr,
						message: error instanceof Error ? error.message : String(error),
						timings: finishTimings({
							workflowStartedAtMs,
							steps: stepTimings,
							command: commandResult.timing
						})
					})
				)
			)

			throw error
		}
	}
}
