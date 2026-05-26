import { getSandbox, type Sandbox as SandboxContainer } from "@cloudflare/sandbox"
import {
	getValidatorRoute,
	type BridgeValidatorRoute,
	type BridgeValidatorRouteKey
} from "./routes"
import { WORKFLOW_HARD_TIMEOUT_MS } from "./runtime"
import type { BridgeCliJsonResult, ScheduledValidation } from "./types"

export const BRIDGE_CLI_SPECIFIER = "@zeko-labs/bridge-cli@latest"
export const BRIDGE_SANDBOX_OPTIONS = {
	keepAlive: true
} as const
export const BRIDGE_WORKSPACE_ROOT = "/workspace"
export const BRIDGE_CLI_BINARY = "zeko-bridge"
export const DEFAULT_BRIDGE_AMOUNT = "2"
export const BRIDGE_COMMAND_TIMEOUT_MS = WORKFLOW_HARD_TIMEOUT_MS
export const BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS = 5 * 60 * 1000
export const BRIDGE_COMMAND_PROCESS_ID = "bridge-validation-command"
export const BRIDGE_CALLBACK_PATH = "/bridge-callback"
export const BRIDGE_STATUS_PATH = "/bridge-status"
export const BRIDGE_CALLBACK_URL = `https://bridge-validator.zeko-labs.workers.dev${BRIDGE_CALLBACK_PATH}`
export const BRIDGE_COMMAND_SCRIPT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/run-bridge.sh`
export const BRIDGE_CALLBACK_SCRIPT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/post-callback.mjs`
export const BRIDGE_COMMAND_PID_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/bridge.pid`
export const BRIDGE_COMMAND_PROCESS_LOG_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/process.log`
export const BRIDGE_COMMAND_STDOUT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/stdout.json`
export const BRIDGE_COMMAND_STDERR_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/stderr.log`
export const BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES = 20_000
export const BRIDGE_COMMAND_CALLBACK_EVENT = "bridge-command-complete"

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

export type BridgeCommandCallbackPayload = {
	instanceId: string
	token: string
	exitCode: number
	stdout: string
	stderr: string
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

export const parseBridgeCommandCallbackPayload = (value: unknown): BridgeCommandCallbackPayload => {
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

export const buildBridgeProcessEnv = ({ walletPrivateKey }: { walletPrivateKey: string }) => ({
	HOME: `${BRIDGE_WORKSPACE_ROOT}/home`,
	MINA_PRIVATE_KEY: walletPrivateKey,
	WALLET_PRIVATE_KEY: walletPrivateKey,
	XDG_CACHE_HOME: `${BRIDGE_WORKSPACE_ROOT}/cache`,
	XDG_STATE_HOME: `${BRIDGE_WORKSPACE_ROOT}/state`
})

export const getBridgeSandbox = (
	sandboxNamespace: DurableObjectNamespace<SandboxContainer>,
	sandboxId: string
) => getSandbox(sandboxNamespace, sandboxId, BRIDGE_SANDBOX_OPTIONS)

export const destroyBridgeSandbox = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "destroy">
}) => {
	await sandbox.destroy()
}

export const getBridgeCommandStatus = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile" | "exec">
}) => {
	const pidFile = await sandbox.readFile(BRIDGE_COMMAND_PID_PATH).catch((error) => {
		if (error instanceof Error) {
			return null
		}

		throw error
	})
	const pid = pidFile?.content.trim()
	if (!pid || !/^\d+$/.test(pid)) {
		return {
			processId: BRIDGE_COMMAND_PROCESS_ID,
			found: false
		}
	}

	const status = await sandbox.exec(
		`if kill -0 ${pid} 2>/dev/null; then printf running; else printf exited; fi`,
		{
			cwd: BRIDGE_WORKSPACE_ROOT,
			timeout: 10_000
		}
	)

	return {
		processId: BRIDGE_COMMAND_PROCESS_ID,
		found: true,
		pid,
		status: status.stdout.trim() === "running" ? "running" : "exited"
	}
}

const readSandboxFile = async ({
	sandbox,
	path
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile">
	path: string
}) => {
	const file = await sandbox.readFile(path).catch((error) => {
		if (error instanceof Error) {
			return null
		}

		throw error
	})

	return file?.content ?? null
}

