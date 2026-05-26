import { afterEach, describe, expect, it, vi } from "vitest"
import {
	buildSlackFailureBlocks,
	buildSlackSuccessBlocks,
	buildSlackFailureMessage,
	buildSlackSuccessMessage,
	reportSlackSuccess
} from "../src/slack"
import type { BridgeCliJsonResult } from "../src/types"
import {
	BRIDGE_CLI_BINARY,
	BRIDGE_CLI_SPECIFIER,
	BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES,
	BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS,
	BRIDGE_COMMAND_PID_PATH,
	BRIDGE_COMMAND_PROCESS_ID,
	BRIDGE_COMMAND_PROCESS_LOG_PATH,
	BRIDGE_COMMAND_SCRIPT_PATH,
	BRIDGE_COMMAND_STDERR_PATH,
	BRIDGE_COMMAND_STDOUT_PATH,
	BRIDGE_COMMAND_TIMEOUT_MS,
	BRIDGE_SANDBOX_OPTIONS,
	BRIDGE_WORKSPACE_ROOT,
	buildBridgeCommand,
	buildBridgeCommandScript,
	buildBridgeLaunchCommand,
	buildBridgeProcessEnv,
	buildScheduledValidations,
	describeBridgeCommandFailure,
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
	amount: "1",
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

const completedTimings = {
	workflowStartedAtMs: 1_000,
	workflowFinishedAtMs: 12_500,
	totalDurationMs: 11_500,
	command: {
		startedAtMs: 2_000,
		finishedAtMs: 10_250,
		durationMs: 8_250
	},
	steps: [
		{
			name: "start bridge validation command",
			startedAtMs: 1_100,
			finishedAtMs: 1_400,
			durationMs: 300
		},
		{
			name: "wait for bridge command completion",
			startedAtMs: 1_400,
			finishedAtMs: 10_300,
			durationMs: 8_900
		}
	]
}

describe("bridge validator", () => {
	it("uses a keepAlive sandbox and a single published CLI command", () => {
		expect(BRIDGE_SANDBOX_OPTIONS).toEqual({ keepAlive: true })
		expect(BRIDGE_COMMAND_TIMEOUT_MS).toBe(115 * 60 * 1000)

		const command = buildBridgeCommand({ routeKey: "mina-to-zeko" })

		expect(command).toContain("timeout -k 30s -s TERM 6900s")
		expect(command).toContain(`${BRIDGE_CLI_BINARY} 'bridge'`)
		expect(command).toContain("'--from' 'mina:testnet' '--to' 'zeko:testnet'")
		expect(command).toContain("'--amount' '0.5' '--json' '--verbose'")
	})

	it("starts the bridge command as one background process in the Cloudflare Sandbox", async () => {
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
			command: buildBridgeLaunchCommand(),
			duration: 10,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(
			startBridgeCommand({
				routeKey: "mina-to-zeko",
				sandbox: { setKeepAlive, mkdir, writeFile, exec },
				walletPrivateKey: "wallet-secret"
			})
		).resolves.toEqual({
			pid: "1234",
			processId: BRIDGE_COMMAND_PROCESS_ID
		})

		expect(setKeepAlive).toHaveBeenCalledWith(true)
		expect(mkdir).toHaveBeenCalledWith("/workspace/bridge-validator", { recursive: true })
		expect(writeFile).toHaveBeenCalledWith(
			BRIDGE_COMMAND_SCRIPT_PATH,
			buildBridgeCommandScript({ routeKey: "mina-to-zeko" }),
			{ encoding: "utf8" }
		)
		expect(exec).toHaveBeenCalledWith(buildBridgeLaunchCommand(), {
			cwd: BRIDGE_WORKSPACE_ROOT,
			env: {
				...buildBridgeProcessEnv({ walletPrivateKey: "wallet-secret" })
			},
			timeout: BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS
		})
	})

	it("fails startup immediately when the Sandbox process cannot start", async () => {
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
			success: false,
			exitCode: 1,
			stdout: "",
			stderr: "process start failed",
			command: buildBridgeLaunchCommand(),
			duration: 10,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(
			startBridgeCommand({
				routeKey: "mina-to-zeko",
				sandbox: { setKeepAlive, mkdir, writeFile, exec },
				walletPrivateKey: "wallet-secret"
			})
		).rejects.toThrow("Bridge command launcher failed with exit code 1")
	})

	it("reports bridge command process status without reading bridge logs", async () => {
		const readFile = vi.fn(async (path: string) => {
			if (path === BRIDGE_COMMAND_PID_PATH) {
				return {
					success: true,
					path,
					content: "1234",
					timestamp: "2026-03-24T12:00:00Z"
				}
			}

			throw new Error("File not found")
		})
		const exec = vi.fn(async () => ({
			success: true,
			exitCode: 0,
			stdout: "running",
			stderr: "",
			command: "kill -0",
			duration: 10,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(getBridgeCommandStatus({ sandbox: { exec, readFile } })).resolves.toEqual({
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

		await expect(getBridgeCommandStatus({ sandbox: { exec, readFile } })).resolves.toEqual({
			processId: "bridge-validation-command",
			found: false
		})
	})

	it("reads diagnostic tails from the Sandbox process logs", async () => {
		const longStdout = `${"x".repeat(BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES)}{"success":false}`
		const readFile = vi.fn(async (path: string) => {
			if (path === BRIDGE_COMMAND_PID_PATH) {
				return {
					success: true,
					path,
					content: "1234",
					timestamp: "2026-03-24T12:00:00Z"
				}
			}

			if (path === BRIDGE_COMMAND_PROCESS_LOG_PATH) {
				return {
					success: true,
					path,
					content: "process output",
					timestamp: "2026-03-24T12:00:00Z"
				}
			}

			if (path === BRIDGE_COMMAND_STDOUT_PATH) {
				return {
					success: true,
					path,
					content: longStdout,
					timestamp: "2026-03-24T12:00:00Z"
				}
			}

			if (path === BRIDGE_COMMAND_STDERR_PATH) {
				return {
					success: true,
					path,
					content: "stderr output",
					timestamp: "2026-03-24T12:00:00Z"
				}
			}

			throw new Error("File not found")
		})
		await expect(getBridgeCommandDiagnostics({ sandbox: { readFile } })).resolves.toEqual({
			pidFile: "1234",
			processLog: "process output",
			stdout: `${"x".repeat(
				BRIDGE_COMMAND_DIAGNOSTIC_TAIL_BYTES - '{"success":false}'.length
			)}{"success":false}`,
			stderr: "stderr output"
		})
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
			amount: "1",
			finalHash: "hash-finalize",
			logPath: "/workspace/logs/bridge-op-1.jsonl",
			finalExplorerUrl: "https://zekoscan.io/testnet/tx/hash-finalize",
			submittedTransactionCount: 2,
			queueAdvanceCount: 0,
			historyEventCount: 3
		})
	})

	it("keeps a completed bridge result successful when the CLI preserves a retry warning", () => {
		const result = {
			...completedDepositResult,
			error: "Error getting account data"
		}
		const summary = validateBridgeCompletion({
			route: {
				key: "mina-to-zeko",
				from: "mina:testnet",
				to: "zeko:testnet",
				route: "mina:testnet->zeko:testnet",
				direction: "deposit"
			},
			result,
			historyLog: completedHistoryLog
		})

		expect(summary.cliReportedError).toBe("Error getting account data")
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
				summary,
				timings: completedTimings
			})
		).toContain("CLI warning: Error getting account data")
		expect(
			JSON.stringify(
				buildSlackSuccessBlocks({
					instanceId: "workflow-1",
					route: {
						key: "mina-to-zeko",
						from: "mina:testnet",
						to: "zeko:testnet",
						route: "mina:testnet->zeko:testnet",
						direction: "deposit"
					},
					cliVersion: BRIDGE_CLI_SPECIFIER,
					summary,
					timings: completedTimings
				})
			)
		).toContain("CLI warning")
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
				summary,
				timings: completedTimings
			})
		).toContain("hash-finalize")
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
				summary,
				timings: completedTimings
			})
		).toContain("wait for bridge command completion: 8.900s (8900 ms)")
		expect(
			JSON.stringify(
				buildSlackSuccessBlocks({
					instanceId: "workflow-1",
					route: {
						key: "mina-to-zeko",
						from: "mina:testnet",
						to: "zeko:testnet",
						route: "mina:testnet->zeko:testnet",
						direction: "deposit"
					},
					cliVersion: BRIDGE_CLI_SPECIFIER,
					summary,
					timings: completedTimings
				})
			)
		).toContain("<https://zekoscan.io/testnet/tx/hash-finalize|hash-finalize>")

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
				stdout: `first stdout line\n${"x".repeat(13_000)}\nlast stdout line`,
				stderr: "failed",
				message: "Bridge command exited with code 1. Last diagnostic: failed",
				timings: completedTimings
			})
		).toContain("```")
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
				stdout: `first stdout line\n${"x".repeat(13_000)}\nlast stdout line`,
				stderr: "failed",
				message: "Bridge command exited with code 1. Last diagnostic: failed",
				timings: completedTimings
			})
		).toContain("last stdout line")
		expect(
			JSON.stringify(
				buildSlackFailureBlocks({
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
					exitCode: 124,
					stdout: "polling bridge state",
					stderr: "bridge validator watchdog timeout after 6900 seconds",
					message: "Bridge command timed out after 6900s (6900000 ms)",
					timings: completedTimings
				})
			)
		).toContain("```")
	})

	it("describes bridge command timeout failures with the actual duration and diagnostic", () => {
		expect(
			describeBridgeCommandFailure({
				exitCode: 124,
				stdout: "polling bridge state",
				stderr: "bridge validator watchdog timeout after 6900 seconds",
				timing: {
					startedAtMs: 1_000,
					finishedAtMs: 6_901_000,
					durationMs: 6_900_000
				}
			})
		).toBe(
			"Bridge command timed out after 6900s (6900000 ms) before reaching a terminal bridge result. Last diagnostic: bridge validator watchdog timeout after 6900 seconds"
		)
	})

	it("posts rich Slack success blocks", async () => {
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
		const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
			Response.json({ ok: true })
		)
		vi.stubGlobal("fetch", fetchMock)

		await reportSlackSuccess({
			slackBotToken: "token",
			slackChannelId: "channel",
			instanceId: "workflow-1",
			routeKey: "mina-to-zeko",
			cliVersion: BRIDGE_CLI_SPECIFIER,
			summary,
			timings: completedTimings
		})

		const requestInit = fetchMock.mock.calls[0]?.[1]
		expect(requestInit).toBeDefined()
		const body = JSON.parse(String(requestInit?.body))
		expect(body.blocks[0]).toEqual({
			type: "header",
			text: { type: "plain_text", text: "Bridge Validator Passed", emoji: false }
		})
		expect(JSON.stringify(body.blocks)).toContain(
			"<https://zekoscan.io/testnet/tx/hash-finalize|hash-finalize>"
		)
		expect(JSON.stringify(body.blocks)).toContain(
			"wait for bridge command completion: 8.900s (8900 ms)"
		)
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
				summary,
				timings: completedTimings
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
