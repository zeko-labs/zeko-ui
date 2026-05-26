import { afterEach, describe, expect, it, vi } from "vitest"
import {
	buildSlackFailureMessage,
	buildSlackSuccessMessage,
	reportSlackSuccess
} from "../src/slack"
import type { BridgeCliJsonResult } from "../src/types"
import {
	BRIDGE_CLI_BINARY,
	BRIDGE_CLI_SPECIFIER,
	BRIDGE_CALLBACK_SCRIPT_PATH,
	BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES,
	BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS,
	BRIDGE_COMMAND_PID_PATH,
	BRIDGE_COMMAND_PROCESS_LOG_PATH,
	BRIDGE_COMMAND_SCRIPT_PATH,
	BRIDGE_COMMAND_STDERR_PATH,
	BRIDGE_COMMAND_STDOUT_PATH,
	BRIDGE_COMMAND_TIMEOUT_MS,
	BRIDGE_CALLBACK_URL,
	BRIDGE_SANDBOX_OPTIONS,
	BRIDGE_WORKSPACE_ROOT,
	buildBridgeCommand,
	buildBridgeCallbackScript,
	buildBridgeLaunchCommand,
	buildBridgeCommandScript,
	buildBridgeProcessEnv,
	buildScheduledValidations,
	destroyBridgeSandbox,
	getBridgeCommandDiagnostics,
	getBridgeCommandStatus,
	parseBridgeHistoryLog,
	parseBridgeJson,
	startBridgeCommand,
	validateBridgeCompletion
} from "../src/validator"

vi.mock("@cloudflare/sandbox", () => ({
	getSandbox: vi.fn((_namespace, sandboxId, options) => ({
		sandboxId,
		options
	})),
	Sandbox: class Sandbox {}
}))

afterEach(() => {
	vi.unstubAllGlobals()
})

const completedDepositResult: BridgeCliJsonResult = {
	success: true,
	operation_id: "bridge-op-1",
	route: "mina:testnet->zeko:testnet",
	direction: "deposit",
	status: "completed",
	amount: "2",
	recipient: "B62test",
	submitted_transactions: [
		{ action: "submit", hash: "hash-submit" },
		{ action: "finalize", hash: "hash-finalize" }
	],
	final_transaction: {
		action: "finalize",
		hash: "hash-finalize",
		explorerUrl: "https://zekoscan.io/testnet/tx/hash-finalize"
	},
	explorer_urls: ["https://zekoscan.io/testnet/tx/hash-finalize"],
	log_path: "/workspace/logs/bridge-op-1.jsonl",
	error: null
}

const completedHistoryLog = [
	JSON.stringify({ event: "submitted", hash: "hash-submit" }),
	JSON.stringify({ event: "submitted", hash: "hash-finalize" }),
	JSON.stringify({ event: "completed", hash: "hash-finalize" })
].join("\n")

