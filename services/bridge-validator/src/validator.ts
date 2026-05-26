import { getSandbox, type Sandbox as SandboxContainer } from "@cloudflare/sandbox"
import {
	getValidatorRoute,
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
export const BRIDGE_WORKSPACE_ROOT = "/workspace"
export const BRIDGE_CLI_BINARY = "zeko-bridge"
export const DEFAULT_BRIDGE_AMOUNT = "0.5"
export const BRIDGE_COMMAND_REPORTING_RESERVE_MS = 5 * 60 * 1000
export const BRIDGE_COMMAND_TIMEOUT_MS =
	WORKFLOW_HARD_TIMEOUT_MS - BRIDGE_COMMAND_REPORTING_RESERVE_MS
export const BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS = 5 * 60 * 1000
export const BRIDGE_COMMAND_PROCESS_ID = "bridge-validation-command"
export const BRIDGE_STATUS_PATH = "/bridge-status"
export const BRIDGE_COMMAND_SCRIPT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/run-bridge.sh`
export const BRIDGE_COMMAND_PID_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/bridge.pid`
export const BRIDGE_COMMAND_PROCESS_LOG_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/process.log`
export const BRIDGE_COMMAND_EXIT_CODE_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/exit-code.txt`
export const BRIDGE_COMMAND_STARTED_AT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/started-at-ms.txt`
export const BRIDGE_COMMAND_FINISHED_AT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/finished-at-ms.txt`
export const BRIDGE_COMMAND_STDOUT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/stdout.json`
export const BRIDGE_COMMAND_STDERR_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/stderr.log`
export const BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES = 20_000
export const BRIDGE_SANDBOX_FILE_TIMEOUT_MS = 10_000
export const BRIDGE_SANDBOX_CONTROL_TIMEOUT_MS = 2 * 60 * 1000

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
		readonly stage: "process" | "json" | "result" | "history" | "runtime",
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

export const buildBridgeProcessEnv = ({ walletPrivateKey }: { walletPrivateKey: string }) => ({
	HOME: `${BRIDGE_WORKSPACE_ROOT}/home`,
	MINA_PRIVATE_KEY: walletPrivateKey,
	PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
	WALLET_PRIVATE_KEY: walletPrivateKey,
	XDG_CACHE_HOME: `${BRIDGE_WORKSPACE_ROOT}/cache`,
	XDG_STATE_HOME: `${BRIDGE_WORKSPACE_ROOT}/state`
})

export const getBridgeSandbox = (
	sandboxNamespace: DurableObjectNamespace<SandboxContainer>,
	sandboxId: string
) => getSandbox(sandboxNamespace, sandboxId, BRIDGE_SANDBOX_OPTIONS)

export const getBridgeStatusSandbox = (
	sandboxNamespace: DurableObjectNamespace<SandboxContainer>,
	sandboxId: string
) => getSandbox(sandboxNamespace, sandboxId, BRIDGE_SANDBOX_OPTIONS)

export const destroyBridgeSandbox = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "destroy">
}) => {
	await withSandboxTimeout(
		sandbox.destroy(),
		"Cloudflare Sandbox destroy",
		BRIDGE_SANDBOX_CONTROL_TIMEOUT_MS
	)
}

export const stopBridgeCommand = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "exec" | "readFile">
}) => {
	const pidFile = await readSandboxFile({ sandbox, path: BRIDGE_COMMAND_PID_PATH })
	const pid = pidFile?.trim()
	if (!pid || !/^\d+$/.test(pid)) return

	await withSandboxTimeout(
		sandbox.exec(`kill -TERM ${pid} 2>/dev/null || true`, {
			cwd: BRIDGE_WORKSPACE_ROOT,
			timeout: 10_000
		}),
		"Cloudflare Sandbox command termination",
		BRIDGE_SANDBOX_FILE_TIMEOUT_MS
	)
}

