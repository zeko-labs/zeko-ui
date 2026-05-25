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
export const BRIDGE_COMMAND_PID_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/bridge.pid`
export const BRIDGE_COMMAND_PROCESS_LOG_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/process.log`
export const BRIDGE_COMMAND_STDOUT_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/stdout.json`
export const BRIDGE_COMMAND_STDERR_PATH = `${BRIDGE_WORKSPACE_ROOT}/bridge-validator/stderr.log`

export type BridgeCommandResult = {
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
		`bridge_entrypoint="$(readlink -f "$(command -v ${BRIDGE_CLI_BINARY})")"`,
		`timeout -k 30s -s TERM ${timeoutSeconds}s node "$bridge_entrypoint" ${args}`
	].join("\n")
}

export const buildBridgeCommandScript = ({ routeKey }: { routeKey: BridgeValidatorRouteKey }) =>
	[
		"#!/usr/bin/env bash",
		"set -u",
		`mkdir -p ${shellQuote(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator`)} /workspace/home /workspace/cache /workspace/state`,
		`stdout_path=${shellQuote(BRIDGE_COMMAND_STDOUT_PATH)}`,
		`stderr_path=${shellQuote(BRIDGE_COMMAND_STDERR_PATH)}`,
		': > "$stdout_path"',
		': > "$stderr_path"',
		"set +e",
		"(",
		buildBridgeCommand({ routeKey }),
		') > "$stdout_path" 2> "$stderr_path"',
		"exit_code=$?",
		"BRIDGE_EXIT_CODE=\"$exit_code\" node --input-type=module <<'NODE'",
		"import fs from 'node:fs'",
		"const readText = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''",
		"const payload = {",
		"  instanceId: process.env.BRIDGE_WORKFLOW_INSTANCE_ID,",
		"  token: process.env.BRIDGE_CALLBACK_TOKEN,",
		"  exitCode: Number(process.env.BRIDGE_EXIT_CODE || 1),",
		`  stdout: readText(${JSON.stringify(BRIDGE_COMMAND_STDOUT_PATH)}),`,
		`  stderr: readText(${JSON.stringify(BRIDGE_COMMAND_STDERR_PATH)}).slice(-20000)`,
		"}",
		"const response = await fetch(process.env.BRIDGE_CALLBACK_URL, {",
		"  method: 'POST',",
		"  headers: { 'content-type': 'application/json' },",
		"  body: JSON.stringify(payload)",
		"})",
		"if (!response.ok) {",
		"  console.error(await response.text())",
		"  process.exit(1)",
		"}",
		"NODE",
		'exit "$exit_code"'
	].join("\n")

export const buildBridgeLaunchCommand = () =>
	[
		`nohup bash ${shellQuote(BRIDGE_COMMAND_SCRIPT_PATH)} > ${shellQuote(BRIDGE_COMMAND_PROCESS_LOG_PATH)} 2>&1 &`,
		'pid="$!"',
		`printf '%s' "$pid" > ${shellQuote(BRIDGE_COMMAND_PID_PATH)}`,
		"printf '%s' \"$pid\""
	].join("\n")

export const startBridgeCommand = async ({
	routeKey,
	sandbox,
	walletPrivateKey,
	instanceId,
	callbackToken
}: {
	routeKey: BridgeValidatorRouteKey
	sandbox: Pick<
		ReturnType<typeof getBridgeSandbox>,
		"setKeepAlive" | "mkdir" | "writeFile" | "exec"
	>
	walletPrivateKey: string
	instanceId: string
	callbackToken: string
}) => {
	await sandbox.setKeepAlive(true)
	await sandbox.mkdir(`${BRIDGE_WORKSPACE_ROOT}/bridge-validator`, { recursive: true })
	await sandbox.writeFile(BRIDGE_COMMAND_SCRIPT_PATH, buildBridgeCommandScript({ routeKey }), {
		encoding: "utf8"
	})
	const result = await sandbox.exec(buildBridgeLaunchCommand(), {
		cwd: BRIDGE_WORKSPACE_ROOT,
		timeout: BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS,
		env: {
			...buildBridgeProcessEnv({ walletPrivateKey }),
			BRIDGE_CALLBACK_TOKEN: callbackToken,
			BRIDGE_CALLBACK_URL,
			BRIDGE_WORKFLOW_INSTANCE_ID: instanceId
		}
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
