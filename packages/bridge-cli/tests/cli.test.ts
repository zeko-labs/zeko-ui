import { describe, expect, it } from "vitest"
import { createBridgeCli } from "../src/cli"
import { createBridgeCommand } from "../src/commands/bridge"
import type { BridgeAdapter } from "../src/core/adapter"
import type { CommandDef } from "citty"

const resolveSubCommands = async (subCommands: unknown): Promise<Record<string, unknown>> => {
	if (typeof subCommands === "function") {
		return resolveSubCommands(await subCommands())
	}

	return typeof subCommands === "object" && subCommands !== null
		? (subCommands as Record<string, unknown>)
		: {}
}

const resolveCommand = async (command: unknown): Promise<CommandDef | undefined> => {
	if (typeof command === "function") {
		return resolveCommand(await command())
	}
	if (command && typeof (command as Promise<CommandDef>).then === "function") {
		return resolveCommand(await command)
	}

	return typeof command === "object" && command !== null ? (command as CommandDef) : undefined
}

describe("cli skeleton", () => {
	it("exposes the planned top-level command groups", async () => {
		const cli = createBridgeCli()
		const subCommands = await resolveSubCommands(cli.subCommands)

		expect(Object.keys(subCommands).sort()).toEqual([
			"bridge",
			"deposit",
			"doctor",
			"operation",
			"tui",
			"withdrawal"
		])
	})

	it("keeps bridge as the default high-level command without a public wait flag", async () => {
		const cli = createBridgeCli()
		const subCommands = await resolveSubCommands(cli.subCommands)
		const bridge = await resolveCommand(subCommands.bridge)

		expect(bridge?.args).toBeDefined()
		expect(bridge?.args).not.toHaveProperty("wait")
	})

	it("accepts kebab-case timeout slots on the high-level bridge command", async () => {
		const seenTimeouts: Array<number | undefined> = []
		const adapter: BridgeAdapter = {
			async submitDeposit(input) {
				seenTimeouts.push(input.timeoutSlots)
				return {
					success: true,
					direction: "deposit",
					action: "submit",
					route: "mina:testnet->zeko:testnet",
					hash: "deposit-submit",
					explorerUrl: "https://example.test/deposit-submit",
					included: true
				}
			},
			async getDepositStatuses() {
				return [
					{
						index: 0,
						amount: "2",
						recipient: "B62test",
						cancelled: false,
						synced: true,
						accepted: true,
						confirmed: true,
						finalised: true,
						hash: "deposit-submit",
						timestamp: "2026-03-10T00:00:01.000Z"
					}
				]
			},
			async getWithdrawalStatuses() {
				return []
			},
			async submitWithdrawal() {
				throw new Error("submitWithdrawal should not be called")
			},
			async finalizeDeposit() {
				throw new Error("finalizeDeposit should not be called")
			},
			async finalizeWithdrawal() {
				throw new Error("finalizeWithdrawal should not be called")
			},
			async cancelDeposit() {
				throw new Error("cancelDeposit should not be called")
			}
		}
		const command = createBridgeCommand({
			resolvePaths: () => ({
				dataDir: "/tmp/data",
				stateDir: "/tmp/state",
				logDir: "/tmp/logs",
				cacheDir: "/tmp/cache"
			}),
			createStore: () => ({
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async () => adapter,
			generateId: () => "bridge-op-timeout",
			write: () => {},
			writeProgress: () => {},
			sleep: async () => {},
			pollIntervalMs: 0,
			now: () => "2026-03-10T00:00:00.000Z"
		})

		await command.run?.({
			args: {
				_: [],
				from: "mina:testnet",
				to: "zeko:testnet",
				amount: "2",
				account: "B62test",
				recipient: "B62test",
				timeoutSlots: "",
				"timeout-slots": "1",
				json: false,
				verbose: false
			},
			rawArgs: [],
			cmd: command
		})

		expect(seenTimeouts).toEqual([1])
	})
})