export const getBridgeCommandStatus = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "exec" | "readFile">
}): Promise<BridgeCommandStatus> => {
	const exitCodeText = await readSandboxFile({
		sandbox,
		path: BRIDGE_COMMAND_EXIT_CODE_PATH
	})
	if (exitCodeText !== null) {
		const exitCode = Number(exitCodeText.trim())
		return {
			processId: BRIDGE_COMMAND_PROCESS_ID,
			found: true,
			status: exitCode === 0 ? "completed" : "failed",
			exitCode: Number.isFinite(exitCode) ? exitCode : 1,
			...(await readBridgeCommandTiming({ sandbox }))
		}
	}

	const pidFile = await readSandboxFile({
		sandbox,
		path: BRIDGE_COMMAND_PID_PATH
	})
	const pid = pidFile?.trim()

	if (!pid || !/^\d+$/.test(pid)) {
		return {
			processId: BRIDGE_COMMAND_PROCESS_ID,
			found: false
		}
	}

	const status = await withSandboxTimeout(
		sandbox.exec(`if kill -0 ${pid} 2>/dev/null; then printf running; else printf exited; fi`, {
			cwd: BRIDGE_WORKSPACE_ROOT,
			timeout: 10_000
		}),
		"Cloudflare Sandbox status check",
		BRIDGE_SANDBOX_FILE_TIMEOUT_MS
	)

	return {
		processId: BRIDGE_COMMAND_PROCESS_ID,
		found: true,
		pid,
		status: status.stdout.trim() === "running" ? "running" : "error",
		...(await readBridgeCommandTiming({ sandbox }))
	}
}

const readSandboxFile = async ({
	sandbox,
	path
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile">
	path: string
}) => {
	const file = await withSandboxTimeout(
		sandbox.readFile(path),
		`Cloudflare Sandbox read ${path}`,
		BRIDGE_SANDBOX_FILE_TIMEOUT_MS
	).catch((error) => {
		if (error instanceof Error) {
			return null
		}

		throw error
	})

	return file?.content ?? null
}

const readBridgeCommandTiming = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile">
}) => {
	const [startedAtText, finishedAtText] = await Promise.all([
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_STARTED_AT_PATH }),
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_FINISHED_AT_PATH })
	])
	const startedAtMs = Number(startedAtText?.trim())
	const finishedAtMs = Number(finishedAtText?.trim())

	return {
		...(Number.isFinite(startedAtMs) ? { startedAtMs } : {}),
		...(Number.isFinite(finishedAtMs) ? { finishedAtMs } : {})
	}
}

const tailDiagnosticText = (value: string | null) =>
	value === null || value === "" ? null : value.slice(-BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES)

export const getBridgeCommandDiagnostics = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile">
}): Promise<BridgeCommandDiagnostics> => {
	const [pidFile, stdoutFile, stderrFile, processLog] = await Promise.all([
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_PID_PATH }),
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_STDOUT_PATH }),
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_STDERR_PATH }),
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_PROCESS_LOG_PATH })
	])

	return {
		pidFile: tailDiagnosticText(pidFile),
		processLog: tailDiagnosticText(processLog),
		stdout: tailDiagnosticText(stdoutFile),
		stderr: tailDiagnosticText(stderrFile)
	}
}