const tailDiagnosticText = (value: string | null) =>
	value === null ? null : value.slice(-BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES)

export const getBridgeCommandDiagnostics = async ({
	sandbox
}: {
	sandbox: Pick<ReturnType<typeof getBridgeSandbox>, "readFile">
}): Promise<BridgeCommandDiagnostics> => ({
	pidFile: tailDiagnosticText(await readSandboxFile({ sandbox, path: BRIDGE_COMMAND_PID_PATH })),
	processLog: tailDiagnosticText(
		await readSandboxFile({ sandbox, path: BRIDGE_COMMAND_PROCESS_LOG_PATH })
	),
	stdout: tailDiagnosticText(await readSandboxFile({ sandbox, path: BRIDGE_COMMAND_STDOUT_PATH })),
	stderr: tailDiagnosticText(await readSandboxFile({ sandbox, path: BRIDGE_COMMAND_STDERR_PATH }))
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

export const buildBridgeCallbackScript = () =>
	[
		"import fs from 'node:fs'",
		"import { setTimeout as sleep } from 'node:timers/promises'",
		"const required = (key) => {",
		"  const value = process.env[key]",
		"  if (!value) throw new Error(`Missing required environment variable ${key}`)",
		"  return value",
		"}",
		"const readText = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''",
		"const stderr = `${readText(required('BRIDGE_STDERR_PATH'))}${process.env.BRIDGE_STDERR_SUFFIX || ''}`",
		"const payload = {",
		"  instanceId: required('BRIDGE_WORKFLOW_INSTANCE_ID'),",
		"  token: required('BRIDGE_CALLBACK_TOKEN'),",
		"  exitCode: Number(process.env.BRIDGE_EXIT_CODE || 1),",
		"  stdout: readText(required('BRIDGE_STDOUT_PATH')),",
		"  stderr: stderr.slice(-20000)",
		"}",
		"let lastError = ''",
		"for (let attempt = 1; attempt <= 5; attempt += 1) {",
		"  try {",
		"    const response = await fetch(required('BRIDGE_CALLBACK_URL'), {",
		"      method: 'POST',",
		"      headers: {",
		"        'content-type': 'application/json',",
		"        authorization: `Bearer ${required('BRIDGE_API_TOKEN')}`",
		"      },",
		"      body: JSON.stringify(payload)",
		"    })",
		"    if (response.ok) process.exit(0)",
		"    lastError = `${response.status} ${await response.text()}`",
		"  } catch (error) {",
		"    lastError = error instanceof Error ? error.message : String(error)",
		"  }",
		"  await sleep(attempt * 1000)",
		"}",
		"console.error(`Bridge callback failed: ${lastError}`)",
		"process.exit(1)"
	].join("\n")

export const buildBridgeCommandScript = ({ routeKey }: { routeKey: BridgeValidatorRouteKey }) => {
	const timeoutSeconds = Math.floor(BRIDGE_COMMAND_TIMEOUT_MS / 1000)

	return [
		"#!/usr/bin/env bash",
		"set -u",
		`mkdir -p ${shellQuote(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator`)} /workspace/home /workspace/cache /workspace/state`,
		': "${BRIDGE_CALLBACK_TOKEN:?missing BRIDGE_CALLBACK_TOKEN}"',
		': "${BRIDGE_CALLBACK_URL:?missing BRIDGE_CALLBACK_URL}"',
		': "${BRIDGE_WORKFLOW_INSTANCE_ID:?missing BRIDGE_WORKFLOW_INSTANCE_ID}"',
		': "${BRIDGE_API_TOKEN:?missing BRIDGE_API_TOKEN}"',
		`stdout_path=${shellQuote(BRIDGE_COMMAND_STDOUT_PATH)}`,
		`stderr_path=${shellQuote(BRIDGE_COMMAND_STDERR_PATH)}`,
		'export BRIDGE_STDOUT_PATH="$stdout_path"',
		'export BRIDGE_STDERR_PATH="$stderr_path"',
		': > "$stdout_path"',
		': > "$stderr_path"',
		"post_bridge_callback() {",
		'  local callback_exit_code="$1"',
		'  local stderr_suffix="${2:-}"',
		`  BRIDGE_EXIT_CODE="$callback_exit_code" BRIDGE_STDERR_SUFFIX="$stderr_suffix" node ${shellQuote(BRIDGE_CALLBACK_SCRIPT_PATH)}`,
		"}",
		`watchdog_timeout_seconds=${timeoutSeconds}`,
		"(",
		'  sleep "$watchdog_timeout_seconds"',
		'  post_bridge_callback 124 "\\nbridge validator watchdog timeout after ${watchdog_timeout_seconds} seconds"',
		") &",
		'watchdog_pid="$!"',
		"set +e",
		"(",
		buildBridgeCommand({ routeKey }),
		') > "$stdout_path" 2> "$stderr_path"',
		"exit_code=$?",
		'post_bridge_callback "$exit_code" ""',
		"callback_exit_code=$?",
		'if [ "$callback_exit_code" -eq 0 ]; then',
		'  kill "$watchdog_pid" 2>/dev/null || true',
		'  wait "$watchdog_pid" 2>/dev/null || true',
		'  exit "$exit_code"',
		"fi",
		'echo "Bridge callback failed with exit code ${callback_exit_code}; watchdog remains armed." >&2',
		'wait "$watchdog_pid"',
		'exit "$exit_code"'
	].join("\n")
}

const buildShellEnvPrefix = (env: Record<string, string>) =>
	Object.entries(env)
		.map(([key, value]) => `${key}=${shellQuote(value)}`)
		.join(" ")

export const buildBridgeLaunchCommand = ({ env = {} }: { env?: Record<string, string> } = {}) => {
	const envPrefix = buildShellEnvPrefix(env)

	return [
		`${envPrefix ? `${envPrefix} ` : ""}nohup bash ${shellQuote(BRIDGE_COMMAND_SCRIPT_PATH)} > ${shellQuote(BRIDGE_COMMAND_PROCESS_LOG_PATH)} 2>&1 &`,
		'pid="$!"',
		`printf '%s' "$pid" > ${shellQuote(BRIDGE_COMMAND_PID_PATH)}`,
		"printf '%s' \"$pid\""
	].join("\n")
}

export const startBridgeCommand = async ({
	routeKey,
	sandbox,
	walletPrivateKey,
	instanceId,
	callbackToken,
	apiToken
}: {
	routeKey: BridgeValidatorRouteKey
	sandbox: Pick<
		ReturnType<typeof getBridgeSandbox>,
		"setKeepAlive" | "mkdir" | "writeFile" | "exec"
	>
	walletPrivateKey: string
	instanceId: string
	callbackToken: string
	apiToken: string
}) => {
	await sandbox.setKeepAlive(true)
	await sandbox.mkdir(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator`, { recursive: true })
	await sandbox.writeFile(BRIDGE_COMMAND_SCRIPT_PATH, buildBridgeCommandScript({ routeKey }), {
		encoding: "utf8"
	})
	await sandbox.writeFile(BRIDGE_CALLBACK_SCRIPT_PATH, buildBridgeCallbackScript(), {
		encoding: "utf8"
	})
	const env = {
		...buildBridgeProcessEnv({ walletPrivateKey }),
		BRIDGE_API_TOKEN: apiToken,
		BRIDGE_CALLBACK_TOKEN: callbackToken,
		BRIDGE_CALLBACK_URL,
		BRIDGE_WORKFLOW_INSTANCE_ID: instanceId
	}
	const result = await sandbox.exec(buildBridgeLaunchCommand({ env }), {
		cwd: BRIDGE_WORKSPACE_ROOT,
		timeout: BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS,
		env
	})

	return {
		processId: result.stdout.trim()
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

	if (result.error) {
		throw new BridgeValidationError(
			`Bridge result reported error ${String(result.error)}`,
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
		submittedTransactionCount: result.submitted_transactions.length,
		queueAdvanceCount: historyEntries.filter((entry) => entry.advancedPriorClaim === true).length,
		historyEventCount: historyEntries.length
	}
}
