import { describe, expect, it } from "vitest"
import { createOperationCommand } from "../src/commands/operation"
import type { BridgeAdapter } from "../src/core/adapter"
import type { AppPaths } from "../src/core/paths"
import type { OperationSession } from "../src/core/types"

const appPaths: AppPaths = {
	dataDir: "/tmp/data",
	stateDir: "/tmp/state",
	logDir: "/tmp/logs",
	cacheDir: "/tmp/cache"
}

const persistedSession: OperationSession = {
	id: "op-1",
	status: "running",
	phase: "submitted",
	route: "mina:testnet->zeko:testnet",
	direction: "deposit",
	account: "B62test",
	recipient: "B62test",
	amount: "2",
	timeoutSlots: 10,
	logPath: "/tmp/logs/op-1.jsonl",
	createdAt: "2026-03-10T00:00:00.000Z",
	updatedAt: "2026-03-10T00:00:00.000Z",
	submittedTransactions: [{ action: "submit", hash: "deposit-submit" }]
}

const createResumeAdapter = (): BridgeAdapter => ({
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
				hash: "deposit-final-resume",
				timestamp: "2026-03-10T00:01:00.000Z"
			}
		]
	},
	async getWithdrawalStatuses() {
		return []
	},
	async submitDeposit() {
		throw new Error("submitDeposit should not be called in this test")
	},
	async finalizeDeposit() {
		return {
			success: true,
			direction: "deposit",
			action: "finalize",
			route: "mina:testnet->zeko:testnet",
			hash: "deposit-final-resume",
			explorerUrl: "https://example.test/deposit-final-resume",
			included: true
		}
	},
	async cancelDeposit() {
		throw new Error("cancelDeposit should not be called in this test")
	},
	async canFinalizeDeposit() {
		return true
	},
	async canCancelDeposit() {
		return false
	},
	async submitWithdrawal() {
		throw new Error("submitWithdrawal should not be called in this test")
	},
	async finalizeWithdrawal() {
		throw new Error("finalizeWithdrawal should not be called in this test")
	}
})

type RunnableSubCommand = {
	run?: (context: {
		rawArgs: string[]
		args: Record<string, unknown>
		cmd: unknown
	}) => Promise<void>
}

const resolveSubCommands = async (value: unknown): Promise<Record<string, RunnableSubCommand>> => {
	if (typeof value === "function") {
		return resolveSubCommands(await value())
	}

	if (typeof value !== "object" || value === null) {
		throw new Error("Expected command subcommands to be defined")
	}

	return value as Record<string, RunnableSubCommand>
}

