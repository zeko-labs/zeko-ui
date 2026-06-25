import type { ZkappCommand } from "@aurowallet/mina-provider"
import { beforeEach, describe, expect, it } from "vitest"
import type { OperationsWorker } from "../../machines/operations.worker"
import {
	bridgeDebugBackendScenarios,
	createBridgeDebugBackendStore,
	createMockBridgeOperationsWorker
} from "../../machines/mockBackend"

type MemoryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

const createMemoryStorage = (): MemoryStorage => {
	const values = new Map<string, string>()
	return {
		getItem: (key) => values.get(key) ?? null,
		removeItem: (key) => {
			values.delete(key)
		},
		setItem: (key, value) => {
			values.set(key, value)
		}
	}
}

const signedCommand = (user: string): ZkappCommand =>
	({
		accountUpdates: [],
		feePayer: {
			authorization: "signed",
			body: { fee: "100000000", publicKey: user }
		},
		memo: ""
	}) as unknown as ZkappCommand

describe("mock bridge operations worker", () => {
	let storage: MemoryStorage

	beforeEach(() => {
		storage = createMemoryStorage()
	})

	it("implements the same method surface as the real operations worker", () => {
		const worker: OperationsWorker = createMockBridgeOperationsWorker({
			store: createBridgeDebugBackendStore({ storage })
		})

		expect(Object.keys(worker).sort()).toEqual([
			"canCancelDeposit",
			"canFinalizeDeposit",
			"canFinalizeWithdrawal",
			"cancelDeposit",
			"completeSdkSignature",
			"finalizeDeposit",
			"finalizeWithdrawal",
			"findPendingOperations",
			"rejectSdkSignature",
			"submitDeposit",
			"submitWithdrawal"
		])
	})

	it("returns a signable request and completes it with a deterministic fake hash", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })
		const user = "B62qtest-user"

		const request = await worker.submitDeposit({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			amount: "1.5",
			feeNanomina: 100_000_000
		})
		const transaction = JSON.parse(request.transaction) as {
			feePayer: { body: { fee: string; publicKey: string } }
		}

		expect(transaction.feePayer.body).toMatchObject({
			fee: "100000000",
			publicKey: user
		})

		const hash = await worker.completeSdkSignature({
			requestId: request.requestId,
			signedTransaction: signedCommand(user)
		})

		expect(hash).toBe("5Jdebug000001")
		expect(store.getSnapshot().signatureRequests.at(-1)).toMatchObject({
			requestId: request.requestId,
			completed: true,
			hash
		})
	})

	it("does not reuse seeded operation hashes for later mock SDK submissions", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })
		const user = "B62qtest-user"

		const seed = store.seedRecoveredOperation("deposit")
		const request = await worker.submitWithdrawal({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			amount: "1",
			feeNanomina: 100_000_000
		})
		const submittedHash = await worker.completeSdkSignature({
			requestId: request.requestId,
			signedTransaction: signedCommand(user)
		})

		const pending = await worker.findPendingOperations({
			account: user,
			l1: "mina:devnet",
			l2: "zeko-m:testnet"
		})

		expect(submittedHash).not.toBe(seed.transactionHash)
		expect(
			new Set([pending.deposits[0]?.transaction.hash, pending.withdrawals[0]?.transaction.hash])
				.size
		).toBe(2)
	})

	it("reports the oldest pending seeded deposit as claimable", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })

		store.seedRecoveredOperation("deposit", { amount: "1" })
		store.seedRecoveredOperation("deposit", { amount: "2" })

		await expect(
			worker.canFinalizeDeposit({
				l1: "mina:devnet",
				l2: "zeko-m:testnet",
				user: "B62qtest-user"
			})
		).resolves.toEqual({ available: true, reason: null, index: 1 })
	})

	it("can force a one-shot fee-too-low completion error", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })
		const user = "B62qtest-user"
		store.forceNextError("fee-too-low")

		const request = await worker.submitWithdrawal({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			amount: "1",
			feeNanomina: 100_000_000
		})

		await expect(
			worker.completeSdkSignature({
				requestId: request.requestId,
				signedTransaction: signedCommand(user)
			})
		).rejects.toThrow('Transaction failed: "Fee is too low"')

		const retry = await worker.submitWithdrawal({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			amount: "1",
			feeNanomina: 200_000_000
		})

		await expect(
			worker.completeSdkSignature({
				requestId: retry.requestId,
				signedTransaction: signedCommand(user)
			})
		).resolves.toBe("5Jdebug000001")
	})

	it("returns seeded recovered operations from findPendingOperations", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })

		store.seedRecoveredOperation("deposit", {
			amount: "2",
			cancellable: true,
			timeoutSlot: "42"
		})
		store.seedRecoveredOperation("withdrawal", { amount: "3" })

		const pending = await worker.findPendingOperations({
			account: "B62qtest-user",
			l1: "mina:devnet",
			l2: "zeko-m:testnet"
		})

		expect(pending.currentSlot).toBe("1")
		expect(pending.deposits).toHaveLength(1)
		expect(pending.deposits[0]).toMatchObject({
			amount: "2",
			cancellable: true,
			timeoutSlot: "42",
			source: "mina:devnet",
			destination: "zeko-m:testnet"
		})
		expect(pending.withdrawals).toHaveLength(1)
		expect(pending.withdrawals[0]).toMatchObject({
			amount: "3",
			source: "zeko-m:testnet",
			destination: "mina:devnet"
		})
	})

	it("persists successful mock SDK submissions for recovery after refresh", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })
		const user = "B62qtest-user"

		const submit = await worker.submitWithdrawal({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			amount: "1.25",
			feeNanomina: 100_000_000
		})
		const submitHash = await worker.completeSdkSignature({
			requestId: submit.requestId,
			signedTransaction: signedCommand(user)
		})

		await expect(
			worker.findPendingOperations({
				account: user,
				l1: "mina:devnet",
				l2: "zeko-m:testnet"
			})
		).resolves.toMatchObject({
			withdrawals: [
				{
					amount: "1.25",
					finalised: false,
					transaction: { hash: submitHash }
				}
			]
		})

		const finalize = await worker.finalizeWithdrawal({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			feeNanomina: 100_000_000
		})
		await worker.completeSdkSignature({
			requestId: finalize.requestId,
			signedTransaction: signedCommand(user)
		})

		await expect(
			worker.findPendingOperations({
				account: user,
				l1: "mina:devnet",
				l2: "zeko-m:testnet"
			})
		).resolves.toMatchObject({
			withdrawals: [
				{
					amount: "1.25",
					finalised: true,
					transaction: { hash: submitHash }
				}
			]
		})
	})

	it("keeps only the selected scenario across a fresh debug backend page load", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })

		store.setScenario("repro-unindexed-withdrawal-completion")
		store.seedRecoveredOperation("withdrawal", { amount: "4" })
		store.advancePendingStatus()
		await worker.submitDeposit({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user: "B62qtest-user",
			amount: "1",
			feeNanomina: 100_000_000
		})
		store.forceNextError("terminal")

		const reloadedStore = createBridgeDebugBackendStore({ storage })

		expect(reloadedStore.getSnapshot()).toMatchObject({
			scenario: "repro-unindexed-withdrawal-completion",
			currentSlot: 1,
			pendingAdvancements: 0,
			nextCallId: 1,
			nextRequestId: 1,
			nextHashId: 1,
			nextOperationIndex: 1,
			findPendingOperationsCount: 0,
			forcedError: null,
			calls: [],
			signatureRequests: [],
			seededOperations: []
		})
	})

	it("marks the oldest pending seeded deposit finalised when claim completes", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		const worker = createMockBridgeOperationsWorker({ store })
		const user = "B62qtest-user"

		store.seedRecoveredOperation("deposit", { amount: "1" })
		store.seedRecoveredOperation("deposit", { amount: "2" })
		store.seedRecoveredOperation("deposit", { amount: "3" })

		const finalize = await worker.finalizeDeposit({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			feeNanomina: 100_000_000
		})
		await worker.completeSdkSignature({
			requestId: finalize.requestId,
			signedTransaction: signedCommand(user)
		})

		const pending = await worker.findPendingOperations({
			account: user,
			l1: "mina:devnet",
			l2: "zeko-m:testnet"
		})

		expect(
			pending.deposits.map(({ amount, finalised, id }) => ({ amount, finalised, id }))
		).toEqual([
			{ amount: "1", finalised: true, id: "debug-deposit-1" },
			{ amount: "2", finalised: false, id: "debug-deposit-2" },
			{ amount: "3", finalised: false, id: "debug-deposit-3" }
		])
	})

	it("exposes only debug backend scenarios that are known to work", async () => {
		expect(bridgeDebugBackendScenarios).toEqual([
			"happy-path",
			"repro-first-withdrawal-too-small",
			"repro-claim-failure",
			"repro-unindexed-withdrawal-completion"
		])
	})

	it("can reproduce the first withdrawal threshold backend error", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		store.setScenario("repro-first-withdrawal-too-small")
		const worker = createMockBridgeOperationsWorker({ store })

		store.seedRecoveredOperation("withdrawal", { amount: "0.2" })

		await expect(
			worker.canFinalizeWithdrawal({
				user: "B62qtest-user",
				l1: "mina:devnet",
				l2: "zeko-m:testnet"
			})
		).rejects.toThrow(/0\.2 MINA bridge fees.*1 MINA helper.*1 MINA recipient.*2\.2 MINA/)
	})

	it("does not invent a first withdrawal threshold error for valid amounts", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		store.setScenario("repro-first-withdrawal-too-small")
		const worker = createMockBridgeOperationsWorker({ store })

		store.seedRecoveredOperation("withdrawal", { amount: "2.2" })

		await expect(
			worker.canFinalizeWithdrawal({
				user: "B62qtest-user",
				l1: "mina:devnet",
				l2: "zeko-m:testnet"
			})
		).resolves.toEqual({
			available: true,
			reason: null,
			status: "available",
			index: 1
		})
	})

	it("can reproduce a route-neutral claim backend failure without frontend shortcuts", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		store.setScenario("repro-claim-failure")
		const worker = createMockBridgeOperationsWorker({ store })
		const user = "B62qtest-user"

		store.seedRecoveredOperation("withdrawal", { amount: "4" })

		const finalize = await worker.finalizeWithdrawal({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			feeNanomina: 100_000_000
		})

		await expect(
			worker.completeSdkSignature({
				requestId: finalize.requestId,
				signedTransaction: signedCommand(user)
			})
		).rejects.toThrow("Debug scenario: claim failed")

		store.reset()
		store.setScenario("repro-claim-failure")
		store.seedRecoveredOperation("deposit", { amount: "4" })

		const finalizeDeposit = await worker.finalizeDeposit({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			feeNanomina: 100_000_000
		})

		await expect(
			worker.completeSdkSignature({
				requestId: finalizeDeposit.requestId,
				signedTransaction: signedCommand(user)
			})
		).rejects.toThrow("Debug scenario: claim failed")
	})

	it("can reproduce local withdrawal completion before terminal recovery indexing", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		store.setScenario("repro-unindexed-withdrawal-completion")
		const worker = createMockBridgeOperationsWorker({ store })
		const user = "B62qtest-user"

		store.seedRecoveredOperation("withdrawal", { amount: "1" })

		await expect(
			worker.canFinalizeWithdrawal({
				user,
				l1: "mina:devnet",
				l2: "zeko-m:testnet"
			})
		).resolves.toEqual({
			available: true,
			reason: null,
			status: "available",
			index: 1
		})

		const finalize = await worker.finalizeWithdrawal({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			feeNanomina: 100_000_000
		})
		await worker.completeSdkSignature({
			requestId: finalize.requestId,
			signedTransaction: signedCommand(user)
		})

		const pendingRecovery = await worker.findPendingOperations({
			account: user,
			l1: "mina:devnet",
			l2: "zeko-m:testnet"
		})
		expect(pendingRecovery.withdrawals[0]).toMatchObject({
			index: 1,
			finalised: false
		})

		const terminalRecovery = await worker.findPendingOperations({
			account: user,
			l1: "mina:devnet",
			l2: "zeko-m:testnet"
		})
		expect(terminalRecovery.withdrawals[0]).toMatchObject({
			index: 1,
			finalised: true
		})
	})
})
