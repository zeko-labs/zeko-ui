import { Sandbox as SandboxContainer, getSandbox } from "@cloudflare/sandbox"
import { type WorkflowEvent, type WorkflowStep, WorkflowEntrypoint } from "cloudflare:workers"
import { readValidatorEnv, type ValidatorSecretEnv } from "./config"
import { getValidatorRoute } from "./routes"
import { buildSlackFailureMessage, postSlackFailure } from "./slack"
import type { BridgeValidationParams } from "./types"
import {
	BRIDGE_PROCESS_ID,
	BRIDGE_PROGRESS_PATH,
	BRIDGE_RESULT_PATH,
	BRIDGE_SCRIPT_PATH,
	BRIDGE_VALIDATION_ROOT,
	BRIDGE_VERSION_PATH,
	buildBridgeProcessScript,
	buildScheduledValidations,
	DEFAULT_CLI_SPECIFIER,
	parseBridgeJson
} from "./validator"

const WORKFLOW_POLL_INTERVAL_MS = 10 * 60 * 1000
const WORKFLOW_MAX_POLLS = 288
const STEP_RETRIES = {
	limit: 3,
	delay: "30 seconds",
	backoff: "exponential"
} as const

const readSecretsFromEnv = (env: Env): ValidatorSecretEnv => ({
	ZEKO_BRIDGE_MINA_PRIVATE_KEY: env.ZEKO_BRIDGE_MINA_PRIVATE_KEY,
	ZEKO_BRIDGE_ZEKO_PRIVATE_KEY: env.ZEKO_BRIDGE_ZEKO_PRIVATE_KEY,
	SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN,
	SLACK_CHANNEL_ID: env.SLACK_CHANNEL_ID
})

const readSandboxFile = async (
	sandbox: ReturnType<typeof getSandbox>,
	path: string
): Promise<string> => {
	try {
		return (await sandbox.readFile(path)).content
	} catch {
		return ""
	}
}

const notifySlackFailure = async ({
	env,
	instanceId,
	routeKey,
	cliVersion,
	stage,
	exitCode,
	progress,
	message
}: {
	env: ValidatorSecretEnv
	instanceId: string
	routeKey: BridgeValidationParams["routeKey"]
	cliVersion: string
	stage: string
	exitCode?: number
	progress?: string
	message: string
}) => {
	const validatorEnv = readValidatorEnv(env)
	await postSlackFailure({
		token: validatorEnv.slackBotToken,
		channelId: validatorEnv.slackChannelId,
		text: buildSlackFailureMessage({
			instanceId,
			route: getValidatorRoute(routeKey),
			cliVersion,
			stage,
			exitCode,
			stderr: progress,
			message
		})
	})
}

