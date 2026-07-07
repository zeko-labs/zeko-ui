import type { walletMachine } from "@zeko/sdk"
import { afterEach, describe, expect, it, vi } from "vitest"
import { type ActorRefFromLogic, assign, createActor, fromCallback, setup, waitFor } from "xstate"
import { bridgeMachine, shouldRefreshPendingOperations } from "../../machines/bridge"
import { getBridgeDebugBackendStore } from "../../machines/mockBackend"
import type { BridgeNetwork } from "../../machines/networks"
import {
	savePendingBridgeTransaction,
	type PendingBridgeTransaction
} from "../../machines/pendingTransactions"

vi.mock("../../app/service-worker/notificationList", () => ({
	finalizeNotification: vi.fn(async () => {})
}))

afterEach(() => {
	vi.unstubAllGlobals()
})

const createWalletActor = () =>
	createActor(
		setup({
			types: {
				context: {} as {
					account: string
					currentNetwork: string
					events: Array<{ type: string; network?: string }>
				},
				events: {} as { type: string; network?: string }
			}
		}).createMachine({
			context: {
				account: "B62qtest-user",
				currentNetwork: "mina:devnet",
				events: []
			},
			on: {
				FetchBalance: {
					actions: assign({
						events: ({ context, event }) => [...context.events, event]
					})
				},
				RequestNetworkChange: {
					actions: assign({
						events: ({ context, event }) => [...context.events, event]
					})
				}
			}
		})
	)

const signedTransactionForUser = (user: string) => ({
	signedData: JSON.stringify({
		zkappCommand: {
			accountUpdates: [],
			feePayer: { authorization: "", body: { fee: "100000000", publicKey: user } },
			memo: ""
		}
	})
})

type MemoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const createMemoryStorage = (): MemoryStorage => {
	const values = new Map<string, string>()
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key)
	}
}

const pendingRecord = (
	overrides: Partial<PendingBridgeTransaction> = {}
): PendingBridgeTransaction => ({
	schemaVersion: 1,
	walletAddress: "B62qtest-user",
	l1: "mina:devnet" as BridgeNetwork,
	l2: "zeko-m:testnet" as BridgeNetwork,
	source: "mina:devnet" as BridgeNetwork,
	destination: "zeko-m:testnet" as BridgeNetwork,
	direction: "deposit",
	amount: "1",
	transactionHash: "5JpendingHash",
	submittedAtMs: Date.now(),
	status: "awaiting-inclusion",
	...overrides
})

