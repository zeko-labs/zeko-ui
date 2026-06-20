import { getSandbox, type Sandbox as SandboxContainer } from "@cloudflare/sandbox"
import {
	getValidatorRoute,
	getValidatorRouteAmount,
	type BridgeValidatorRoute,
	type BridgeValidatorRouteKey
} from "./routes"
import { WORKFLOW_HARD_TIMEOUT_MS } from "./runtime"
import type { BridgeCliJsonResult, BridgeCommandTiming, ScheduledValidation } from "./types"
import packageJson from "../package.json"

export const BRIDGE_CLI_SPECIFIER = `${packageJson.bridgeCli.package}@${packageJson.bridgeCli.version}`
export const BRIDGE_SANDBOX_OPTIONS = {
	keepAlive: true
} as const
export const BRIDGE_STATUS_SANDBOX_OPTIONS = {
	keepAlive: true
} as const
export const BRIDGE_WORKSPACE_ROOT = "/workspace"
export const BRIDGE_SOURCE_ROOT = `${BRIDGE_WORKSPACE_ROOT}/source/zeko-ui`
export const BRIDGE_CLI_BINARY = "zeko-bridge"
export const BRIDGE_COMMAND_REPORTING_RESERVE_MS = 5 * 60 * 1000
export const BRIDGE_COMMAND_TIMEOUT_MS =
	WORKFLOW_HARD_TIMEOUT_MS - BRIDGE_COMMAND_REPORTING_RESERVE_MS
export const BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS = 5 * 60 * 1000
export const BRIDGE_SANDBOX_PREPARE_TIMEOUT_MS = 10 * 60 * 1000
export const BRIDGE_COMMAND_PROCESS_ID = "bridge-validation-command"
export const BRIDGE_STATUS_PATH = "/bridge-status"
export const BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES = 20_000
export const BRIDGE_SANDBOX_FILE_TIMEOUT_MS = 10_000
export const BRIDGE_SANDBOX_CONTROL_TIMEOUT_MS = 2 * 60 * 1000
export const BRIDGE_SANDBOX_START_ATTEMPT_TIMEOUT_MS = 30_000
export const BRIDGE_SANDBOX_START_LAUNCH_TIMEOUT_MS = 60_000
export const BRIDGE_SANDBOX_START_ATTEMPTS = 6

export type BridgeCommandResult = {
	exitCode: number
	stdout: string
	stderr: string
}

export type BridgeCommandDiagnostics = {
	pidFile: string | null
	processLog: string | null
	stdout: string | null
	stderr: string | null
}

export type BridgeCommandStatus =
	| {
			processId: typeof BRIDGE_COMMAND_PROCESS_ID
			found: false
	  }
	| {
			processId: typeof BRIDGE_COMMAND_PROCESS_ID
			found: true
			pid?: string
			status: "starting" | "running" | "completed" | "failed" | "killed" | "error"
			exitCode?: number
			startedAtMs?: number
			finishedAtMs?: number
	  }

export type BridgeCommandCallbackPayload = {
	instanceId: string
	token: string
	exitCode: number
	stdout: string
	stderr: string
	timing: BridgeCommandTiming
}

export type BridgeSourceBuildConfig = {
	repository: string
	ref: string
}

export const describeBridgeCommandFailure = ({
	exitCode,
	stdout,
	stderr,
	timing
}: Pick<BridgeCommandCallbackPayload, "exitCode" | "stdout" | "stderr" | "timing">) => {
	const lastLine = (value: string) =>
		value
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.reverse()
			.find((line) => !line.startsWith("npm notice"))
	const lastDiagnosticLine = lastLine(stderr) ?? lastLine(stdout)
	const duration = `${Math.round(timing.durationMs / 1000)}s (${Math.round(timing.durationMs)} ms)`

	if (exitCode === 124) {
		return [
			`Bridge command timed out after ${duration} before reaching a terminal bridge result.`,
			lastDiagnosticLine ? `Last diagnostic: ${lastDiagnosticLine}` : ""
		]
			.filter(Boolean)
			.join(" ")
	}

	return [
		`Bridge command exited with code ${exitCode}.`,
		lastDiagnosticLine
			? `Last diagnostic: ${lastDiagnosticLine}`
			: "No stdout/stderr diagnostic was captured."
	].join(" ")
}

