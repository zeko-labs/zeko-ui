import { describe, expect, it } from "vitest"
import { createBridgeCommand } from "../src/commands/bridge"
import type { BridgeAdapter } from "../src/core/adapter"
import type { AppPaths } from "../src/core/paths"
import type { OperationSession } from "../src/core/types"

const appPaths: AppPaths = {
	dataDir: "/tmp/data",
	stateDir: "/tmp/state",
	logDir: "/tmp/logs",
	cacheDir: "/tmp/cache"
}

const createAdapter = (): BridgeAdapter => ({
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
				hash: "deposit-final-command",
				timestamp: "2026-03-10T00:00:01.000Z"
			}
		]
	},
	async getWithdrawalStatuses() {
		return []
	},
	async submitDeposit() {
		return {
			success: true,
			direction: "deposit",
			action: "submit",
			route: "mina:testnet->zeko:testnet",
			hash: "deposit-submit-command",
			explorerUrl: "https://example.test/deposit-submit-command",
			included: true
		}
	},
	async finalizeDeposit() {
		return {
			success: true,
			direction: "deposit",
			action: "finalize",
			route: "mina:testnet->zeko:testnet",
			hash: "deposit-final-command",
			explorerUrl: "https://example.test/deposit-final-command",
			included: true
		}
	},
	async cancelDeposit() {
		throw new Error("cancelDeposit should not be called in this test")
	},
	async submitWithdrawal() {
		throw new Error("submitWithdrawal should not be called in this test")
	},
	async finalizeWithdrawal() {
		throw new Error("finalizeWithdrawal should not be called in this test")
	}
})

describe("bridge command", () => {
	it("runs the end-to-end bridge command and emits a final JSON result", async () => {
		const writes: string[] = []
		const progress: string[] = []
		const saves: OperationSession[] = []
		const command = createBridgeCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async save(session) {
					saves.push(session)
				}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter,
			generateId: () => "bridge-op-1",
			write: (message) => writes.push(message),
			writeProgress: (message) => progress.push(message),
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
				recipient: "",
				timeoutSlots: "",
				wait: true,
				json: true
			},
			rawArgs: [],
			cmd: command
		})

		expect(progress.length).toBeGreaterThan(0)
		expect(saves.at(-1)?.status).toBe("completed")
		expect(JSON.parse(writes[0] ?? "{}")).toMatchObject({
			success: true,
			operation_id: "bridge-op-1",
			status: "completed",
			route: "mina:testnet->zeko:testnet"
		})
	})
})
