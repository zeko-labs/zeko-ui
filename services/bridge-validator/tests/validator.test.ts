import { afterEach, describe, expect, it, vi } from "vitest"
import {
	buildSlackFailureBlocks,
	buildSlackSuccessBlocks,
	buildSlackFailureMessage,
	buildSlackSuccessMessage,
	reportSlackFailure,
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
	BRIDGE_COMMAND_STDERR_PATH,
	BRIDGE_COMMAND_STDOUT_PATH,
	BRIDGE_COMMAND_TIMEOUT_MS,
	BRIDGE_SANDBOX_OPTIONS,
	BRIDGE_SANDBOX_PREPARE_TIMEOUT_MS,
	BRIDGE_WORKSPACE_ROOT,
	buildBridgeSandboxId,
	buildBridgeCommand,
	buildBridgeCommandScript,
	buildBridgeLaunchCommand,
	buildBridgeProcessEnv,
	buildBridgeSourceSetupCommand,
	buildScheduledValidations,
	describeBridgeCommandFailure,
	destroyBridgeSandbox,
	getBridgeCommandDiagnostics,
	getBridgeCommandStatus,
	parseBridgeHistoryLog,
	parseBridgeJson,
	prepareBridgeSandbox,
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
	vi.restoreAllMocks()
})

