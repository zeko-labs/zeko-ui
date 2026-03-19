import { PrivateKey } from "o1js"
import { describe, expect, it } from "vitest"
import { createBridgeCommand } from "../src/commands/bridge"
import type { BridgeAdapter } from "../src/core/adapter"
import type { AppPaths } from "../src/core/paths"
import { DEFAULT_DEPOSIT_TIMEOUT_SLOTS } from "../src/core/timeouts"
import type { OperationSession } from "../src/core/types"

const appPaths: AppPaths = {
	dataDir: "/tmp/data",
	stateDir: "/tmp/state",
	logDir: "/tmp/logs",
	cacheDir: "/tmp/cache"
}

const createAdapter = ({
	recipient = "B62test"
}: {
	recipient?: string
	from?: string
	to?: string
	verbose?: boolean
} = {}): BridgeAdapter => ({
	async getDepositStatuses() {
		return [
			{
				index: 0,
				amount: "2",
				recipient,
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
	it("does not expose a public wait flag on the high-level bridge command", () => {
		const command = createBridgeCommand()

		expect(command.args).not.toHaveProperty("wait")
	})

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
				recipient: "B62test",
				timeoutSlots: "",
				json: true,
				verbose: false
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

	it("keeps the signer-derived sender account when only recipient is provided", async () => {
		const signerKey = PrivateKey.random().toBase58()
		const expectedSender = PrivateKey.fromBase58(signerKey).toPublicKey().toBase58()
		const writes: string[] = []
		const submittedAccounts: string[] = []
		const command = createBridgeCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async () => ({
				...createAdapter({
					recipient: "B62qrecipient1111111111111111111111111111111111111111111111"
				}),
				async submitDeposit(input) {
					submittedAccounts.push(input.account ?? "")
					return {
						success: true,
						direction: "deposit",
						action: "submit",
						route: "mina:testnet->zeko:testnet",
						hash: "deposit-submit-command",
						explorerUrl: "https://example.test/deposit-submit-command",
						included: true
					}
				}
			}),
			generateId: () => "bridge-op-2",
			write: (message) => writes.push(message),
			writeProgress: () => {},
			sleep: async () => {},
			pollIntervalMs: 0,
			now: () => "2026-03-10T00:00:00.000Z"
		})

		const previousWalletKey = process.env.WALLET_PRIVATE_KEY
		process.env.WALLET_PRIVATE_KEY = signerKey

		try {
			await command.run?.({
				args: {
					_: [],
					from: "mina:testnet",
					to: "zeko:testnet",
					amount: "2",
					account: "",
					recipient: "B62qrecipient1111111111111111111111111111111111111111111111",
					timeoutSlots: "",
					json: true,
					verbose: false
				},
				rawArgs: [],
				cmd: command
			})
		} finally {
			if (previousWalletKey === undefined) {
				delete process.env.WALLET_PRIVATE_KEY
			} else {
				process.env.WALLET_PRIVATE_KEY = previousWalletKey
			}
		}

		expect(submittedAccounts).toEqual([expectedSender])
		expect(JSON.parse(writes[0] ?? "{}")).toMatchObject({
			recipient: "B62qrecipient1111111111111111111111111111111111111111111111"
		})
	})

	it("defaults the recipient to the destination signer when no recipient is provided", async () => {
		const walletKey = PrivateKey.random().toBase58()
		const expectedSender = PrivateKey.fromBase58(walletKey).toPublicKey().toBase58()
		const expectedRecipient = expectedSender
		const writes: string[] = []
		const submitted: Array<{ account?: string; recipient?: string }> = []
		const command = createBridgeCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async () => ({
				...createAdapter({ recipient: expectedRecipient }),
				async submitDeposit(input) {
					submitted.push({ account: input.account, recipient: input.recipient })
					return {
						success: true,
						direction: "deposit",
						action: "submit",
						route: "mina:testnet->zeko:testnet",
						hash: "deposit-submit-command",
						explorerUrl: "https://example.test/deposit-submit-command",
						included: true
					}
				}
			}),
			generateId: () => "bridge-op-2b",
			write: (message) => writes.push(message),
			writeProgress: () => {},
			sleep: async () => {},
			pollIntervalMs: 0,
			now: () => "2026-03-10T00:00:00.000Z"
		})

		const previousWalletKey = process.env.WALLET_PRIVATE_KEY
		process.env.WALLET_PRIVATE_KEY = walletKey

		try {
			await command.run?.({
				args: {
					_: [],
					from: "mina:testnet",
					to: "zeko:testnet",
					amount: "2",
					account: "",
					recipient: "",
					timeoutSlots: "",
					json: true,
					verbose: false
				},
				rawArgs: [],
				cmd: command
			})
		} finally {
			if (previousWalletKey === undefined) {
				delete process.env.WALLET_PRIVATE_KEY
			} else {
				process.env.WALLET_PRIVATE_KEY = previousWalletKey
			}
		}

		expect(submitted).toEqual([{ account: expectedSender, recipient: expectedRecipient }])
		expect(JSON.parse(writes[0] ?? "{}")).toMatchObject({
			recipient: expectedRecipient
		})
	})

	it("passes the verbose flag through to adapter creation", async () => {
		const seen: Array<{ from: string; to: string; verbose: boolean }> = []
		const command = createBridgeCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async ({ from, to, verbose }) => {
				seen.push({ from, to, verbose })
				return createAdapter()
			},
			generateId: () => "bridge-op-3",
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
				json: false,
				verbose: true
			},
			rawArgs: [],
			cmd: command
		})

		expect(seen).toEqual([{ from: "mina:testnet", to: "zeko:testnet", verbose: true }])
	})

	it("defaults deposit timeout slots to 24 hours when not provided", async () => {
		const seenTimeouts: Array<number | undefined> = []
		const command = createBridgeCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async () => ({
				...createAdapter(),
				async submitDeposit(input) {
					seenTimeouts.push(input.timeoutSlots)
					return {
						success: true,
						direction: "deposit",
						action: "submit",
						route: "mina:testnet->zeko:testnet",
						hash: "deposit-submit-command",
						explorerUrl: "https://example.test/deposit-submit-command",
						included: true
					}
				}
			}),
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
				json: false,
				verbose: false
			},
			rawArgs: [],
			cmd: command
		})

		expect(seenTimeouts).toEqual([DEFAULT_DEPOSIT_TIMEOUT_SLOTS])
	})
})