export type BridgeHistoryLogEntry = {
	timestamp?: string
	event: string
	hash?: string
	advancedPriorClaim?: boolean
	[key: string]: unknown
}

export type BridgeValidationSummary = {
	operationId: string
	route: BridgeValidatorRoute["route"]
	direction: BridgeValidatorRoute["direction"]
	amount: string
	finalHash: string
	logPath: string
	finalExplorerUrl?: string
	cliReportedError?: string
	submittedTransactionCount: number
	queueAdvanceCount: number
	historyEventCount: number
}

export class BridgeValidationError extends Error {
	constructor(
		message: string,
		readonly stage: "setup" | "process" | "json" | "result" | "history" | "runtime",
		readonly exitCode?: number,
		readonly stdout = "",
		readonly stderr = ""
	) {
		super(message)
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`

const withSandboxTimeout = async <T>(
	operation: Promise<T>,
	label: string,
	timeoutMs: number
): Promise<T> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(
			() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)),
			timeoutMs
		)
	})

	try {
		return await Promise.race([operation, timeout])
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId)
		}
	}
}

const requireNonEmptyString = (
	value: unknown,
	label: string,
	stage: BridgeValidationError["stage"]
): string => {
	if (typeof value !== "string" || value.trim() === "") {
		throw new BridgeValidationError(`Bridge result missing ${label}`, stage)
	}

	return value
}

const requireHistoryHash = (entries: BridgeHistoryLogEntry[], hash: string, label: string) => {
	if (!entries.some((entry) => entry.hash === hash)) {
		throw new BridgeValidationError(
			`Bridge history log does not confirm ${label} hash ${hash}`,
			"history"
		)
	}
}

export const buildBridgeProcessEnv = ({
	walletPrivateKey,
	githubToken,
	sourceBuild
}: {
	walletPrivateKey: string
	githubToken?: string
	sourceBuild?: BridgeSourceBuildConfig
}) => ({
	HOME: `${BRIDGE_WORKSPACE_ROOT}/home`,
	MINA_PRIVATE_KEY: walletPrivateKey,
	PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
	WALLET_PRIVATE_KEY: walletPrivateKey,
	XDG_CACHE_HOME: `${BRIDGE_WORKSPACE_ROOT}/cache`,
	XDG_STATE_HOME: `${BRIDGE_WORKSPACE_ROOT}/state`,
	...(githubToken ? { GITHUB_TOKEN: githubToken } : {}),
	...(sourceBuild
		? {
				BRIDGE_VALIDATOR_SOURCE_REPOSITORY: sourceBuild.repository,
				BRIDGE_VALIDATOR_SOURCE_REF: sourceBuild.ref
			}
		: {})
})

export const getBridgeSandbox = (
	sandboxNamespace: DurableObjectNamespace<SandboxContainer>,
	sandboxId: string
) => getSandbox(sandboxNamespace, sandboxId, BRIDGE_SANDBOX_OPTIONS)

export const getBridgeStatusSandbox = (
	sandboxNamespace: DurableObjectNamespace<SandboxContainer>,
	sandboxId: string
) => getSandbox(sandboxNamespace, sandboxId, BRIDGE_STATUS_SANDBOX_OPTIONS)

export const buildBridgeSandboxId = ({
	instanceId,
	attempt
}: {
	instanceId: string
	attempt?: number
}) => {
	const slug =
		instanceId
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 24)
			.replace(/-+$/g, "") || "run"
	const hash = Array.from(instanceId).reduce(
		(accumulator, character) => Math.imul(accumulator ^ character.charCodeAt(0), 0x01000193) >>> 0,
		0x811c9dc5
	)
	const hashText = hash.toString(36).padStart(7, "0").slice(0, 8)
	const attemptSuffix = attempt === undefined ? "" : `-${attempt}`

	return `bridge-validator-${slug}${attemptSuffix}-${hashText}`
}

export const buildBridgeSandboxIds = ({ instanceId }: { instanceId: string }) => [
	buildBridgeSandboxId({ instanceId }),
	...Array.from({ length: BRIDGE_SANDBOX_START_ATTEMPTS }, (_, index) =>
		buildBridgeSandboxId({ instanceId, attempt: index + 1 })
	)
]

export const destroyBridgeSandbox = async ({
	sandbox,
	timeoutMs = BRIDGE_SANDBOX_CONTROL_TIMEOUT_MS
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "destroy">
	timeoutMs?: number
}) => {
	await withSandboxTimeout(sandbox.destroy(), "Cloudflare Sandbox destroy", timeoutMs)
}

export const stopBridgeCommand = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "killProcess">
}) => {
	await withSandboxTimeout(
		sandbox.killProcess(BRIDGE_COMMAND_PROCESS_ID, "TERM").catch(() => undefined),
		"Cloudflare Sandbox command termination",
		BRIDGE_SANDBOX_FILE_TIMEOUT_MS
	)
}

export const getBridgeCommandStatus = async ({
	sandbox,
	fileTimeoutMs = BRIDGE_SANDBOX_FILE_TIMEOUT_MS
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "getProcess">
	fileTimeoutMs?: number
}): Promise<BridgeCommandStatus> => {
	const process = await withSandboxTimeout(
		sandbox.getProcess(BRIDGE_COMMAND_PROCESS_ID),
		"Cloudflare Sandbox process status",
		fileTimeoutMs
	)

	if (process === null) {
		return {
			processId: BRIDGE_COMMAND_PROCESS_ID,
			found: false
		}
	}

	return {
		processId: BRIDGE_COMMAND_PROCESS_ID,
		found: true,
		...(typeof process.pid === "number" ? { pid: String(process.pid) } : {}),
		status: process.status,
		...(typeof process.exitCode === "number" ? { exitCode: process.exitCode } : {}),
		startedAtMs: process.startTime.getTime(),
		...(process.endTime ? { finishedAtMs: process.endTime.getTime() } : {})
	}
}

const tailDiagnosticText = (value: string | null) =>
	value === null || value === "" ? null : value.slice(-BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES)

const readProcessLogs = async ({
	sandbox,
	timeoutMs = BRIDGE_SANDBOX_FILE_TIMEOUT_MS
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "getProcessLogs">
	timeoutMs?: number
}) =>
	await withSandboxTimeout(
		sandbox.getProcessLogs(BRIDGE_COMMAND_PROCESS_ID),
		"Cloudflare Sandbox process logs",
		timeoutMs
	).catch(() => null)

export const getBridgeCommandDiagnostics = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "getProcessLogs">
}): Promise<BridgeCommandDiagnostics> => {
	const logs = await readProcessLogs({ sandbox })

	return {
		pidFile: null,
		processLog: null,
		stdout: tailDiagnosticText(logs?.stdout ?? null),
		stderr: tailDiagnosticText(logs?.stderr ?? null)
	}
}

export const getBridgeCommandOutput = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "getProcessLogs">
}): Promise<BridgeCommandDiagnostics> => {
	const logs = await readProcessLogs({ sandbox })

	return {
		pidFile: null,
		processLog: null,
		stdout: logs?.stdout ?? null,
		stderr: logs?.stderr ?? null
	}
}

export const getBridgeCommandDiagnosticTails = ({
	stdout,
	stderr,
	pidFile = null,
	processLog = null
}: BridgeCommandDiagnostics): BridgeCommandDiagnostics => ({
	pidFile: tailDiagnosticText(pidFile),
	processLog: tailDiagnosticText(processLog),
	stdout: tailDiagnosticText(stdout),
	stderr: tailDiagnosticText(stderr)
})

export const buildBridgeSourceSetupCommand = () =>
	[
		"set -euo pipefail",
		`mkdir -p ${shellQuote(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator`)} /workspace/home /workspace/cache /workspace/state /workspace/source`,
		'if [ -n "${BRIDGE_VALIDATOR_SOURCE_REPOSITORY:-}" ] && [ -n "${BRIDGE_VALIDATOR_SOURCE_REF:-}" ]; then',
		`  rm -rf ${shellQuote(BRIDGE_SOURCE_ROOT)}`,
		`  mkdir -p ${shellQuote(BRIDGE_SOURCE_ROOT)}`,
		'  clone_url="$BRIDGE_VALIDATOR_SOURCE_REPOSITORY"',
		'  if [ -n "${GITHUB_TOKEN:-}" ] && [[ "$clone_url" == https://github.com/* ]]; then',
		`    askpass_path=${shellQuote(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator/git-askpass.sh`)}`,
		"    cat > \"$askpass_path\" <<'EOF'",
		"#!/usr/bin/env sh",
		'case "$1" in',
		"*Username*) printf %s x-access-token ;;",
		'*Password*) printf %s "$GITHUB_TOKEN" ;;',
		'*) printf %s "" ;;',
		"esac",
		"EOF",
		'    chmod 700 "$askpass_path"',
		'    export GIT_ASKPASS="$askpass_path"',
		"    export GIT_TERMINAL_PROMPT=0",
		"  fi",
		`  git clone --filter=blob:none "$clone_url" ${shellQuote(BRIDGE_SOURCE_ROOT)}`,
		`  cd ${shellQuote(BRIDGE_SOURCE_ROOT)}`,
		'  git fetch --depth 1 origin "$BRIDGE_VALIDATOR_SOURCE_REF"',
		"  git checkout --detach FETCH_HEAD",
		"  corepack enable",
		"  pnpm install --frozen-lockfile --filter @zeko-labs/bridge-cli... --ignore-scripts",
		"  pnpm --dir packages/bridge-sdk exec tsdown",
		"  pnpm --dir packages/bridge-cli exec tsdown",
		"fi"
	].join("\n")

const buildBridgeCommandSelectionCommand = () =>
	[
		'if [ -n "${BRIDGE_VALIDATOR_SOURCE_REPOSITORY:-}" ] && [ -n "${BRIDGE_VALIDATOR_SOURCE_REF:-}" ]; then',
		`  bridge_command=(node ${shellQuote(`${BRIDGE_SOURCE_ROOT}/packages/bridge-cli/dist/cli.js`)})`,
		"else",
		`  bridge_command=(${shellQuote(BRIDGE_CLI_BINARY)})`,
		"fi"
	].join("\n")

export const buildBridgeCommand = ({ routeKey }: { routeKey: BridgeValidatorRouteKey }) => {
	const route = getValidatorRoute(routeKey)
	const timeoutSeconds = Math.floor(BRIDGE_COMMAND_TIMEOUT_MS / 1000)
	const args = [
		"bridge",
		"--from",
		route.cliFrom ?? route.from,
		"--to",
		route.cliTo ?? route.to,
		"--amount",
		getValidatorRouteAmount(route.key),
		"--json",
		"--verbose"
	]
		.map(shellQuote)
		.join(" ")

	return [
		"set -euo pipefail",
		buildBridgeCommandSelectionCommand(),
		`timeout -k 30s -s TERM ${timeoutSeconds}s "\${bridge_command[@]}" ${args}`
	].join("\n")
}

export const startBridgeCommand = async ({
	routeKey,
	sandbox,
	walletPrivateKey,
	githubToken,
	sourceBuild,
	launchTimeoutMs = BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS
}: {
	routeKey: BridgeValidatorRouteKey
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "startProcess">
	walletPrivateKey: string
	githubToken?: string
	sourceBuild?: BridgeSourceBuildConfig
	launchTimeoutMs?: number
}) => {
	const process = await withSandboxTimeout(
		sandbox
			.startProcess(buildBridgeCommand({ routeKey }), {
				autoCleanup: false,
				cwd: BRIDGE_WORKSPACE_ROOT,
				env: buildBridgeProcessEnv({ walletPrivateKey, githubToken, sourceBuild }),
				processId: BRIDGE_COMMAND_PROCESS_ID,
				timeout: BRIDGE_COMMAND_TIMEOUT_MS
			})
			.catch((error) => {
				throw new BridgeValidationError(
					`Bridge command launcher failed: ${error instanceof Error ? error.message : String(error)}`,
					"process"
				)
			}),
		"Cloudflare Sandbox bridge command launcher",
		launchTimeoutMs
	)

	const pid = typeof process.pid === "number" ? String(process.pid) : undefined
	if (pid === undefined) {
		throw new BridgeValidationError(
			"Bridge command launcher did not report a process id",
			"process"
		)
	}

	return {
		processId: process.id,
		pid
	}
}

export const prepareBridgeSandbox = async ({
	sandbox,
	walletPrivateKey,
	githubToken,
	sourceBuild,
	timeoutMs = BRIDGE_SANDBOX_PREPARE_TIMEOUT_MS
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "exec">
	walletPrivateKey: string
	githubToken?: string
	sourceBuild?: BridgeSourceBuildConfig
	timeoutMs?: number
}) => {
	const result = await withSandboxTimeout(
		sandbox.exec(buildBridgeSourceSetupCommand(), {
			cwd: BRIDGE_WORKSPACE_ROOT,
			timeout: timeoutMs,
			env: buildBridgeProcessEnv({ walletPrivateKey, githubToken, sourceBuild })
		}),
		"Cloudflare Sandbox bridge source setup",
		timeoutMs
	)
	if (!result.success || result.exitCode !== 0) {
		throw new BridgeValidationError(
			`Bridge source setup failed with exit code ${result.exitCode}`,
			"setup",
			result.exitCode,
			result.stdout,
			result.stderr
		)
	}

	return result
}

export const readBridgeHistoryLog = async ({
	sandbox,
	logPath
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile">
	logPath: string
}) => {
	try {
		return (await sandbox.readFile(logPath)).content
	} catch (error) {
		throw new BridgeValidationError(
			`Failed to read bridge history log at ${logPath}: ${
				error instanceof Error ? error.message : String(error)
			}`,
			"history"
		)
	}
}

export const buildScheduledValidations = ({
	scheduledTime
}: {
	scheduledTime: number
}): ScheduledValidation[] =>
	(["mina-to-zeko", "zeko-to-mina"] as const).map((routeKey) => ({
		id: `bridge-validator-${routeKey}-${scheduledTime}`,
		params: {
			routeKey
		}
	}))

export const parseBridgeJson = (stdout: string): BridgeCliJsonResult => {
	const trimmed = stdout.trim()
	const candidateStarts = [
		0,
		...Array.from(trimmed.matchAll(/\n\{/g), (match) => (match.index ?? -1) + 1).filter(
			(index) => index > 0
		)
	]
	const candidates = Array.from(new Set(candidateStarts))
		.sort((a, b) => b - a)
		.map((start) => trimmed.slice(start).trim())

	try {
		for (const candidate of candidates) {
			try {
				const parsed = JSON.parse(candidate) as unknown
				if (!isRecord(parsed)) {
					throw new Error("Bridge JSON output must be an object")
				}

				return parsed as BridgeCliJsonResult
			} catch {
				continue
			}
		}

		throw new Error("No JSON object found in bridge output")
	} catch (error) {
		throw new BridgeValidationError(
			`Failed to parse bridge JSON output: ${error instanceof Error ? error.message : String(error)}`,
			"json",
			undefined,
			stdout
		)
	}
}

export const parseBridgeHistoryLog = (historyLog: string): BridgeHistoryLogEntry[] => {
	const lines = historyLog
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)

	if (lines.length === 0) {
		throw new BridgeValidationError("Bridge history log is empty", "history", undefined, historyLog)
	}

	return lines.map((line, index) => {
		try {
			const parsed = JSON.parse(line) as unknown
			if (!isRecord(parsed) || typeof parsed.event !== "string" || parsed.event.trim() === "") {
				throw new Error("Bridge history log entry is missing an event")
			}

			return parsed as BridgeHistoryLogEntry
		} catch (error) {
			throw new BridgeValidationError(
				`Failed to parse bridge history log line ${index + 1}: ${
					error instanceof Error ? error.message : String(error)
				}`,
				"history",
				undefined,
				historyLog
			)
		}
	})
}

const formatFailedBridgeResult = (result: BridgeCliJsonResult) => {
	const submittedHashes = Array.isArray(result.submitted_transactions)
		? result.submitted_transactions
				.map((transaction) => transaction.hash)
				.filter((hash): hash is string => typeof hash === "string" && hash.trim() !== "")
		: []
	const details = [
		"Bridge result reported success=false",
		typeof result.status === "string" ? `status=${result.status}` : "",
		typeof result.operation_id === "string" && result.operation_id.trim() !== ""
			? `operation_id=${result.operation_id}`
			: "",
		typeof result.log_path === "string" && result.log_path.trim() !== ""
			? `log_path=${result.log_path}`
			: "",
		submittedHashes.length > 0 ? `submitted_hashes=${submittedHashes.join(",")}` : "",
		typeof result.error === "string" && result.error.trim() !== ""
			? `cli_error=${result.error.trim()}`
			: ""
	].filter(Boolean)

	return details.join("; ")
}

export const validateBridgeCompletion = ({
	route,
	result,
	historyLog
}: {
	route: BridgeValidatorRoute
	result: BridgeCliJsonResult
	historyLog: string
}): BridgeValidationSummary => {
	if (result.success !== true) {
		throw new BridgeValidationError(formatFailedBridgeResult(result), "result")
	}

	if (result.status !== "completed") {
		throw new BridgeValidationError(
			`Bridge result finished with unexpected status ${String(result.status)}`,
			"result"
		)
	}

	const acceptedResultRoutes = route.acceptedResultRoutes ?? [route.route]
	if (!acceptedResultRoutes.includes(String(result.route))) {
		throw new BridgeValidationError(
			`Bridge result route ${String(result.route)} did not match expected routes ${acceptedResultRoutes.join(", ")}`,
			"result"
		)
	}

	if (result.direction !== route.direction) {
		throw new BridgeValidationError(
			`Bridge result direction ${String(result.direction)} did not match expected direction ${route.direction}`,
			"result"
		)
	}

	const amount = requireNonEmptyString(result.amount, "amount", "result")
	const logPath = requireNonEmptyString(result.log_path, "log_path", "result")

	if (!Array.isArray(result.submitted_transactions) || result.submitted_transactions.length === 0) {
		throw new BridgeValidationError(
			"Bridge result did not include submitted transactions",
			"result"
		)
	}

	for (const transaction of result.submitted_transactions) {
		requireNonEmptyString(transaction.action, "submitted transaction action", "result")
		requireNonEmptyString(transaction.hash, "submitted transaction hash", "result")
	}

	if (!result.final_transaction) {
		throw new BridgeValidationError("Bridge result did not include a final transaction", "result")
	}

	const finalHash = requireNonEmptyString(
		result.final_transaction.hash,
		"final transaction hash",
		"result"
	)
	if (!result.submitted_transactions.some((transaction) => transaction.hash === finalHash)) {
		throw new BridgeValidationError(
			`Bridge result final transaction hash ${finalHash} was not present in submitted transactions`,
			"result"
		)
	}

	const historyEntries = parseBridgeHistoryLog(historyLog)
	for (const transaction of result.submitted_transactions) {
		requireHistoryHash(historyEntries, transaction.hash, "submitted transaction")
	}

	const completedEntry = [...historyEntries].reverse().find((entry) => entry.event === "completed")
	if (!completedEntry) {
		throw new BridgeValidationError(
			"Bridge history log did not include a completed event",
			"history",
			undefined,
			historyLog
		)
	}

	if (completedEntry.hash !== finalHash) {
		throw new BridgeValidationError(
			`Bridge history log final transaction hash ${String(completedEntry.hash)} did not match ${finalHash}`,
			"history",
			undefined,
			historyLog
		)
	}

	return {
		operationId: requireNonEmptyString(result.operation_id, "operation_id", "result"),
		route: route.route,
		direction: route.direction,
		amount,
		finalHash,
		logPath,
		...(result.final_transaction.explorerUrl
			? { finalExplorerUrl: result.final_transaction.explorerUrl }
			: {}),
		...(typeof result.error === "string" && result.error.trim() !== ""
			? { cliReportedError: result.error.trim() }
			: {}),
		submittedTransactionCount: result.submitted_transactions.length,
		queueAdvanceCount: historyEntries.filter((entry) => entry.advancedPriorClaim === true).length,
		historyEventCount: historyEntries.length
	}
}
