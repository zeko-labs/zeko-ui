import { type WorkflowEvent, type WorkflowStep, WorkflowEntrypoint } from "cloudflare:workers"
import { getSourceBuildConfig, getValidatorSecrets, type ValidatorEnv } from "./env"
import { getValidatorRoute } from "./routes"
import { reportSlackFailure, reportSlackSuccess } from "./slack"
import type { BridgeValidationParams, BridgeValidationTimings, WorkflowPhaseTiming } from "./types"
import {
	type BridgeCommandCallbackPayload,
	type BridgeCommandDiagnostics,
	type BridgeCommandStatus,
	type BridgeValidationSummary,
	BRIDGE_CLI_SPECIFIER,
	BRIDGE_COMMAND_PROCESS_ID,
	BRIDGE_SANDBOX_START_LAUNCH_TIMEOUT_MS,
	BRIDGE_SANDBOX_START_ATTEMPT_TIMEOUT_MS,
	BRIDGE_SANDBOX_START_ATTEMPTS,
	BridgeValidationError,
	buildBridgeSandboxId,
	describeBridgeCommandFailure,
	destroyBridgeSandbox,
	getBridgeCommandDiagnosticTails,
	getBridgeCommandDiagnostics,
	getBridgeCommandOutput,
	getBridgeCommandStatus,
	getBridgeSandbox,
	parseBridgeJson,
	prepareBridgeSandbox,
	readBridgeHistoryLog,
	startBridgeCommand,
	stopBridgeCommand,
	validateBridgeCompletion
} from "./validator"
import {
	BRIDGE_COMMAND_INITIAL_POLL_INTERVAL_MS,
	BRIDGE_COMMAND_POLL_INTERVAL_MS,
	WORKFLOW_HARD_TIMEOUT_MS
} from "./runtime"

const NO_STEP_RETRIES = {
	limit: 0,
	delay: "1 second"
} as const

const BRIDGE_COMMAND_START_ATTEMPT_STEP_TIMEOUT = "3 minutes"
const BRIDGE_SANDBOX_PREPARE_STEP_TIMEOUT = "15 minutes"
const SANDBOX_CONTROL_STEP_TIMEOUT = "2 minutes"
const NOTIFICATION_STEP_TIMEOUT = "2 minutes"
const CLEANUP_STEP_TIMEOUT = "2 minutes"
const SANDBOX_CONTROL_STEP_OPTIONS = {
	retries: NO_STEP_RETRIES,
	timeout: SANDBOX_CONTROL_STEP_TIMEOUT
} as const

const NOTIFICATION_STEP_OPTIONS = {
	retries: NO_STEP_RETRIES,
	timeout: NOTIFICATION_STEP_TIMEOUT
} as const

