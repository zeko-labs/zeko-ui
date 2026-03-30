import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createActor, fromCallback, setup, waitFor } from "xstate"

vi.mock("@sentry/nuxt", () => ({
	addIntegration: vi.fn(),
	webWorkerIntegration: vi.fn(() => ({}))
}))

vi.mock("../../machines/operations.worker?worker&url", () => ({
	default: "/mock-operations-worker.js"
}))

class MockWorker {
	addEventListener() {}
	removeEventListener() {}
	postMessage() {}
	terminate() {}
}

const createWalletActor = (currentNetwork = "mina:devnet") =>
	createActor(
		setup({
			types: {
				context: {} as { account: string; currentNetwork: string },
				events: {} as { type: string }
			}
		}).createMachine({
			context: {
				account: "B62test",
				currentNetwork
			}
		})
	)

describe("bridgeMachine", () => {
	beforeEach(() => {
		vi.stubGlobal("Worker", MockWorker)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
		vi.resetModules()
	})

	it("releases the cancellation slot when a main-lane cancellation completes", async () => {
		const { bridgeMachine } = await import("../../machines/bridge")

		const wallet = createWalletActor()
		wallet.start()

		const stubBridgeOperationMachine = setup({
			types: {
				context: {} as { direction: "deposit" | "withdrawal" },
				input: {} as { direction: "deposit" | "withdrawal" },
				events: {} as { type: string; paused?: boolean }
			}
		}).createMachine({
			context: ({ input }) => ({ direction: input.direction }),
			on: {
				StartBridgeOperation: {},
				Resume: {},
				CompleteBridgeOperation: {},
				CompleteBridgeOperationCancelled: {}
			}
		})

		const actor = createActor(
			bridgeMachine.provide({
				actors: {
					detectWalletChange: fromCallback(() => () => {}),
					bridgeOperationMachine: stubBridgeOperationMachine
				}
			}),
			{
				input: { wallet: wallet as never }
			}
		)

		actor.start()
		actor.send({ type: "StartOperation", amount: "1" })

		await waitFor(actor, (snapshot) => snapshot.context.operations.size === 1)

		const operationId = actor.getSnapshot().context.activeOperation

		expect(operationId).not.toBeNull()

		actor.send({ type: "ActivateCancellationOperation", id: operationId! })
		expect(actor.getSnapshot().context.activeCancellationOperation).toBe(operationId)

		actor.send({ type: "CompleteOperation", id: operationId! })

		expect(actor.getSnapshot().context.activeCancellationOperation).toBeNull()

		actor.stop()
		wallet.stop()
	})
})