describe("operation command", () => {
	it("lists persisted operations", async () => {
		const writes: string[] = []
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [persistedSession]
				},
				async load() {
					return persistedSession
				},
				async save() {}
			}),
			write: (message) => writes.push(message)
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands.list?.run?.({ rawArgs: [], args: { _: [] }, cmd: subCommands.list })

		expect(JSON.parse(writes[0] ?? "[]")).toHaveLength(1)
	})

	it("lists completed operations separately", async () => {
		const writes: string[] = []
		const completedSession: OperationSession = {
			...persistedSession,
			id: "op-complete",
			status: "completed",
			phase: "completed",
			route: "zeko:testnet->mina:testnet",
			direction: "withdrawal",
			finalTransaction: {
				action: "finalize",
				hash: "withdrawal-final",
				explorerUrl: "https://example.test/withdrawal-final"
			}
		}
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [persistedSession, completedSession]
				},
				async load() {
					return persistedSession
				},
				async save() {}
			}),
			write: (message) => writes.push(message)
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands.completed?.run?.({
			rawArgs: [],
			args: { _: [], json: true },
			cmd: subCommands.completed
		})

		expect(JSON.parse(writes[0] ?? "{}")).toMatchObject({
			count: 1,
			operations: [{ operation_id: "op-complete", status: "completed" }]
		})
	})

	it("prints persisted logs", async () => {
		const writes: string[] = []
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [persistedSession]
				},
				async load() {
					return persistedSession
				},
				async save() {}
			}),
			readLog: async () => "log-entry",
			write: (message) => writes.push(message)
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands.logs?.run?.({
			rawArgs: [],
			args: { _: [], id: "op-1" },
			cmd: subCommands.logs
		})

		expect(writes[0]).toBe("log-entry")
	})

	it("refreshes operation status from live SDK calls before printing", async () => {
		const writes: string[] = []
		const progress: string[] = []
		const saves: OperationSession[] = []
		const calls: string[] = []
		const failedSession: OperationSession = {
			...persistedSession,
			status: "failed",
			phase: "failed",
			lastError: "stale local failure"
		}
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [failedSession]
				},
				async load() {
					return failedSession
				},
				async save(session) {
					saves.push(session)
				}
			}),
			createAdapter: async () => ({
				async getDepositStatuses(account) {
					calls.push(`getDepositStatuses:${account}`)
					return [
						{
							index: 4,
							amount: "2",
							recipient: "B62test",
							cancelled: false,
							synced: true,
							accepted: true,
							confirmed: true,
							finalised: false,
							hash: "deposit-submit",
							timestamp: "2026-03-12T00:01:00.000Z"
						}
					]
				},
				async getWithdrawalStatuses() {
					throw new Error("getWithdrawalStatuses should not be called in this test")
				},
				async canFinalizeDeposit(account) {
					calls.push(`canFinalizeDeposit:${account}`)
					return true
				},
				async canCancelDeposit(account) {
					calls.push(`canCancelDeposit:${account}`)
					return false
				},
				async submitDeposit() {
					throw new Error("submitDeposit should not be called in this test")
				},
				async finalizeDeposit() {
					throw new Error("finalizeDeposit should not be called in this test")
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
			}),
			write: (message) => writes.push(message),
			writeProgress: (message) => progress.push(message),
			now: () => "2026-03-12T15:00:00.000Z"
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands.status?.run?.({
			rawArgs: [],
			args: { _: [], id: "op-1" },
			cmd: subCommands.status
		})

		const result = JSON.parse(writes[0] ?? "{}")
		expect(progress).toHaveLength(1)
		expect(progress[0]).toContain("refreshing-status")
		expect(progress[0]).toContain("operationId=op-1")
		expect(calls).toHaveLength(3)
		expect(calls).toEqual(
			expect.arrayContaining([
				"getDepositStatuses:B62test",
				"canFinalizeDeposit:B62test",
				"canCancelDeposit:B62test"
			])
		)
		expect(saves).toHaveLength(1)
		expect(result).toMatchObject({
			id: "op-1",
			status: "running",
			phase: "ready-finalization",
			refreshed_at: "2026-03-12T15:00:00.000Z",
			target_index: 4,
			claimable_index: 4,
			pending_ahead: 0,
			can_finalize: true,
			can_cancel: false,
			submit_hash: "deposit-submit",
			observed_counts: {
				deposits: 1,
				withdrawals: 0
			},
			next_action: "finalize",
			waiting_on: "finalization"
		})
		expect(result.error).toBeNull()
		expect(result.liveSnapshot).toBeUndefined()
	})

	it("marks operation status completed when live withdrawal state is terminal", async () => {
		const writes: string[] = []
		const saves: OperationSession[] = []
		const session: OperationSession = {
			...persistedSession,
			id: "withdrawal-op",
			route: "zeko:testnet->mina:testnet",
			direction: "withdrawal",
			amount: "3",
			submittedTransactions: [{ action: "submit", hash: "withdrawal-submit" }]
		}
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [session]
				},
				async load() {
					return session
				},
				async save(next) {
					saves.push(next)
				}
			}),
			createAdapter: async () => ({
				async getDepositStatuses() {
					throw new Error("getDepositStatuses should not be called in this test")
				},
				async getWithdrawalStatuses() {
					return [
						{
							index: 9,
							amount: "3",
							recipient: "B62test",
							committed: true,
							finalised: true,
							hash: "withdrawal-submit",
							timestamp: "2026-03-12T00:04:00.000Z"
						}
					]
				},
				async canFinalizeWithdrawal() {
					return false
				},
				async submitDeposit() {
					throw new Error("submitDeposit should not be called in this test")
				},
				async finalizeDeposit() {
					throw new Error("finalizeDeposit should not be called in this test")
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
			}),
			write: (message) => writes.push(message),
			now: () => "2026-03-12T15:05:00.000Z"
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands.status?.run?.({
			rawArgs: [],
			args: { _: [], id: "withdrawal-op" },
			cmd: subCommands.status
		})

		const result = JSON.parse(writes[0] ?? "{}")
		expect(saves).toHaveLength(1)
		expect(result).toMatchObject({
			id: "withdrawal-op",
			status: "completed",
			phase: "completed",
			target_index: 9,
			final_transaction: {
				action: "finalize",
				hash: "withdrawal-submit",
				explorerUrl: ""
			},
			refreshed_at: "2026-03-12T15:05:00.000Z",
			next_action: "completed",
			observed_counts: {
				deposits: 0,
				withdrawals: 1
			}
		})
		expect(result.liveSnapshot).toBeUndefined()
	})

	it("resumes a persisted operation and emits a final JSON result", async () => {
		const writes: string[] = []
		const progress: string[] = []
		const saves: OperationSession[] = []
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [persistedSession]
				},
				async load() {
					return persistedSession
				},
				async save(session) {
					saves.push(session)
				}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: createResumeAdapter,
			write: (message) => writes.push(message),
			writeProgress: (message) => progress.push(message),
			sleep: async () => {},
			pollIntervalMs: 0
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands.resume?.run?.({
			rawArgs: [],
			args: { _: [], id: "op-1", json: true },
			cmd: subCommands.resume
		})

		expect(progress.length).toBeGreaterThan(0)
		expect(saves.at(-1)?.status).toBe("completed")
		expect(JSON.parse(writes[0] ?? "{}")).toMatchObject({
			success: true,
			operation_id: "op-1",
			status: "completed"
		})
	})

	it("replays a failed persisted operation instead of exiting immediately", async () => {
		const writes: string[] = []
		const progress: string[] = []
		const saves: OperationSession[] = []
		const failedSession: OperationSession = {
			...persistedSession,
			status: "failed",
			phase: "failed",
			lastError: "previous opaque failure"
		}
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [failedSession]
				},
				async load() {
					return failedSession
				},
				async save(session) {
					saves.push(session)
				}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: createResumeAdapter,
			write: (message) => writes.push(message),
			writeProgress: (message) => progress.push(message),
			sleep: async () => {},
			pollIntervalMs: 0,
			now: () => "2026-03-12T14:30:00.000Z"
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands.resume?.run?.({
			rawArgs: [],
			args: { _: [], id: "op-1", json: true },
			cmd: subCommands.resume
		})

		expect(progress.length).toBeGreaterThan(0)
		expect(saves[0]).toMatchObject({
			status: "running",
			phase: "submitted"
		})
		expect(saves.at(-1)?.status).toBe("completed")
		expect(JSON.parse(writes[0] ?? "{}")).toMatchObject({
			success: true,
			operation_id: "op-1",
			status: "completed"
		})
	})

	it("fails resume immediately on non-retryable adapter initialization errors", async () => {
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [persistedSession]
				},
				async load() {
					return persistedSession
				},
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async () => {
				throw new Error("Missing required signer private key for mina:testnet")
			},
			write: () => {},
			writeProgress: () => {},
			sleep: async () => {},
			pollIntervalMs: 0
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await expect(
			subCommands.resume?.run?.({
				rawArgs: [],
				args: { _: [], id: "op-1", json: true },
				cmd: subCommands.resume
			})
		).rejects.toThrow("Missing required signer private key for mina:testnet")
	})

	it("resume-user prioritizes the requested route queue using matching persisted sessions", async () => {
		const writes: string[] = []
		const progress: string[] = []
		const saves: OperationSession[] = []
		const calls: string[] = []
		let depositFinalized = false
		let withdrawalFinalized = false
		const depositSession: OperationSession = {
			...persistedSession,
			id: "deposit-op",
			submittedTransactions: [{ action: "submit", hash: "deposit-submit" }]
		}
		const withdrawalSession: OperationSession = {
			...persistedSession,
			id: "withdrawal-op",
			route: "zeko:testnet->mina:testnet",
			direction: "withdrawal",
			amount: "3",
			submittedTransactions: [{ action: "submit", hash: "withdrawal-submit" }]
		}
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [withdrawalSession, depositSession]
				},
				async load(id) {
					return id === withdrawalSession.id ? withdrawalSession : depositSession
				},
				async save(session) {
					saves.push(session)
				}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async ({ from, to }) => {
				const route = `${from}->${to}`
				if (route === "mina:testnet->zeko:testnet") {
					return {
						async getDepositStatuses() {
							return [
								{
									index: 2,
									amount: "2",
									recipient: "B62queue",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: depositFinalized,
									hash: "deposit-submit",
									timestamp: "2026-03-12T00:00:00.000Z"
								}
							]
						},
						async getWithdrawalStatuses() {
							return []
						},
						async submitDeposit() {
							throw new Error("submitDeposit should not be called")
						},
						async finalizeDeposit() {
							calls.push("deposit:finalize")
							depositFinalized = true
							return {
								success: true,
								direction: "deposit",
								action: "finalize",
								route: "mina:testnet->zeko:testnet",
								hash: "deposit-final",
								explorerUrl: "https://example.test/deposit-final",
								included: true
							}
						},
						async cancelDeposit() {
							throw new Error("cancelDeposit should not be called")
						},
						async canFinalizeDeposit() {
							return true
						},
						async submitWithdrawal() {
							throw new Error("submitWithdrawal should not be called")
						},
						async finalizeWithdrawal() {
							throw new Error("finalizeWithdrawal should not be called")
						},
						async canCancelDeposit() {
							return false
						}
					} satisfies BridgeAdapter
				}

				if (route === "zeko:testnet->mina:testnet") {
					return {
						async getDepositStatuses() {
							return []
						},
						async getWithdrawalStatuses() {
							return [
								{
									index: 5,
									amount: "3",
									recipient: "B62queue",
									committed: true,
									finalised: withdrawalFinalized,
									hash: "withdrawal-submit",
									timestamp: "2026-03-12T00:10:00.000Z"
								}
							]
						},
						async submitDeposit() {
							throw new Error("submitDeposit should not be called")
						},
						async finalizeDeposit() {
							throw new Error("finalizeDeposit should not be called")
						},
						async cancelDeposit() {
							throw new Error("cancelDeposit should not be called")
						},
						async submitWithdrawal() {
							throw new Error("submitWithdrawal should not be called")
						},
						async finalizeWithdrawal() {
							calls.push("withdrawal:finalize")
							withdrawalFinalized = true
							return {
								success: true,
								direction: "withdrawal",
								action: "finalize",
								route: "zeko:testnet->mina:testnet",
								hash: "withdrawal-final",
								explorerUrl: "https://example.test/withdrawal-final",
								included: true
							}
						},
						async canFinalizeWithdrawal() {
							return true
						}
					} satisfies BridgeAdapter
				}

				throw new Error(`Unexpected route ${route}`)
			},
			write: (message) => writes.push(message),
			writeProgress: (message) => progress.push(message),
			sleep: async () => {},
			pollIntervalMs: 0
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands["resume-user"]?.run?.({
			rawArgs: [],
			args: { _: [], from: "zeko:testnet", to: "mina:testnet", account: "B62queue", json: true },
			cmd: subCommands["resume-user"]
		})

		const result = JSON.parse(writes[0] ?? "{}")
		expect(progress.length).toBeGreaterThan(0)
		expect(calls).toEqual(["withdrawal:finalize", "deposit:finalize"])
		expect(result).toMatchObject({
			success: true,
			account: "B62queue",
			operations_found: 2,
			operations_resolved: 2
		})
		expect(
			result.operations.map((operation: { operation_id: string }) => operation.operation_id)
		).toEqual(["withdrawal-op", "deposit-op"])
		expect(saves.at(-1)?.id).toBe("deposit-op")
	})

	it("resume-user continues draining the opposite bridge direction after a terminal failure", async () => {
		const writes: string[] = []
		const calls: string[] = []
		const depositSession: OperationSession = {
			...persistedSession,
			id: "deposit-op",
			submittedTransactions: [{ action: "submit", hash: "deposit-submit" }]
		}
		const withdrawalSession: OperationSession = {
			...persistedSession,
			id: "withdrawal-op",
			route: "zeko:testnet->mina:testnet",
			direction: "withdrawal",
			amount: "3",
			submittedTransactions: [{ action: "submit", hash: "withdrawal-submit" }]
		}
		let withdrawalFinalized = false
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return [depositSession, withdrawalSession]
				},
				async load(id) {
					return id === withdrawalSession.id ? withdrawalSession : depositSession
				},
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async ({ from, to }) => {
				const route = `${from}->${to}`
				if (route === "mina:testnet->zeko:testnet") {
					return {
						async getDepositStatuses() {
							return [
								{
									index: 2,
									amount: "2",
									recipient: "B62queue",
									cancelled: false,
									synced: true,
									accepted: true,
									confirmed: true,
									finalised: false,
									hash: "deposit-submit",
									timestamp: "2026-03-12T00:00:00.000Z"
								}
							]
						},
						async getWithdrawalStatuses() {
							return []
						},
						async submitDeposit() {
							throw new Error("submitDeposit should not be called")
						},
						async finalizeDeposit() {
							calls.push("deposit:finalize")
							throw new Error("[GraphQL] Invalid key")
						},
						async cancelDeposit() {
							throw new Error("cancelDeposit should not be called")
						},
						async canFinalizeDeposit() {
							return true
						},
						async canCancelDeposit() {
							return false
						},
						async submitWithdrawal() {
							throw new Error("submitWithdrawal should not be called")
						},
						async finalizeWithdrawal() {
							throw new Error("finalizeWithdrawal should not be called")
						}
					} satisfies BridgeAdapter
				}

				if (route === "zeko:testnet->mina:testnet") {
					return {
						async getDepositStatuses() {
							return []
						},
						async getWithdrawalStatuses() {
							return [
								{
									index: 5,
									amount: "3",
									recipient: "B62queue",
									committed: true,
									finalised: withdrawalFinalized,
									hash: "withdrawal-submit",
									timestamp: "2026-03-12T00:10:00.000Z"
								}
							]
						},
						async submitDeposit() {
							throw new Error("submitDeposit should not be called")
						},
						async finalizeDeposit() {
							throw new Error("finalizeDeposit should not be called")
						},
						async cancelDeposit() {
							throw new Error("cancelDeposit should not be called")
						},
						async submitWithdrawal() {
							throw new Error("submitWithdrawal should not be called")
						},
						async finalizeWithdrawal() {
							calls.push("withdrawal:finalize")
							withdrawalFinalized = true
							return {
								success: true,
								direction: "withdrawal",
								action: "finalize",
								route: "zeko:testnet->mina:testnet",
								hash: "withdrawal-final",
								explorerUrl: "https://example.test/withdrawal-final",
								included: true
							}
						},
						async canFinalizeWithdrawal() {
							return true
						}
					} satisfies BridgeAdapter
				}

				throw new Error(`Unexpected route ${route}`)
			},
			write: (message) => writes.push(message),
			sleep: async () => {},
			pollIntervalMs: 0
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands["resume-user"]?.run?.({
			rawArgs: [],
			args: { _: [], from: "mina:testnet", to: "zeko:testnet", account: "B62queue", json: true },
			cmd: subCommands["resume-user"]
		})

		const result = JSON.parse(writes[0] ?? "{}")
		expect(calls).toEqual(["deposit:finalize", "withdrawal:finalize"])
		expect(result).toMatchObject({
			success: false,
			account: "B62queue",
			operations_found: 2,
			operations_resolved: 1
		})
		expect(
			result.operations.map((operation: { operation_id: string; status: string }) => ({
				id: operation.operation_id,
				status: operation.status
			}))
		).toEqual([
			{ id: "deposit-op", status: "failed" },
			{ id: "withdrawal-op", status: "completed" }
		])
	})

	it("resume-user creates a synthetic session when only on-chain pending work exists", async () => {
		const writes: string[] = []
		let finalized = false
		const command = createOperationCommand({
			resolvePaths: () => appPaths,
			createStore: () => ({
				async list() {
					return []
				},
				async load() {
					return null
				},
				async save() {}
			}),
			createLogger: () => ({
				async write() {}
			}),
			createAdapter: async ({ from, to }) => {
				const route = `${from}->${to}`
				if (route !== "mina:testnet->zeko:testnet") {
					return {
						async getDepositStatuses() {
							return []
						},
						async getWithdrawalStatuses() {
							return []
						},
						async submitDeposit() {
							throw new Error("submitDeposit should not be called")
						},
						async finalizeDeposit() {
							throw new Error("finalizeDeposit should not be called")
						},
						async cancelDeposit() {
							throw new Error("cancelDeposit should not be called")
						},
						async submitWithdrawal() {
							throw new Error("submitWithdrawal should not be called")
						},
						async finalizeWithdrawal() {
							throw new Error("finalizeWithdrawal should not be called")
						}
					} satisfies BridgeAdapter
				}

				return {
					async getDepositStatuses() {
						return [
							{
								index: 7,
								amount: "1",
								recipient: "B62fresh",
								cancelled: false,
								synced: true,
								accepted: true,
								confirmed: true,
								finalised: finalized,
								hash: "fresh-submit",
								timestamp: "2026-03-12T00:20:00.000Z"
							}
						]
					},
					async getWithdrawalStatuses() {
						return []
					},
					async submitDeposit() {
						throw new Error("submitDeposit should not be called")
					},
					async finalizeDeposit() {
						finalized = true
						return {
							success: true,
							direction: "deposit",
							action: "finalize",
							route: "mina:testnet->zeko:testnet",
							hash: "fresh-final",
							explorerUrl: "https://example.test/fresh-final",
							included: true
						}
					},
					async cancelDeposit() {
						throw new Error("cancelDeposit should not be called")
					},
					async canFinalizeDeposit() {
						return true
					},
					async submitWithdrawal() {
						throw new Error("submitWithdrawal should not be called")
					},
					async finalizeWithdrawal() {
						throw new Error("finalizeWithdrawal should not be called")
					},
					async canCancelDeposit() {
						return false
					}
				} satisfies BridgeAdapter
			},
			generateId: () => "generated-op",
			write: (message) => writes.push(message),
			sleep: async () => {},
			pollIntervalMs: 0
		})
		const subCommands = await resolveSubCommands(command.subCommands)

		await subCommands["resume-user"]?.run?.({
			rawArgs: [],
			args: { _: [], from: "mina:testnet", to: "zeko:testnet", account: "B62fresh", json: true },
			cmd: subCommands["resume-user"]
		})

		const result = JSON.parse(writes[0] ?? "{}")
		expect(result).toMatchObject({
			success: true,
			operations_found: 1,
			operations_resolved: 1
		})
		expect(result.operations[0]).toMatchObject({
			operation_id: "generated-op",
			route: "mina:testnet->zeko:testnet",
			status: "completed"
		})
	})
})