const CLEANUP_STEP_OPTIONS = {
	retries: NO_STEP_RETRIES,
	timeout: CLEANUP_STEP_TIMEOUT
} as const

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
		let workflowStartedAtMs = Date.now()
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
		const { walletPrivateKey, walletPublicKey, slackBotToken, slackChannelId } =
			getValidatorSecrets(this.env)
		let sandboxId: string | undefined
		let failureReported = false

		try {
			workflowStartedAtMs = await timed("record workflow start time", () =>
				step.do("record workflow start time", async () => Date.now())
			)

			const startedCommand = await this.startCommandInFreshSandbox({
				step,
				timed,
				instanceId: event.instanceId,
				routeKey: route.key,
				walletPrivateKey,
				githubToken: this.env.GITHUB_TOKEN,
				sourceBuild: getSourceBuildConfig(this.env)
			})
			sandboxId = startedCommand.sandboxId
			const selectedSandboxId = startedCommand.sandboxId

			const commandResult = await timed("wait for bridge command completion", () =>
				this.waitForCommandCompletion({
					step,
					instanceId: event.instanceId,
					sandboxId: selectedSandboxId,
					startedAtMs: workflowStartedAtMs
				})
			)

			if (commandResult.exitCode !== 0) {
				await timed("notify slack failure", () =>
					step.do("notify slack failure", NOTIFICATION_STEP_OPTIONS, async () =>
						reportSlackFailure({
							slackBotToken,
							slackChannelId,
							instanceId: event.instanceId,
							routeKey: route.key,
							cliVersion: BRIDGE_CLI_SPECIFIER,
							walletPublicKey,
							stage: "process",
							exitCode: commandResult.exitCode,
							stdout: commandResult.stdout,
							stderr: commandResult.stderr,
							message: describeBridgeCommandFailure(commandResult),
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
					sandboxId: selectedSandboxId,
					commandResult,
					route,
					slackBotToken,
					slackChannelId,
					walletPublicKey,
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
				step.do("report bridge validation success", NOTIFICATION_STEP_OPTIONS, async () => {
					console.log(
						JSON.stringify({
							service: "bridge-validator",
							instanceId: event.instanceId,
							cliVersion: BRIDGE_CLI_SPECIFIER,
							walletPublicKey,
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
						walletPublicKey,
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
				const stage = isBridgeValidationError(error) ? error.stage : "runtime"
				await timed("notify slack runtime failure", () =>
					step.do("notify slack runtime failure", NOTIFICATION_STEP_OPTIONS, async () =>
						reportSlackFailure({
							slackBotToken,
							slackChannelId,
							instanceId: event.instanceId,
							routeKey: route.key,
							cliVersion: BRIDGE_CLI_SPECIFIER,
							walletPublicKey,
							stage,
							message: `Bridge validator ${stage} failed: ${
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
			if (sandboxId !== undefined) {
				const selectedSandboxId = sandboxId
				try {
					await timed("destroy bridge sandbox", () =>
						step.do("destroy bridge sandbox", CLEANUP_STEP_OPTIONS, async () =>
							destroyBridgeSandbox({
								sandbox: getBridgeSandbox(this.env.Sandbox, selectedSandboxId)
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

	private async startCommandInFreshSandbox({
		instanceId,
		routeKey,
		walletPrivateKey,
		githubToken,
		sourceBuild,
		step,
		timed
	}: {
		instanceId: string
		routeKey: BridgeValidationParams["routeKey"]
		walletPrivateKey: string
		githubToken?: string
		sourceBuild?: { repository: string; ref: string }
		step: WorkflowStep
		timed: <T>(name: string, action: () => Promise<T>) => Promise<T>
	}) {
		const errors: string[] = []

		for (let attempt = 1; attempt <= BRIDGE_SANDBOX_START_ATTEMPTS; attempt += 1) {
			const sandboxId = buildBridgeSandboxId({ instanceId, attempt })
			const sandbox = getBridgeSandbox(this.env.Sandbox, sandboxId)

			try {
				await timed(`prepare bridge validation sandbox attempt ${attempt}`, () =>
					step.do(
						`prepare bridge validation sandbox attempt ${attempt}`,
						{ retries: NO_STEP_RETRIES, timeout: BRIDGE_SANDBOX_PREPARE_STEP_TIMEOUT },
						async () =>
							prepareBridgeSandbox({
								sandbox,
								walletPrivateKey,
								githubToken,
								sourceBuild
							})
					)
				)

				const command = await timed(`start bridge validation command attempt ${attempt}`, () =>
					step.do(
						`start bridge validation command attempt ${attempt}`,
						{ retries: NO_STEP_RETRIES, timeout: BRIDGE_COMMAND_START_ATTEMPT_STEP_TIMEOUT },
						async () =>
							startBridgeCommand({
								routeKey,
								sandbox,
								walletPrivateKey,
								githubToken,
								sourceBuild,
								launchTimeoutMs: BRIDGE_SANDBOX_START_LAUNCH_TIMEOUT_MS
							})
					)
				)

				return {
					sandboxId,
					attempt,
					...command
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				errors.push(`${sandboxId}: ${message}`)

				await timed(`destroy failed startup sandbox attempt ${attempt}`, () =>
					step
						.do(
							`destroy failed startup sandbox attempt ${attempt}`,
							CLEANUP_STEP_OPTIONS,
							async () =>
								destroyBridgeSandbox({
									sandbox,
									timeoutMs: BRIDGE_SANDBOX_START_ATTEMPT_TIMEOUT_MS
								})
						)
						.catch((cleanupError) => {
							errors.push(
								`${sandboxId} cleanup: ${
									cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
								}`
							)
						})
				)
			}
		}

		throw new BridgeValidationError(
			[
				`Cloudflare Sandbox setup failed after ${BRIDGE_SANDBOX_START_ATTEMPTS} fresh attempts.`,
				...errors
			].join("\n"),
			"setup"
		)
	}

	private async waitForCommandCompletion({
		step,
		instanceId,
		sandboxId,
		startedAtMs
	}: {
		step: WorkflowStep
		instanceId: string
		sandboxId: string
		startedAtMs: number
	}) {
		const deadlineMs = startedAtMs + WORKFLOW_HARD_TIMEOUT_MS

		for (let attempt = 1; Date.now() < deadlineMs; attempt += 1) {
			const nowMs = Date.now()
			if (nowMs >= deadlineMs) {
				return this.buildTimeoutCommandResult({
					step,
					sandboxId,
					instanceId,
					startedAtMs,
					finishedAtMs: nowMs,
					attempt,
					label: "timeout"
				})
			}

			await step.sleep(
				`wait before bridge command inspection ${attempt}`,
				Math.min(
					attempt === 1 ? BRIDGE_COMMAND_INITIAL_POLL_INTERVAL_MS : BRIDGE_COMMAND_POLL_INTERVAL_MS,
					deadlineMs - nowMs
				)
			)

			const afterSleepMs = Date.now()
			if (afterSleepMs >= deadlineMs) {
				return this.buildTimeoutCommandResult({
					step,
					sandboxId,
					instanceId,
					startedAtMs,
					finishedAtMs: afterSleepMs,
					attempt,
					label: "deadline"
				})
			}

			const commandStatus = await step.do(
				`inspect bridge command ${attempt}`,
				SANDBOX_CONTROL_STEP_OPTIONS,
				async () =>
					getBridgeCommandStatus({
						sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId)
					})
			)

			if (
				commandStatus.found &&
				(commandStatus.status === "running" || commandStatus.status === "starting")
			) {
				continue
			}

			const diagnostics = await this.readCommandDiagnostics({
				step,
				sandboxId,
				attempt,
				label: "terminal",
				fullOutput: true
			})

			if (!commandStatus.found) {
				return this.buildMissingCommandResult({
					instanceId,
					exitCode: 1,
					startedAtMs,
					finishedAtMs: Date.now(),
					message:
						"Bridge command process disappeared from the Cloudflare Sandbox process registry.",
					diagnostics
				})
			}

			return this.buildCommandResult({
				instanceId,
				status: commandStatus,
				diagnostics,
				finishedAtMs: Date.now()
			})
		}

		const finishedAtMs = Date.now()
		return this.buildTimeoutCommandResult({
			step,
			sandboxId,
			instanceId,
			startedAtMs,
			finishedAtMs,
			attempt: 0,
			label: "deadline"
		})
	}

	private async buildTimeoutCommandResult({
		step,
		sandboxId,
		instanceId,
		startedAtMs,
		finishedAtMs,
		attempt,
		label
	}: {
		step: WorkflowStep
		sandboxId: string
		instanceId: string
		startedAtMs: number
		finishedAtMs: number
		attempt: number
		label: string
	}): Promise<BridgeCommandCallbackPayload> {
		const termination = await step
			.do(
				`terminate bridge command after ${label} ${attempt}`,
				SANDBOX_CONTROL_STEP_OPTIONS,
				async () =>
					stopBridgeCommand({
						sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId)
					})
			)
			.then(() => "Bridge command process was sent SIGTERM before sandbox cleanup.")
			.catch(
				(error) =>
					`Bridge command process termination failed: ${
						error instanceof Error ? error.message : String(error)
					}`
			)

		const diagnostics = await this.readCommandDiagnostics({ step, sandboxId, attempt, label })

		return this.buildMissingCommandResult({
			instanceId,
			exitCode: 124,
			startedAtMs,
			finishedAtMs,
			message: [
				"Bridge command did not complete before the 2 hour workflow timeout.",
				termination
			].join(" "),
			diagnostics
		})
	}

	private async readCommandDiagnostics({
		step,
		sandboxId,
		attempt,
		label,
		fullOutput = false
	}: {
		step: WorkflowStep
		sandboxId: string
		attempt: number
		label: string
		fullOutput?: boolean
	}) {
		return await step.do(
			`read bridge diagnostics after ${label} command ${attempt}`,
			SANDBOX_CONTROL_STEP_OPTIONS,
			async () =>
				fullOutput
					? getBridgeCommandOutput({
							sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId)
						})
					: getBridgeCommandDiagnostics({
							sandbox: getBridgeSandbox(this.env.Sandbox, sandboxId)
						})
		)
	}

	private buildCommandResult({
		instanceId,
		status,
		diagnostics,
		finishedAtMs
	}: {
		instanceId: string
		status: Extract<BridgeCommandStatus, { found: true }>
		diagnostics: BridgeCommandDiagnostics
		finishedAtMs: number
	}): BridgeCommandCallbackPayload {
		const statusLine = `Bridge command process ${status.processId} finished with status ${status.status}.`
		const commandStartedAtMs = status.startedAtMs ?? finishedAtMs
		const commandFinishedAtMs = status.finishedAtMs ?? finishedAtMs

		return {
			instanceId,
			token: status.processId,
			exitCode: status.exitCode ?? (status.status === "completed" ? 0 : 1),
			stdout: diagnostics.stdout ?? "",
			stderr: [statusLine, getBridgeCommandDiagnosticTails(diagnostics).stderr]
				.filter(Boolean)
				.join("\n\n"),
			timing: {
				startedAtMs: commandStartedAtMs,
				finishedAtMs: commandFinishedAtMs,
				durationMs: Math.max(0, commandFinishedAtMs - commandStartedAtMs)
			}
		}
	}

	private buildMissingCommandResult({
		instanceId,
		exitCode,
		startedAtMs,
		finishedAtMs,
		message,
		diagnostics
	}: {
		instanceId: string
		exitCode: number
		startedAtMs: number
		finishedAtMs: number
		message: string
		diagnostics: BridgeCommandDiagnostics
	}): BridgeCommandCallbackPayload {
		const diagnosticSections = [
			message,
			diagnostics.processLog ? `process.log:\n${diagnostics.processLog}` : null,
			diagnostics.stderr ? `stderr.log:\n${diagnostics.stderr}` : null,
			diagnostics.pidFile ? `bridge.pid:\n${diagnostics.pidFile}` : null
		].filter((section): section is string => section !== null)

		return {
			instanceId,
			token: BRIDGE_COMMAND_PROCESS_ID,
			exitCode,
			stdout: diagnostics.stdout ?? "",
			stderr: diagnosticSections.join("\n\n"),
			timing: {
				startedAtMs,
				finishedAtMs,
				durationMs: Math.max(0, finishedAtMs - startedAtMs)
			}
		}
	}

	private async validateCommandResult({
		step,
		sandboxId,
		commandResult,
		route,
		slackBotToken,
		slackChannelId,
		walletPublicKey,
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
		walletPublicKey: string
		instanceId: string
		workflowStartedAtMs: number
		stepTimings: WorkflowPhaseTiming[]
		timed: <T>(name: string, action: () => Promise<T>) => Promise<T>
	}): Promise<BridgeValidationSummary> {
		let stage: BridgeValidationError["stage"] = "json"

		try {
			const result = await timed("parse bridge result", () =>
				step.do("parse bridge result", SANDBOX_CONTROL_STEP_OPTIONS, async () =>
					parseBridgeJson(commandResult.stdout)
				)
			)

			stage = "history"
			return await timed("validate bridge completion", () =>
				step.do("validate bridge completion", SANDBOX_CONTROL_STEP_OPTIONS, async () =>
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
				step.do("notify slack validation failure", NOTIFICATION_STEP_OPTIONS, async () =>
					reportSlackFailure({
						slackBotToken,
						slackChannelId,
						instanceId,
						routeKey: route.key,
						cliVersion: BRIDGE_CLI_SPECIFIER,
						walletPublicKey,
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