describe("bridge validator", () => {
	it("uses a keepAlive sandbox and a single published CLI command", () => {
		expect(BRIDGE_SANDBOX_OPTIONS).toEqual({ keepAlive: true })
		expect(BRIDGE_COMMAND_TIMEOUT_MS).toBe(2 * 60 * 60 * 1000)

		const command = buildBridgeCommand({ routeKey: "mina-to-zeko" })

		expect(command).toContain("timeout -k 30s -s TERM 7200s")
		expect(command).toContain(`${BRIDGE_CLI_BINARY} 'bridge'`)
		expect(command).toContain("'--from' 'mina:testnet' '--to' 'zeko:testnet'")
		expect(command).toContain("'--amount' '2' '--json' '--verbose'")
	})

	it("starts the bridge command and passes callback state into the sandbox", async () => {
		const setKeepAlive = vi.fn(async () => {})
		const mkdir = vi.fn(async () => ({
			success: true,
			path: "/workspace/bridge-validator",
			recursive: true,
			timestamp: "2026-03-24T12:00:00Z"
		}))
		const writeFile = vi.fn(async () => ({
			success: true,
			path: BRIDGE_COMMAND_SCRIPT_PATH,
			bytesWritten: 1,
			timestamp: "2026-03-24T12:00:00Z"
		}))
		const exec = vi.fn(async () => ({
			success: true,
			exitCode: 0,
			stdout: "1234",
			stderr: "",
			command: "launch",
			duration: 1,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(
			startBridgeCommand({
				routeKey: "mina-to-zeko",
				sandbox: { setKeepAlive, mkdir, writeFile, exec },
				walletPrivateKey: "wallet-secret",
				instanceId: "workflow-1",
				callbackToken: "callback-token",
				apiToken: "api-token"
			})
		).resolves.toEqual({
			processId: "1234"
		})

		expect(setKeepAlive).toHaveBeenCalledWith(true)
		expect(mkdir).toHaveBeenCalledWith("/workspace/bridge-validator", { recursive: true })
		expect(writeFile).toHaveBeenCalledWith(
			BRIDGE_COMMAND_SCRIPT_PATH,
			expect.stringContaining("BRIDGE_WORKFLOW_INSTANCE_ID"),
			{ encoding: "utf8" }
		)
		expect(writeFile).toHaveBeenCalledWith(
			BRIDGE_CALLBACK_SCRIPT_PATH,
			expect.stringContaining("BRIDGE_API_TOKEN"),
			{ encoding: "utf8" }
		)
		expect(exec).toHaveBeenCalledWith(expect.stringContaining("nohup bash"), {
			cwd: BRIDGE_WORKSPACE_ROOT,
			timeout: BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS,
			env: {
				...buildBridgeProcessEnv({ walletPrivateKey: "wallet-secret" }),
				BRIDGE_API_TOKEN: "api-token",
				BRIDGE_CALLBACK_TOKEN: "callback-token",
				BRIDGE_CALLBACK_URL,
				BRIDGE_WORKFLOW_INSTANCE_ID: "workflow-1"
			}
		})
	})

	it("builds a short nohup launcher for the bridge runner", () => {
		expect(buildBridgeLaunchCommand()).toContain(`nohup bash '${BRIDGE_COMMAND_SCRIPT_PATH}'`)
		expect(buildBridgeLaunchCommand()).toContain(`> '${BRIDGE_COMMAND_PROCESS_LOG_PATH}' 2>&1 &`)
		expect(buildBridgeLaunchCommand()).toContain(`> '${BRIDGE_COMMAND_PID_PATH}'`)
		expect(buildBridgeLaunchCommand()).not.toContain("callback token")
		expect(buildBridgeLaunchCommand()).not.toContain("wallet-secret")
	})

	it("wraps the single bridge CLI command with stdout, stderr, and callback capture", () => {
		const script = buildBridgeCommandScript({ routeKey: "mina-to-zeko" })

		expect(script).toContain("timeout -k 30s -s TERM 7200s")
		expect(script).toContain(`${BRIDGE_CLI_BINARY} 'bridge'`)
		expect(script).toContain("stdout.json")
		expect(script).toContain("stderr.log")
		expect(script).toContain("BRIDGE_WORKFLOW_INSTANCE_ID")
		expect(script).toContain("BRIDGE_API_TOKEN")
		expect(script).toContain("watchdog_timeout_seconds=7200")
		expect(script).toContain("bridge validator watchdog timeout")
	})

	it("posts callbacks with bearer authentication", () => {
		expect(buildBridgeCallbackScript()).toContain(
			"authorization: `Bearer ${required('BRIDGE_API_TOKEN')}`"
		)
		expect(buildBridgeCallbackScript()).toContain("fetch(required('BRIDGE_CALLBACK_URL')")
	})

	it("reports bridge command process status without reading bridge logs", async () => {
		const readFile = vi.fn(async () => ({
			success: true,
			path: BRIDGE_COMMAND_PID_PATH,
			content: "1234",
			timestamp: "2026-03-24T12:00:00Z"
		}))
		const exec = vi.fn(async () => ({
			success: true,
			exitCode: 0,
			stdout: "running",
			stderr: "",
			command: "status",
			duration: 1,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(getBridgeCommandStatus({ sandbox: { readFile, exec } })).resolves.toEqual({
			processId: "bridge-validation-command",
			found: true,
			pid: "1234",
			status: "running"
		})
	})

	it("reports a missing bridge command process without throwing", async () => {
		const readFile = vi.fn(async () => {
			throw new Error("File not found")
		})
		const exec = vi.fn()

		await expect(getBridgeCommandStatus({ sandbox: { readFile, exec } })).resolves.toEqual({
			processId: "bridge-validation-command",
			found: false
		})
	})

	it("reads diagnostic tails from the sandbox runner files", async () => {
		const longProcessLog = `${"x".repeat(BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES)}callback failed`
		const files = new Map([
			[BRIDGE_COMMAND_PID_PATH, "1234"],
			[BRIDGE_COMMAND_PROCESS_LOG_PATH, longProcessLog],
			[BRIDGE_COMMAND_STDOUT_PATH, '{"success":false}']
		])
		const readFile = vi.fn(async (path: string) => {
			const content = files.get(path)
			if (content === undefined) {
				throw new Error("File not found")
			}

			return {
				success: true,
				path,
				content,
				timestamp: "2026-03-24T12:00:00Z"
			}
		})

		await expect(getBridgeCommandDiagnostics({ sandbox: { readFile } })).resolves.toEqual({
			pidFile: "1234",
			processLog: `${"x".repeat(
				BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES - "callback failed".length
			)}callback failed`,
			stdout: '{"success":false}',
			stderr: null
		})
		expect(readFile).toHaveBeenCalledWith(BRIDGE_COMMAND_STDERR_PATH)
	})

	it("builds fixed scheduled deposit and withdrawal validations", () => {
		expect(buildScheduledValidations({ scheduledTime: 123 })).toEqual([
			{
				id: "bridge-validator-mina-to-zeko-123",
				params: { routeKey: "mina-to-zeko" }
			},
			{
				id: "bridge-validator-zeko-to-mina-123",
				params: { routeKey: "zeko-to-mina" }
			}
		])
	})

	it("parses and validates a completed bridge result against history", () => {
		expect(parseBridgeJson(JSON.stringify(completedDepositResult))).toEqual(completedDepositResult)
		expect(
			parseBridgeJson(
				[
					"canFinalizeDeposit start { pk: 'B62q...' }",
					"canFinalizeDeposit result { ok: false, msg: 'No finalizable deposit found' }",
					JSON.stringify(completedDepositResult)
				].join("\n")
			)
		).toEqual(completedDepositResult)
		expect(
			validateBridgeCompletion({
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko:testnet",
					route: "mina:testnet->zeko:testnet",
					direction: "deposit"
				},
				result: completedDepositResult,
				historyLog: completedHistoryLog
			})
		).toEqual({
			operationId: "bridge-op-1",
			route: "mina:testnet->zeko:testnet",
			direction: "deposit",
			amount: "2",
			finalHash: "hash-finalize",
			logPath: "/workspace/logs/bridge-op-1.jsonl",
			submittedTransactionCount: 2,
			queueAdvanceCount: 0,
			historyEventCount: 3
		})
	})

	it("rejects invalid json and incomplete history", () => {
		expect(() => parseBridgeJson("not json")).toThrow("Failed to parse bridge JSON output")
		expect(() => parseBridgeHistoryLog("")).toThrow("Bridge history log is empty")
		expect(() =>
			validateBridgeCompletion({
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko:testnet",
					route: "mina:testnet->zeko:testnet",
					direction: "deposit"
				},
				result: completedDepositResult,
				historyLog: JSON.stringify({ event: "completed", hash: "hash-finalize" })
			})
		).toThrow("Bridge history log does not confirm submitted transaction hash hash-submit")
	})

	it("formats Slack success and failure payloads with validation evidence", async () => {
		const summary = validateBridgeCompletion({
			route: {
				key: "mina-to-zeko",
				from: "mina:testnet",
				to: "zeko:testnet",
				route: "mina:testnet->zeko:testnet",
				direction: "deposit"
			},
			result: completedDepositResult,
			historyLog: completedHistoryLog
		})

		expect(
			buildSlackSuccessMessage({
				instanceId: "workflow-1",
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko:testnet",
					route: "mina:testnet->zeko:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				summary
			})
		).toContain("hash-finalize")

		expect(
			buildSlackFailureMessage({
				instanceId: "workflow-1",
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko:testnet",
					route: "mina:testnet->zeko:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				stage: "process",
				exitCode: 1,
				stdout: "",
				stderr: "failed",
				message: "Bridge command exited non-zero"
			})
		).toContain("Bridge command exited non-zero")
	})

	it("fails successful validation reporting when Slack rejects the success message", async () => {
		const summary = validateBridgeCompletion({
			route: {
				key: "mina-to-zeko",
				from: "mina:testnet",
				to: "zeko:testnet",
				route: "mina:testnet->zeko:testnet",
				direction: "deposit"
			},
			result: completedDepositResult,
			historyLog: completedHistoryLog
		})
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ ok: false, error: "channel_not_found" }))
		)

		await expect(
			reportSlackSuccess({
				slackBotToken: "token",
				slackChannelId: "channel",
				instanceId: "workflow-1",
				routeKey: "mina-to-zeko",
				cliVersion: BRIDGE_CLI_SPECIFIER,
				summary
			})
		).rejects.toThrow("Slack notification failed: channel_not_found")
	})

	it("destroys the sandbox", async () => {
		const destroy = vi.fn(async () => {})

		await destroyBridgeSandbox({
			sandbox: { destroy }
		})

		expect(destroy).toHaveBeenCalledOnce()
	})
})
