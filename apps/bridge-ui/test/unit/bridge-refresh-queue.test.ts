import type { walletMachine } from "@zeko/sdk"
import { describe, expect, it, vi } from "vitest"
import { type ActorRefFromLogic, assign, createActor, fromCallback, setup, waitFor } from "xstate"
import { bridgeMachine } from "../../machines/bridge"
import { getBridgeDebugBackendStore } from "../../machines/mockBackend"

vi.mock("../../app/service-worker/notificationList", () => ({
	finalizeNotification: vi.fn(async () => {})
}))

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

describe("bridge refresh queue sync", () => {
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
})