export const getBridgeCommandOutput = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile">
}): Promise<BridgeCommandDiagnostics> => {
	const [stdoutFile, stderrFile] = await Promise.all([
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_STDOUT_PATH }),
		readSandboxFile({ sandbox, path: BRIDGE_COMMAND_STDERR_PATH })
	])

	return {
		pidFile: null,
		processLog: null,
		stdout: stdoutFile,
		stderr: stderrFile
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

export const buildBridgeCommand = ({ routeKey }: { routeKey: BridgeValidatorRouteKey }) => {
	const route = getValidatorRoute(routeKey)
	const timeoutSeconds = Math.floor(BRIDGE_COMMAND_TIMEOUT_MS / 1000)
	const args = [
		"bridge",
		"--from",
		route.from,
		"--to",
		route.to,
		"--amount",
		DEFAULT_BRIDGE_AMOUNT,
		"--json",
		"--verbose"
	]
		.map(shellQuote)
		.join(" ")

	return [
		"set -euo pipefail",
		"mkdir -p /workspace/home /workspace/cache /workspace/state",
		`timeout -k 30s -s TERM ${timeoutSeconds}s ${BRIDGE_CLI_BINARY} ${args}`
	].join("\n")
}

export const buildBridgeCommandScript = ({ routeKey }: { routeKey: BridgeValidatorRouteKey }) =>
	[
		"#!/usr/bin/env bash",
		"set -u",
		`mkdir -p ${shellQuote(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator`)} /workspace/home /workspace/cache /workspace/state`,
		`stdout_path=${shellQuote(BRIDGE_COMMAND_STDOUT_PATH)}`,
		`stderr_path=${shellQuote(BRIDGE_COMMAND_STDERR_PATH)}`,
		`exit_code_path=${shellQuote(BRIDGE_COMMAND_EXIT_CODE_PATH)}`,
		`started_at_path=${shellQuote(BRIDGE_COMMAND_STARTED_AT_PATH)}`,
		`finished_at_path=${shellQuote(BRIDGE_COMMAND_FINISHED_AT_PATH)}`,
		': > "$stdout_path"',
		': > "$stderr_path"',
		'date +%s%3N > "$started_at_path"',
		"set +e",
		"(",
		buildBridgeCommand({ routeKey }),
		') > "$stdout_path" 2> "$stderr_path"',
		"exit_code=$?",
		'date +%s%3N > "$finished_at_path"',
		'printf "%s" "$exit_code" > "$exit_code_path"',
		'exit "$exit_code"'
	].join("\n")

export const buildBridgeLaunchCommand = () =>
	[
		`nohup bash ${shellQuote(BRIDGE_COMMAND_SCRIPT_PATH)} > ${shellQuote(BRIDGE_COMMAND_PROCESS_LOG_PATH)} 2>&1 &`,
		'pid="$!"',
		`printf '%s' "$pid" > ${shellQuote(BRIDGE_COMMAND_PID_PATH)}`,
		'printf "%s" "$pid"'
	].join("\n")

export const startBridgeCommand = async ({
	routeKey,
	sandbox,
	walletPrivateKey
}: {
	routeKey: BridgeValidatorRouteKey
	sandbox: Pick<
		ReturnType<typeof getBridgeSandbox>,
		"setKeepAlive" | "mkdir" | "writeFile" | "exec"
	>
	walletPrivateKey: string
}) => {
	await withSandboxTimeout(
		sandbox.setKeepAlive(true),
		"Cloudflare Sandbox keepalive setup",
		BRIDGE_SANDBOX_CONTROL_TIMEOUT_MS
	)
	await withSandboxTimeout(
		sandbox.mkdir(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator`, { recursive: true }),
		"Cloudflare Sandbox workspace setup",
		BRIDGE_SANDBOX_CONTROL_TIMEOUT_MS
	)
	await withSandboxTimeout(
		sandbox.writeFile(BRIDGE_COMMAND_SCRIPT_PATH, buildBridgeCommandScript({ routeKey }), {
			encoding: "utf8"
		}),
		"Cloudflare Sandbox bridge script write",
		BRIDGE_SANDBOX_CONTROL_TIMEOUT_MS
	)
	const result = await withSandboxTimeout(
		sandbox.exec(buildBridgeLaunchCommand(), {
			cwd: BRIDGE_WORKSPACE_ROOT,
			timeout: BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS,
			env: buildBridgeProcessEnv({ walletPrivateKey })
		}),
		"Cloudflare Sandbox bridge command launcher",
		BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS
	)
	if (!result.success || result.exitCode !== 0) {
		throw new BridgeValidationError(
			`Bridge command launcher failed with exit code ${result.exitCode}`,
			"process",
			result.exitCode,
			result.stdout,
			result.stderr
		)
	}

	const pid = result.stdout.trim()
	if (!/^\d+$/.test(pid)) {
		throw new BridgeValidationError(
			"Bridge command launcher did not report a process id",
			"process",
			result.exitCode,
			result.stdout,
			result.stderr
		)
	}

	return {
		processId: BRIDGE_COMMAND_PROCESS_ID,
		pid
	}
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
}): ScheduledValidation[] => [
	{
		id: `bridge-validator-mina-to-zeko-${scheduledTime}`,
		params: {
			routeKey: "mina-to-zeko"
		}
	},
	{
		id: `bridge-validator-zeko-to-mina-${scheduledTime}`,
		params: {
			routeKey: "zeko-to-mina"
		}
	}
]

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
		throw new BridgeValidationError("Bridge result reported success=false", "result")
	}

	if (result.status !== "completed") {
		throw new BridgeValidationError(
			`Bridge result finished with unexpected status ${String(result.status)}`,
			"result"
		)
	}

	if (result.route !== route.route) {
		throw new BridgeValidationError(
			`Bridge result route ${String(result.route)} did not match expected route ${route.route}`,
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