describe("bridge refresh queue sync", () => {
	it("keeps polling when only a local pending transaction is visible", () => {
		const storage = createMemoryStorage()
		vi.stubGlobal("localStorage", storage)
		savePendingBridgeTransaction(pendingRecord(), { storage })
		const wallet = createWalletActor()
		wallet.start()

		expect(
			shouldRefreshPendingOperations({
				sourceNetwork: "mina:devnet" as BridgeNetwork,
				destinationNetwork: "zeko-m:testnet" as BridgeNetwork,
				operations: new Map(),
				wallet: wallet as unknown as never,
				walletReady: true,
				accountReady: true,
				activeOperation: null,
				activeCancellationOperation: null,
				nextOperationOrder: 0,
				worker: {} as never
			})
		).toBe(true)

		wallet.stop()
	})

	it("does not poll for unrelated local pending transactions", () => {
		const storage = createMemoryStorage()
		vi.stubGlobal("localStorage", storage)
		savePendingBridgeTransaction(
			pendingRecord({ walletAddress: "B62qother-user", transactionHash: "5JotherHash" }),
			{ storage }
		)
		const wallet = createWalletActor()
		wallet.start()

		expect(
			shouldRefreshPendingOperations({
				sourceNetwork: "mina:devnet" as BridgeNetwork,
				destinationNetwork: "zeko-m:testnet" as BridgeNetwork,
				operations: new Map(),
				wallet: wallet as unknown as never,
				walletReady: true,
				accountReady: true,
				activeOperation: null,
				activeCancellationOperation: null,
				nextOperationOrder: 0,
				worker: {} as never
			})
		).toBe(false)

		wallet.stop()
	})

	it("queues recovered main operations behind an active local operation that is not indexed yet", async () => {
		vi.stubGlobal("mina", {
			sendTransaction: vi.fn(() => new Promise(() => {}))
		})
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		bridge.send({ type: "StartOperation", amount: "1" })
		const activeSnapshot = await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.activeOperation !== null &&
				snapshot.context.operations.get(snapshot.context.activeOperation)?.status === "started"
		)
		const localOperationId = activeSnapshot.context.activeOperation
		if (!localOperationId) throw new Error("Expected active local operation")

		const seed = store.seedRecoveredOperation("deposit")
		bridge.send({ type: "RefreshOperations" })
		const refreshed = await waitFor(
			bridge,
			(snapshot) => snapshot.context.operations.has(seed.id) && snapshot.matches("READY")
		)

		expect(refreshed.context.activeOperation).toBe(localOperationId)
		expect(refreshed.context.operations.get(localOperationId)).toMatchObject({
			lane: "main",
			status: "started"
		})
		expect(refreshed.context.operations.get(seed.id)).toMatchObject({
			lane: "main",
			status: "paused"
		})

		bridge.stop()
		wallet.stop()
	})

	it("queues newly recovered deposits behind an active withdrawal", async () => {
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.operations.has("debug-withdrawal-1") && snapshot.matches("READY")
		)

		store.seedRecoveredOperation("deposit")
		bridge.send({ type: "RefreshOperations" })
		const snapshot = await waitFor(
			bridge,
			(snapshot) => snapshot.context.operations.has("debug-deposit-2") && snapshot.matches("READY")
		)

		expect(snapshot.context.activeOperation).toBe("debug-withdrawal-1")
		expect(snapshot.context.operations.get("debug-withdrawal-1")).toMatchObject({
			lane: "main",
			order: 0,
			status: "started"
		})
		expect(snapshot.context.operations.get("debug-deposit-2")).toMatchObject({
			lane: "main",
			order: 1,
			status: "paused"
		})

		bridge.stop()
		wallet.stop()
	})

	it("does not verify a completed local operation from a terminal recovery with another action index", async () => {
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		const seed = store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) => snapshot.context.operations.has(seed.id) && snapshot.matches("READY")
		)

		bridge.send({ type: "CompleteOperation", id: seed.id })
		store.update((current) => ({
			...current,
			seededOperations: current.seededOperations.map((operation) =>
				operation.id === seed.id
					? { ...operation, finalised: true, index: seed.index + 1 }
					: operation
			)
		}))

		const refreshCount = store.getSnapshot().findPendingOperationsCount
		bridge.send({ type: "RefreshOperations" })
		const snapshot = await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.operations.get(seed.id)?.status === "completed" &&
				store.getSnapshot().findPendingOperationsCount > refreshCount &&
				snapshot.matches("READY")
		)
		const operationSnapshot = snapshot.context.operations
			.get(seed.id)
			?.operation.getSnapshot().context

		expect(operationSnapshot?.actionIndex).toBe(seed.index)
		expect(operationSnapshot?.completionVerification).toBe("unverified")

		bridge.stop()
		wallet.stop()
	})

	it("keeps the active operation when a terminal recovery with another action index is rejected", async () => {
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		const activeSeed = store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) => snapshot.context.activeOperation === activeSeed.id && snapshot.matches("READY")
		)

		const queuedSeed = store.seedRecoveredOperation("deposit")
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.activeOperation === activeSeed.id &&
				snapshot.context.operations.get(queuedSeed.id)?.status === "paused" &&
				snapshot.matches("READY")
		)

		store.update((current) => ({
			...current,
			seededOperations: current.seededOperations.map((operation) =>
				operation.id === activeSeed.id
					? { ...operation, finalised: true, index: activeSeed.index + 1 }
					: operation
			)
		}))

		const refreshCount = store.getSnapshot().findPendingOperationsCount
		bridge.send({ type: "RefreshOperations" })
		const snapshot = await waitFor(
			bridge,
			(snapshot) =>
				store.getSnapshot().findPendingOperationsCount > refreshCount && snapshot.matches("READY")
		)
		const activeOperationSnapshot = snapshot.context.operations
			.get(activeSeed.id)
			?.operation.getSnapshot()

		expect(snapshot.context.activeOperation).toBe(activeSeed.id)
		expect(snapshot.context.operations.get(activeSeed.id)).toMatchObject({
			lane: "main",
			status: "started"
		})
		expect(activeOperationSnapshot?.context.actionIndex).toBe(activeSeed.index)
		expect(activeOperationSnapshot?.context.completionVerification).toBe("unverified")
		expect(snapshot.context.operations.get(queuedSeed.id)).toMatchObject({
			lane: "main",
			status: "paused"
		})

		bridge.stop()
		wallet.stop()
	})

	it("transitions a live matched terminal recovery into the actor done state", async () => {
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		const seed = store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		const liveBridgeSnapshot = await waitFor(
			bridge,
			(snapshot) => snapshot.context.operations.has(seed.id) && snapshot.matches("READY")
		)
		const liveOperation = liveBridgeSnapshot.context.operations.get(seed.id)?.operation
		if (!liveOperation) throw new Error("Expected recovered operation actor")

		await waitFor(
			liveOperation,
			(snapshot) => snapshot.matches("PENDING_WITHDRAWAL") || snapshot.matches("TO_FINALIZE")
		)

		store.update((current) => ({
			...current,
			seededOperations: current.seededOperations.map((operation) =>
				operation.id === seed.id ? { ...operation, finalised: true } : operation
			)
		}))

		const refreshCount = store.getSnapshot().findPendingOperationsCount
		bridge.send({ type: "RefreshOperations" })
		const completedBridgeSnapshot = await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.operations.get(seed.id)?.status === "completed" &&
				store.getSnapshot().findPendingOperationsCount > refreshCount &&
				snapshot.matches("READY")
		)
		const operationSnapshot = completedBridgeSnapshot.context.operations
			.get(seed.id)
			?.operation.getSnapshot()

		expect(
			operationSnapshot?.matches("BRIDGE_OPERATION_COMPLETED") ||
				operationSnapshot?.matches("BRIDGE_OPERATION_DONE") ||
				operationSnapshot?.matches("BRIDGE_OPERATION_DONE_NOOP")
		).toBe(true)
		expect(operationSnapshot?.matches("PENDING_WITHDRAWAL")).toBe(false)
		expect(operationSnapshot?.matches("TO_FINALIZE")).toBe(false)
		expect(operationSnapshot?.context.completionVerification).toBe("verified")
		expect(operationSnapshot?.context.actionIndex).toBe(seed.index)
		expect(completedBridgeSnapshot.context.activeOperation).toBeNull()

		bridge.stop()
		wallet.stop()
	})

	it("keeps the next queued operation active after terminal recovery settles the previous actor", async () => {
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		const activeSeed = store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) => snapshot.context.activeOperation === activeSeed.id && snapshot.matches("READY")
		)

		const queuedSeed = store.seedRecoveredOperation("deposit")
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.activeOperation === activeSeed.id &&
				snapshot.context.operations.get(queuedSeed.id)?.status === "paused" &&
				snapshot.matches("READY")
		)

		store.update((current) => ({
			...current,
			seededOperations: current.seededOperations.map((operation) =>
				operation.id === activeSeed.id ? { ...operation, finalised: true } : operation
			)
		}))

		const refreshCount = store.getSnapshot().findPendingOperationsCount
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.operations.get(activeSeed.id)?.status === "completed" &&
				snapshot.context.operations.get(queuedSeed.id)?.status === "started" &&
				store.getSnapshot().findPendingOperationsCount > refreshCount &&
				snapshot.matches("READY")
		)
		await new Promise((resolve) => setTimeout(resolve, 0))

		const snapshot = bridge.getSnapshot()
		expect(snapshot.context.activeOperation).toBe(queuedSeed.id)
		expect(snapshot.context.operations.get(queuedSeed.id)).toMatchObject({
			lane: "main",
			status: "started"
		})

		bridge.stop()
		wallet.stop()
	})

	it("can simulate page refresh repeatedly without duplicate recovered actor ids", async () => {
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		const seed = store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) => snapshot.context.operations.has(seed.id) && snapshot.matches("READY")
		)

		bridge.send({ type: "SimulatePageRefresh" })
		await waitFor(
			bridge,
			(snapshot) => snapshot.context.operations.has(seed.id) && snapshot.matches("READY")
		)
		bridge.send({ type: "SimulatePageRefresh" })
		const refreshed = await waitFor(
			bridge,
			(snapshot) => snapshot.context.operations.has(seed.id) && snapshot.matches("READY")
		)

		expect(refreshed.context.operations.get(seed.id)).toMatchObject({
			lane: "main",
			status: "started"
		})

		bridge.stop()
		wallet.stop()
	})

	it("removes a pre-submit wallet rejection from the active main operation", async () => {
		vi.stubGlobal("mina", {
			sendTransaction: vi.fn(async () => new Error("User rejected the request"))
		})
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		bridge.send({ type: "StartOperation", amount: "2" })
		const released = await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.activeOperation === null && snapshot.context.operations.size === 0
		)

		expect(released.context.activeOperation).toBeNull()
		expect(released.context.operations.size).toBe(0)

		bridge.stop()
		wallet.stop()
	})

	it("removes a pre-submit non-wallet failure from the active main operation", async () => {
		vi.stubGlobal("mina", {
			sendTransaction: vi.fn(async () => {
				throw new Error("Error invoking post: Method not found")
			})
		})
		const store = getBridgeDebugBackendStore()
		store.reset()
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: "B62qtest-user" })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		bridge.send({ type: "StartOperation", amount: "2" })
		const completed = await waitFor(bridge, (snapshot) => {
			if (snapshot.context.activeOperation === null && snapshot.context.operations.size === 0) {
				return true
			}
			const activeOperation = snapshot.context.activeOperation
				? snapshot.context.operations.get(snapshot.context.activeOperation)
				: null
			return activeOperation?.operation.getSnapshot().matches("FAILED") === true
		})

		expect(completed.context.activeOperation).toBeNull()
		expect(completed.context.operations.size).toBe(0)

		bridge.stop()
		wallet.stop()
	})

	it("releases a post-submit claim failure from the active main operation", async () => {
		const user = "B62qtest-user"
		vi.stubGlobal("mina", {
			sendTransaction: vi.fn(async () => signedTransactionForUser(user))
		})
		const store = getBridgeDebugBackendStore()
		store.reset()
		store.setScenario("repro-claim-failure")
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: user })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		const seed = store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		const recovered = await waitFor(
			bridge,
			(snapshot) => snapshot.context.activeOperation === seed.id && snapshot.matches("READY")
		)
		const operation = recovered.context.operations.get(seed.id)?.operation
		if (!operation) throw new Error("Expected recovered operation actor")

		await waitFor(operation, (snapshot) => snapshot.matches("TO_FINALIZE"))
		operation.send({ type: "Finalize" })
		await waitFor(operation, (snapshot) => snapshot.matches("FAILED"))
		const released = await waitFor(
			bridge,
			(snapshot) =>
				snapshot.context.activeOperation === null &&
				snapshot.context.operations.has(seed.id) &&
				snapshot.context.operations.get(seed.id)?.status === "completed" &&
				snapshot.context.operations.get(seed.id)?.operation.getSnapshot().matches("FAILED") === true
		)

		expect(released.context.activeOperation).toBeNull()
		expect(released.context.operations.get(seed.id)).toMatchObject({
			lane: "main",
			status: "completed"
		})

		bridge.stop()
		wallet.stop()
	})

	it("reconciles a failed recovered claim when a terminal refresh arrives", async () => {
		const user = "B62qtest-user"
		vi.stubGlobal("mina", {
			sendTransaction: vi.fn(async () => signedTransactionForUser(user))
		})
		const store = getBridgeDebugBackendStore()
		store.reset()
		store.setScenario("repro-claim-failure")
		const wallet = createWalletActor()
		wallet.start()
		const bridge = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => {})
				}
			}),
			{
				input: {
					debugMode: "mock-backend",
					wallet: wallet as unknown as ActorRefFromLogic<typeof walletMachine>
				}
			}
		)
		bridge.start()

		bridge.send({ type: "AccountChanged", account: user })
		bridge.send({ type: "NetworkChanged", network: "mina:devnet" })
		await waitFor(bridge, (snapshot) => snapshot.matches("READY"))

		const seed = store.seedRecoveredOperation("withdrawal")
		bridge.send({ type: "RefreshOperations" })
		const recovered = await waitFor(
			bridge,
			(snapshot) => snapshot.context.activeOperation === seed.id && snapshot.matches("READY")
		)
		const operation = recovered.context.operations.get(seed.id)?.operation
		if (!operation) throw new Error("Expected recovered operation actor")

		await waitFor(operation, (snapshot) => snapshot.matches("TO_FINALIZE"))
		operation.send({ type: "Finalize" })
		await waitFor(operation, (snapshot) => snapshot.matches("FAILED"))
		await waitFor(bridge, (snapshot) => snapshot.context.activeOperation === null)

		store.update((current) => ({
			...current,
			seededOperations: current.seededOperations.map((operation) =>
				operation.id === seed.id ? { ...operation, finalised: true } : operation
			)
		}))

		const refreshCount = store.getSnapshot().findPendingOperationsCount
		bridge.send({ type: "RefreshOperations" })
		await waitFor(
			bridge,
			(snapshot) =>
				store.getSnapshot().findPendingOperationsCount > refreshCount && snapshot.matches("READY")
		)
		const refreshedOperation = await waitFor(
			operation,
			(snapshot) => snapshot.context.completionVerification === "verified"
		)

		const refreshed = bridge.getSnapshot()

		expect(refreshedOperation.matches("FAILED")).toBe(false)
		expect(refreshedOperation.matches("BRIDGE_OPERATION_DONE_NOOP")).toBe(true)
		expect(refreshedOperation.context.completionVerification).toBe("verified")
		expect(refreshed.context.activeOperation).toBeNull()

		bridge.stop()
		wallet.stop()
	})
})