const completedDepositResult: BridgeCliJsonResult = {
	success: true,
	operation_id: "bridge-op-1",
	route: "mina:testnet->zeko-m:testnet",
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
const walletPublicKey = "B62validator"

describe("bridge validator", () => {
	it("uses a keepAlive sandbox and a single CLI command", () => {
		expect(BRIDGE_SANDBOX_OPTIONS).toEqual({ keepAlive: true })
		expect(BRIDGE_COMMAND_TIMEOUT_MS).toBe(115 * 60 * 1000)

		const command = buildBridgeCommand({ routeKey: "mina-to-zeko" })

		expect(command).toContain("timeout -k 30s -s TERM 6900s")
		expect(command).toContain(`bridge_command=('${BRIDGE_CLI_BINARY}')`)
		expect(command).toContain("\"${bridge_command[@]}\" 'bridge'")
		expect(command).toContain("'--from' 'mina:testnet' '--to' 'zeko:testnet'")
		expect(command).toContain("'--amount' '2' '--json' '--verbose'")
		expect(buildBridgeCommand({ routeKey: "zeko-to-mina" })).toContain(
			"'--from' 'zeko:testnet' '--to' 'mina:testnet'"
		)
		expect(buildBridgeCommand({ routeKey: "zeko-to-mina" })).toContain(
			"'--amount' '2' '--json' '--verbose'"
		)
	})

	it("can build bridge CLI from a source checkout before running validation", () => {
		const command = buildBridgeSourceSetupCommand()

		expect(command).toContain("BRIDGE_VALIDATOR_SOURCE_REPOSITORY")
		expect(command).toContain("mkdir -p '/workspace/bridge-validator'")
		expect(command).toContain("git fetch --depth 1 origin")
		expect(command).toContain(
			"pnpm install --frozen-lockfile --filter @zeko-labs/bridge-cli... --ignore-scripts"
		)
		expect(command).toContain("pnpm --dir packages/bridge-sdk exec tsdown")
		expect(command).toContain("pnpm --dir packages/bridge-cli exec tsdown")
		expect(buildBridgeCommand({ routeKey: "mina-to-zeko" })).toContain(
			"packages/bridge-cli/dist/cli.js"
		)
		expect(buildBridgeCommand({ routeKey: "mina-to-zeko" })).not.toContain("git clone")
	})

	it("prepares source builds in the foreground before launching the long bridge command", async () => {
		const exec = vi.fn(async () => ({
			success: true,
			exitCode: 0,
			stdout: "setup complete",
			stderr: "",
			command: buildBridgeSourceSetupCommand(),
			duration: 10,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(
			prepareBridgeSandbox({
				sandbox: { exec },
				walletPrivateKey: "wallet-secret",
				githubToken: "github-token",
				sourceBuild: {
					repository: "https://github.com/zeko-labs/zeko-ui.git",
					ref: "refs/pull/150/head"
				}
			})
		).resolves.toMatchObject({
			success: true,
			stdout: "setup complete"
		})

		expect(exec).toHaveBeenCalledWith(buildBridgeSourceSetupCommand(), {
			cwd: BRIDGE_WORKSPACE_ROOT,
			env: {
				...buildBridgeProcessEnv({
					walletPrivateKey: "wallet-secret",
					githubToken: "github-token",
					sourceBuild: {
						repository: "https://github.com/zeko-labs/zeko-ui.git",
						ref: "refs/pull/150/head"
					}
				})
			},
			timeout: BRIDGE_SANDBOX_PREPARE_TIMEOUT_MS
		})
	})

	it("starts the bridge command as one background process in the Cloudflare Sandbox", async () => {
		const exec = vi.fn(async () => ({
			success: true,
			exitCode: 0,
			stdout: "1234",
			stderr: "",
			command: buildBridgeLaunchCommand({ routeKey: "mina-to-zeko" }),
			duration: 10,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(
			startBridgeCommand({
				routeKey: "mina-to-zeko",
				sandbox: { exec },
				walletPrivateKey: "wallet-secret"
			})
		).resolves.toEqual({
			pid: "1234",
			processId: BRIDGE_COMMAND_PROCESS_ID
		})

		expect(exec).toHaveBeenCalledWith(buildBridgeLaunchCommand({ routeKey: "mina-to-zeko" }), {
			cwd: BRIDGE_WORKSPACE_ROOT,
			env: {
				...buildBridgeProcessEnv({ walletPrivateKey: "wallet-secret" })
			},
			timeout: BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS
		})
		expect(buildBridgeCommandScript({ routeKey: "mina-to-zeko" })).toContain(
			'printf "%s" "$exit_code" > "$exit_code_path"\nwhile :; do'
		)
		expect(buildBridgeCommandScript({ routeKey: "mina-to-zeko" })).toContain(
			"trap 'exit 0' TERM INT"
		)
	})

	it("passes source-build configuration to the sandbox environment without embedding it in the command", async () => {
		const exec = vi.fn(async () => ({
			success: true,
			exitCode: 0,
			stdout: "1234",
			stderr: "",
			command: buildBridgeLaunchCommand({ routeKey: "mina-to-zeko" }),
			duration: 10,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await startBridgeCommand({
			routeKey: "mina-to-zeko",
			sandbox: { exec },
			walletPrivateKey: "wallet-secret",
			githubToken: "github-token",
			sourceBuild: {
				repository: "https://github.com/zeko-labs/zeko-ui.git",
				ref: "refs/pull/150/head"
			}
		})

		expect(exec).toHaveBeenCalledWith(buildBridgeLaunchCommand({ routeKey: "mina-to-zeko" }), {
			cwd: BRIDGE_WORKSPACE_ROOT,
			env: {
				...buildBridgeProcessEnv({
					walletPrivateKey: "wallet-secret",
					githubToken: "github-token",
					sourceBuild: {
						repository: "https://github.com/zeko-labs/zeko-ui.git",
						ref: "refs/pull/150/head"
					}
				})
			},
			timeout: BRIDGE_COMMAND_LAUNCH_TIMEOUT_MS
		})
		expect(buildBridgeLaunchCommand({ routeKey: "mina-to-zeko" })).not.toContain("github-token")
	})

	it("fails startup immediately when the Sandbox process cannot start", async () => {
		const exec = vi.fn(async () => ({
			success: false,
			exitCode: 1,
			stdout: "",
			stderr: "process start failed",
			command: buildBridgeLaunchCommand({ routeKey: "mina-to-zeko" }),
			duration: 10,
			timestamp: "2026-03-24T12:00:00Z"
		}))

		await expect(
			startBridgeCommand({
				routeKey: "mina-to-zeko",
				sandbox: { exec },
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

	it("builds independent scheduled deposit and withdrawal validations", () => {
		const scheduledTime = Date.UTC(2026, 5, 10, 9, 0, 0)
		const validations = buildScheduledValidations({ scheduledTime })

		expect(validations).toEqual([
			{
				id: `bridge-validator-mina-to-zeko-${scheduledTime}`,
				params: { routeKey: "mina-to-zeko" }
			},
			{
				id: `bridge-validator-zeko-to-mina-${scheduledTime}`,
				params: { routeKey: "zeko-to-mina" }
			}
		])
		expect(new Set(validations.map(({ id }) => id)).size).toBe(validations.length)
	})

	it("builds Cloudflare-compatible sandbox ids for long workflow ids", () => {
		const sandboxId = buildBridgeSandboxId({
			instanceId: "bridge-validator-manual-mina-to-zeko-1780308047887",
			attempt: 1
		})

		expect(sandboxId).toMatch(/^bridge-validator-[a-z0-9-]+$/)
		expect(sandboxId.length).toBeLessThanOrEqual(63)
		expect(sandboxId).toBe(
			buildBridgeSandboxId({
				instanceId: "bridge-validator-manual-mina-to-zeko-1780308047887",
				attempt: 1
			})
		)
		expect(sandboxId).not.toBe(
			buildBridgeSandboxId({
				instanceId: "bridge-validator-manual-mina-to-zeko-1780308047888",
				attempt: 1
			})
		)
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
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				result: completedDepositResult,
				historyLog: completedHistoryLog
			})
		).toEqual({
			operationId: "bridge-op-1",
			route: "mina:testnet->zeko-m:testnet",
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

	it("accepts legacy CLI route output while reporting the canonical route", () => {
		const summary = validateBridgeCompletion({
			route: {
				key: "mina-to-zeko",
				from: "mina:testnet",
				to: "zeko-m:testnet",
				route: "mina:testnet->zeko-m:testnet",
				cliFrom: "mina:testnet",
				cliTo: "zeko:testnet",
				acceptedResultRoutes: ["mina:testnet->zeko-m:testnet", "mina:testnet->zeko:testnet"],
				direction: "deposit"
			},
			result: { ...completedDepositResult, route: "mina:testnet->zeko:testnet" },
			historyLog: completedHistoryLog
		})

		expect(summary.route).toBe("mina:testnet->zeko-m:testnet")
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
				to: "zeko-m:testnet",
				route: "mina:testnet->zeko-m:testnet",
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
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				walletPublicKey,
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
						to: "zeko-m:testnet",
						route: "mina:testnet->zeko-m:testnet",
						direction: "deposit"
					},
					cliVersion: BRIDGE_CLI_SPECIFIER,
					walletPublicKey,
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
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				result: completedDepositResult,
				historyLog: JSON.stringify({ event: "completed", hash: "hash-finalize" })
			})
		).toThrow("Bridge history log does not confirm submitted transaction hash hash-submit")
	})

	it("reports parsed CLI failure evidence instead of a generic result failure", () => {
		const failedResult: BridgeCliJsonResult = {
			...completedDepositResult,
			success: false,
			status: "failed",
			operation_id: "failed-op-1",
			final_transaction: null,
			log_path: "/workspace/state/zeko-bridge/logs/failed-op-1.jsonl",
			error: "Account_app_state_precondition_unsatisfied"
		}

		expect(() =>
			validateBridgeCompletion({
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				result: failedResult,
				historyLog: completedHistoryLog
			})
		).toThrow(
			"Bridge result reported success=false; status=failed; operation_id=failed-op-1; log_path=/workspace/state/zeko-bridge/logs/failed-op-1.jsonl; submitted_hashes=hash-submit,hash-finalize; cli_error=Account_app_state_precondition_unsatisfied"
		)
	})

	it("formats Slack success and failure payloads with validation evidence", async () => {
		const summary = validateBridgeCompletion({
			route: {
				key: "mina-to-zeko",
				from: "mina:testnet",
				to: "zeko-m:testnet",
				route: "mina:testnet->zeko-m:testnet",
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
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				walletPublicKey,
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
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				walletPublicKey,
				summary,
				timings: completedTimings
			})
		).toContain("Bridge command:* 8.250s (8250 ms)")
		expect(
			buildSlackSuccessMessage({
				instanceId: "workflow-1",
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				walletPublicKey,
				summary,
				timings: completedTimings
			})
		).not.toContain("wait for bridge command completion")
		expect(
			JSON.stringify(
				buildSlackSuccessBlocks({
					instanceId: "workflow-1",
					route: {
						key: "mina-to-zeko",
						from: "mina:testnet",
						to: "zeko-m:testnet",
						route: "mina:testnet->zeko-m:testnet",
						direction: "deposit"
					},
					cliVersion: BRIDGE_CLI_SPECIFIER,
					walletPublicKey,
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
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				walletPublicKey,
				stage: "process",
				exitCode: 1,
				stdout: `first stdout line\n${"x".repeat(13_000)}\nlast stdout line`,
				stderr: "failed",
				message: "Bridge command exited with code 1. Last diagnostic: failed",
				timings: completedTimings
			})
		).not.toContain("```")
		expect(
			buildSlackFailureMessage({
				instanceId: "workflow-1",
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				walletPublicKey,
				stage: "process",
				exitCode: 1,
				stdout: `first stdout line\n${"x".repeat(13_000)}\nlast stdout line`,
				stderr: "failed",
				message: "Bridge command exited with code 1. Last diagnostic: failed",
				timings: completedTimings
			})
		).not.toContain("last stdout line")
		expect(
			buildSlackFailureMessage({
				instanceId: "workflow-1",
				route: {
					key: "mina-to-zeko",
					from: "mina:testnet",
					to: "zeko-m:testnet",
					route: "mina:testnet->zeko-m:testnet",
					direction: "deposit"
				},
				cliVersion: BRIDGE_CLI_SPECIFIER,
				walletPublicKey,
				stage: "process",
				exitCode: 1,
				stdout: "stdout",
				stderr: "failed",
				message: "Bridge command exited with code 1. Last diagnostic: failed",
				timings: completedTimings
			})
		).toContain("Diagnostic file uploads requested: `stdout.log`, `stderr.log`.")
		expect(
			JSON.stringify(
				buildSlackFailureBlocks({
					instanceId: "workflow-1",
					route: {
						key: "mina-to-zeko",
						from: "mina:testnet",
						to: "zeko-m:testnet",
						route: "mina:testnet->zeko-m:testnet",
						direction: "deposit"
					},
					cliVersion: BRIDGE_CLI_SPECIFIER,
					walletPublicKey,
					stage: "process",
					exitCode: 124,
					stdout: "polling bridge state",
					stderr: "bridge validator watchdog timeout after 6900 seconds",
					message: "Bridge command timed out after 6900s (6900000 ms)",
					timings: completedTimings
				})
			)
		).toContain("stdout.log")
		expect(
			JSON.stringify(
				buildSlackFailureBlocks({
					instanceId: "workflow-1",
					route: {
						key: "mina-to-zeko",
						from: "mina:testnet",
						to: "zeko-m:testnet",
						route: "mina:testnet->zeko-m:testnet",
						direction: "deposit"
					},
					cliVersion: BRIDGE_CLI_SPECIFIER,
					walletPublicKey,
					stage: "process",
					exitCode: 124,
					stdout: "polling bridge state",
					stderr: "bridge validator watchdog timeout after 6900 seconds",
					message: "Bridge command timed out after 6900s (6900000 ms)",
					timings: completedTimings
				})
			)
		).toContain("stderr.log")
		expect(
			JSON.stringify(
				buildSlackFailureBlocks({
					instanceId: "workflow-1",
					route: {
						key: "mina-to-zeko",
						from: "mina:testnet",
						to: "zeko-m:testnet",
						route: "mina:testnet->zeko-m:testnet",
						direction: "deposit"
					},
					cliVersion: BRIDGE_CLI_SPECIFIER,
					walletPublicKey,
					stage: "process",
					exitCode: 124,
					stdout: "polling bridge state",
					stderr: "bridge validator watchdog timeout after 6900 seconds",
					message: "Bridge command timed out after 6900s (6900000 ms)",
					timings: completedTimings
				})
			)
		).not.toContain("stderr is uploaded")
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
				to: "zeko-m:testnet",
				route: "mina:testnet->zeko-m:testnet",
				cliFrom: "mina:testnet",
				cliTo: "zeko:testnet",
				acceptedResultRoutes: ["mina:testnet->zeko-m:testnet", "mina:testnet->zeko:testnet"],
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
			walletPublicKey,
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
		expect(JSON.stringify(body.blocks)).toContain("B62validator")
		expect(JSON.stringify(body.blocks)).not.toContain("wait for bridge command completion")
	})

	it("posts Slack failure blocks and uploads stdout and stderr as Slack files", async () => {
		let uploadIndex = 0
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input)
			if (url === "https://slack.com/api/chat.postMessage") {
				return Response.json({ ok: true, channel: "channel", ts: "123.456" })
			}
			if (url === "https://slack.com/api/files.getUploadURLExternal") {
				uploadIndex += 1
				return Response.json({
					ok: true,
					file_id: `file-${uploadIndex}`,
					upload_url: `https://uploads.slack.test/file-${uploadIndex}`
				})
			}
			if (url.startsWith("https://uploads.slack.test/file-")) {
				return new Response("", { status: 200, statusText: "OK" })
			}
			if (url === "https://slack.com/api/files.completeUploadExternal") {
				return Response.json({ ok: true })
			}

			throw new Error(`Unexpected Slack URL ${url}`)
		})
		vi.stubGlobal("fetch", fetchMock)

		await reportSlackFailure({
			slackBotToken: "token",
			slackChannelId: "channel",
			instanceId: "workflow-1",
			routeKey: "mina-to-zeko",
			cliVersion: BRIDGE_CLI_SPECIFIER,
			walletPublicKey,
			stage: "process",
			exitCode: 1,
			stdout: "stdout output",
			stderr: "stderr output",
			message: "Bridge command exited with code 1.",
			timings: completedTimings
		})

		expect(fetchMock).toHaveBeenCalledTimes(7)
		const calls = fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit?]>
		const messageBody = JSON.parse(String(calls[0]?.[1]?.body))
		expect(JSON.stringify(messageBody.blocks)).toContain("stdout.log")
		expect(JSON.stringify(messageBody.blocks)).toContain("stderr.log")
		expect(JSON.stringify(messageBody.blocks)).not.toContain("stdout output")
		expect(JSON.stringify(messageBody.blocks)).not.toContain("stderr output")
		const stdoutCompleteBody = new URLSearchParams(String(calls[3]?.[1]?.body))
		expect(calls[2]?.[1]?.headers).toMatchObject({
			"content-type": "application/octet-stream"
		})
		expect(JSON.parse(String(stdoutCompleteBody.get("files")))).toEqual([
			{ id: "file-1", title: "Bridge validator stdout: workflow-1" }
		])
		expect(stdoutCompleteBody.get("thread_ts")).toBe("123.456")
		expect(stdoutCompleteBody.get("initial_comment")).toBe("stdout.log")
		const stderrCompleteBody = new URLSearchParams(String(calls[6]?.[1]?.body))
		expect(JSON.parse(String(stderrCompleteBody.get("files")))).toEqual([
			{ id: "file-2", title: "Bridge validator stderr: workflow-1" }
		])
		expect(stderrCompleteBody.get("thread_ts")).toBe("123.456")
		expect(stderrCompleteBody.get("initial_comment")).toBe("stderr.log")
	})

	it("fails successful validation reporting when Slack rejects the success message", async () => {
		const summary = validateBridgeCompletion({
			route: {
				key: "mina-to-zeko",
				from: "mina:testnet",
				to: "zeko-m:testnet",
				route: "mina:testnet->zeko-m:testnet",
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
				walletPublicKey,
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
