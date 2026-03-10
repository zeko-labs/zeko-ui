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
})
