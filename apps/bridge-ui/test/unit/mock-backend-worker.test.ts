import type { ZkappCommand } from "@aurowallet/mina-provider"
import { beforeEach, describe, expect, it } from "vitest"
import type { OperationsWorker } from "../../machines/operations.worker"
import {
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

	it("can hold deposit finalization pending until debug state advances", async () => {
		const store = createBridgeDebugBackendStore({ storage })
		store.setScenario("delayed-deposit-finalization")
		const worker = createMockBridgeOperationsWorker({ store })

		await expect(
			worker.canFinalizeDeposit({
				l1: "mina:devnet",
				l2: "zeko-m:testnet",
				user: "B62qtest-user"
			})
		).resolves.toEqual({ available: false, reason: "Debug scenario: deposit pending" })

		store.advancePendingStatus()

		await expect(
			worker.canFinalizeDeposit({
				l1: "mina:devnet",
				l2: "zeko-m:testnet",
				user: "B62qtest-user"
			})
		).resolves.toEqual({ available: true, reason: null })
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
})