export class BridgeValidationWorkflow extends WorkflowEntrypoint<Env, BridgeValidationParams> {
	override async run(event: WorkflowEvent<BridgeValidationParams>, step: WorkflowStep) {
		const route = getValidatorRoute(event.payload.routeKey)
		const cliSpecifier = event.payload.cliSpecifier ?? DEFAULT_CLI_SPECIFIER
		const validatorEnv = readValidatorEnv(readSecretsFromEnv(this.env))
		const sandboxId = `bridge-validator-${event.instanceId}`

		const runtime = await step.do(
			"start bridge validation process",
			{ retries: STEP_RETRIES, timeout: "10 minutes" },
			async () => {
				const sandbox = getSandbox(this.env.Sandbox, sandboxId)
				await sandbox.mkdir(BRIDGE_VALIDATION_ROOT, { recursive: true })
				await sandbox.writeFile(
					BRIDGE_SCRIPT_PATH,
					buildBridgeProcessScript({
						routeKey: route.key,
						cliSpecifier
					})
				)
				await sandbox.exec(`chmod +x ${BRIDGE_SCRIPT_PATH}`)
				const process = await sandbox.startProcess(`sh ${BRIDGE_SCRIPT_PATH}`, {
					processId: BRIDGE_PROCESS_ID,
					autoCleanup: false,
					cwd: BRIDGE_VALIDATION_ROOT,
					env: {
						ZEKO_BRIDGE_MINA_PRIVATE_KEY: validatorEnv.minaPrivateKey,
						ZEKO_BRIDGE_ZEKO_PRIVATE_KEY: validatorEnv.zekoPrivateKey
					}
				})

				return {
					sandboxId,
					processId: process.id
				}
			}
		)

		for (let pollIndex = 0; pollIndex < WORKFLOW_MAX_POLLS; pollIndex += 1) {
			const snapshot = await step.do(
				`poll bridge process ${pollIndex}`,
				{ retries: STEP_RETRIES, timeout: "5 minutes" },
				async () => {
					const sandbox = getSandbox(this.env.Sandbox, runtime.sandboxId)
					const process = await sandbox.getProcess(runtime.processId)
					const progress = await readSandboxFile(sandbox, BRIDGE_PROGRESS_PATH)
					const resultJson = await readSandboxFile(sandbox, BRIDGE_RESULT_PATH)
					const resolvedVersion = await readSandboxFile(sandbox, BRIDGE_VERSION_PATH)

					return {
						processStatus: process?.status ?? "missing",
						exitCode: process?.exitCode,
						progress,
						resultJson,
						resolvedVersion: resolvedVersion.trim() || cliSpecifier
					}
				}
			)

			if (snapshot.processStatus === "starting" || snapshot.processStatus === "running") {
				await step.sleep(`wait for bridge completion ${pollIndex}`, WORKFLOW_POLL_INTERVAL_MS)
				continue
			}

			if (snapshot.exitCode !== 0) {
				await step.do("notify slack failure", async () =>
					notifySlackFailure({
						env: readSecretsFromEnv(this.env),
						instanceId: event.instanceId,
						routeKey: route.key,
						cliVersion: snapshot.resolvedVersion,
						stage: "process",
						exitCode: snapshot.exitCode,
						progress: snapshot.progress,
						message: `Bridge command exited with ${snapshot.exitCode ?? "unknown"}`
					})
				)

				throw new Error(`Bridge validation failed for ${route.route}`)
			}

			const result = await step.do("parse bridge result", async () =>
				parseBridgeJson(snapshot.resultJson)
			)

			if (!result.success || result.status !== "completed") {
				await step.do("notify slack terminal result", async () =>
					notifySlackFailure({
						env: readSecretsFromEnv(this.env),
						instanceId: event.instanceId,
						routeKey: route.key,
						cliVersion: snapshot.resolvedVersion,
						stage: "result",
						progress: snapshot.progress,
						message: `Bridge command finished with status ${result.status}`
					})
				)

				throw new Error(`Bridge validation finished with status ${result.status}`)
			}

			return {
				route: route.route,
				cliVersion: snapshot.resolvedVersion,
				status: result.status,
				operationId: result.operation_id
			}
		}

		await step.do("notify slack timeout", async () =>
			notifySlackFailure({
				env: readSecretsFromEnv(this.env),
				instanceId: event.instanceId,
				routeKey: route.key,
				cliVersion: cliSpecifier,
				stage: "process",
				message: "Bridge validation exceeded the workflow polling window"
			})
		)

		throw new Error(`Bridge validation timed out for ${route.route}`)
	}
}

export { SandboxContainer as Sandbox }

const worker: ExportedHandler<Env> = {
	async fetch() {
		return Response.json({
			ok: true,
			service: "bridge-validator",
			workflow: "bridge-validator",
			manualTrigger: [
				'pnpm exec wrangler workflows trigger bridge-validator \'{"routeKey":"mina-to-zeko"}\' --config services/bridge-validator/wrangler.jsonc',
				'pnpm exec wrangler workflows trigger bridge-validator \'{"routeKey":"zeko-to-mina"}\' --config services/bridge-validator/wrangler.jsonc'
			]
		})
	},

	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		const validations = buildScheduledValidations({
			scheduledTime: controller.scheduledTime,
			cliSpecifier: DEFAULT_CLI_SPECIFIER
		})

		for (const validation of validations) {
			ctx.waitUntil(env.BRIDGE_VALIDATION_WORKFLOW.create(validation))
		}
	}
} satisfies ExportedHandler<Env>

export default worker

export * from "./config"
export * from "./routes"
export * from "./slack"
export * from "./types"
export * from "./validator"
