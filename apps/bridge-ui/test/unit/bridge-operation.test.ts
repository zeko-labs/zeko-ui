import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { assign, createActor, fromPromise, setup, waitFor } from "xstate"
import { toUserFriendlyMessage } from "../../app/errors"
import { bridgeOperationMachine } from "../../machines/bridgeOperation"

vi.mock("../../app/service-worker/notificationList", () => ({
	finalizeNotification: vi.fn(async () => {})
}))

const firstWithdrawalTooSmallMessage =
	"First Zeko->Mina withdrawal amount is too small: recipient B62test does not have an L1 helper account yet, so the first withdrawal must be at least 1 MINA to cover the Mina account creation fee. This withdrawal is 0.2 MINA and cannot proceed as submitted."

const createBridgeActor = (
	worker: object = {},
	contextOverrides?: Partial<{
		activeOperation: string | null
		activeCancellationOperation: string | null
	}>
) =>
	createActor(
		setup({
			types: {
				context: {} as {
					activeOperation: string | null
					activeCancellationOperation: string | null
					events: Array<{ type: string; id?: string }>
					worker: object
				},
				events: {} as { type: string; id?: string }
			}
		}).createMachine({
			context: {
				activeOperation: contextOverrides?.activeOperation ?? null,
				activeCancellationOperation: contextOverrides?.activeCancellationOperation ?? null,
				events: [],
				worker
			},
			on: {
				TerminateOperation: {
					actions: assign({
						events: ({ context, event }) => [...context.events, event]
					})
				},
				ActivateCancellationOperation: {
					actions: assign({
						activeCancellationOperation: ({ event }) => event.id,
						events: ({ context, event }) => [...context.events, event]
					})
				},
				ReleaseCancellationOperation: {
					actions: assign({
						activeCancellationOperation: ({ context, event }) =>
							context.activeCancellationOperation === event.id
								? null
								: context.activeCancellationOperation,
						events: ({ context, event }) => [...context.events, event]
					})
				}
			}
		})
	)

const createWalletActor = (currentNetwork = "mina:testnet") =>
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
				account: "B62test",
				currentNetwork,
				events: []
			},
			on: {
				RequestNetworkChange: {
					actions: assign({
						events: ({ context, event }) => [...context.events, event]
					})
				},
				FetchBalance: {
					actions: assign({
						events: ({ context, event }) => [...context.events, event]
					})
				}
			}
		})
	)
describe("bridgeOperationMachine", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {})
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 204 }))
		)
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.unstubAllGlobals()
	})

	it("stores the early withdrawal threshold SDK error from submitWithdrawal", async () => {
		const bridge = createBridgeActor()
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					submitWithdrawal: fromPromise(async () => {
						throw new Error(firstWithdrawalTooSmallMessage)
					})
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko:testnet",
					destination: "mina:devnet",
					direction: "withdrawal",
					amount: "0.2"
				}
			}
		)

		actor.start()
		actor.send({ type: "StartBridgeOperation" })

		await waitFor(actor, (snapshot) => snapshot.matches("FAILED"))

		const error = actor.getSnapshot().context.errors.at(-1)

		expect(error?.message).toBe(firstWithdrawalTooSmallMessage)
		expect(toUserFriendlyMessage(error)).toContain("required Mina helper account")
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "TerminateOperation")
		).toBe(true)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("clears pending deposit retry timers on stop", async () => {
		vi.useFakeTimers()
		const bridge = createBridgeActor({
			canFinalizeDeposit: vi.fn(async () => ({ available: false, reason: "Older deposit blocks" })),
			canCancelDeposit: vi.fn(async () => ({ available: false, reason: "Not timed out" }))
		})
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:testnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1"
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })
		await Promise.resolve()
		await vi.advanceTimersByTimeAsync(20_000)
		expect(vi.getTimerCount()).toBeGreaterThan(0)

		actor.stop()
		expect(vi.getTimerCount()).toBe(0)

		bridge.stop()
		wallet.stop()
		vi.useRealTimers()
	})

	it("clears pending withdrawal retry timers on stop", async () => {
		vi.useFakeTimers()
		const bridge = createBridgeActor({
			canFinalizeWithdrawal: vi.fn(async () => ({ available: false, reason: "Still pending" }))
		})
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "zeko:testnet",
				destination: "mina:devnet",
				direction: "withdrawal",
				amount: "1"
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })
		await Promise.resolve()
		await vi.advanceTimersByTimeAsync(20_000)
		expect(vi.getTimerCount()).toBeGreaterThan(0)

		actor.stop()
		expect(vi.getTimerCount()).toBe(0)

		bridge.stop()
		wallet.stop()
		vi.useRealTimers()
	})
	it("allows a recovered cancellable deposit to cancel from PAUSED", async () => {
		const bridge = createBridgeActor({
			cancelDeposit: vi.fn(async () => JSON.stringify({ feePayer: {}, accountUpdates: [] }))
		})
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: { hash: "HASH", explorer: "https://example.com" }
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko:testnet",
					direction: "deposit",
					amount: "1",
					transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" },
					cancellable: true
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: true })
		expect(actor.getSnapshot().matches("PAUSED")).toBe(true)

		actor.send({ type: "Cancel" })

		await waitFor(actor, (snapshot) => snapshot.matches("CANCEL_DEPOSIT"))

		expect(bridge.getSnapshot().context.activeCancellationOperation).toBe(actor.id)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("ignores duplicate cancel clicks once cancellation has started", async () => {
		const bridge = createBridgeActor({
			cancelDeposit: vi.fn(async () => JSON.stringify({ feePayer: {}, accountUpdates: [] }))
		})
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: { hash: "HASH", explorer: "https://example.com" }
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko:testnet",
					direction: "deposit",
					amount: "1",
					transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" },
					cancellable: true
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: true })
		expect(actor.getSnapshot().matches("PAUSED")).toBe(true)

		actor.send({ type: "Cancel" })
		actor.send({ type: "Cancel" })

		await waitFor(actor, (snapshot) => snapshot.matches("CANCEL_DEPOSIT"))

		expect(
			bridge
				.getSnapshot()
				.context.events.filter((event) => event.type === "ActivateCancellationOperation")
		).toHaveLength(1)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("blocks a second cancellation when another cancellation lane operation is active", async () => {
		const bridge = createBridgeActor({}, { activeCancellationOperation: "other-operation" })
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:devnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1",
				transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" },
				cancellable: true
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: true })
		actor.send({ type: "Cancel" })

		await Promise.resolve()
		expect(actor.getSnapshot().matches("PAUSED")).toBe(true)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("updates a paused recovered deposit from refresh state without leaving PAUSED", async () => {
		const bridge = createBridgeActor()
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:devnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1",
				transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" }
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: true })
		actor.send({ type: "SyncRecoveredState", cancellable: true, timeoutSlot: "63540" })

		expect(actor.getSnapshot().matches("PAUSED")).toBe(true)
		expect(actor.getSnapshot().context.canCancel).toBe(true)
		expect(actor.getSnapshot().context.timeoutSlot).toBe("63540")

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("keeps a deposit pending when no finalize or cancel path is available yet", async () => {
		const bridge = createBridgeActor({
			canFinalizeDeposit: vi.fn(async () => ({ available: false, reason: "Older deposit blocks" })),
			canCancelDeposit: vi.fn(async () => ({ available: false, reason: "Not timed out" }))
		})
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:testnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1"
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await Promise.resolve()
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(actor.getSnapshot().matches("PENDING_DEPOSIT")).toBe(true)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("updates a pending deposit with cancellable recovery state without leaving the main flow state", async () => {
		const bridge = createBridgeActor({
			canFinalizeDeposit: vi.fn(async () => ({ available: false, reason: "Older deposit blocks" }))
		})
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:testnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1"
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await waitFor(actor, (snapshot) => snapshot.matches("PENDING_DEPOSIT"))

		actor.send({ type: "SyncRecoveredState", cancellable: true, timeoutSlot: "63540" })

		await Promise.resolve()
		expect(actor.getSnapshot().matches("PENDING_DEPOSIT")).toBe(true)
		expect(actor.getSnapshot().context.canCancel).toBe(true)
		expect(actor.getSnapshot().context.timeoutSlot).toBe("63540")

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("treats finalization polling as the only main-lane transition signal", async () => {
		const bridge = createBridgeActor({
			canFinalizeDeposit: vi.fn(async () => ({ available: true, reason: null }))
		})
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:testnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1"
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await waitFor(actor, (snapshot) => snapshot.matches("TO_FINALIZE"))

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("keeps a started claimable deposit in TO_FINALIZE until the parent pauses and requeues it", async () => {
		const bridge = createBridgeActor()
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:testnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1"
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize" })
		expect(actor.getSnapshot().matches("TO_FINALIZE")).toBe(true)

		actor.send({ type: "SyncRecoveredState", cancellable: true, timeoutSlot: "63540" })

		await Promise.resolve()
		expect(actor.getSnapshot().matches("TO_FINALIZE")).toBe(true)
		expect(actor.getSnapshot().context.canCancel).toBe(true)
		expect(actor.getSnapshot().context.timeoutSlot).toBe("63540")

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("pauses a claimable deposit when recovery sync moves it into the cancellation queue", async () => {
		const bridge = createBridgeActor()
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:testnet",
				destination: "zeko:testnet",
				direction: "deposit",
				amount: "1"
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize" })
		expect(actor.getSnapshot().matches("TO_FINALIZE")).toBe(true)

		actor.send({ type: "SyncRecoveredState", cancellable: true, timeoutSlot: "63540" })
		actor.send({ type: "Pause" })

		await waitFor(actor, (snapshot) => snapshot.matches("PAUSED"))
		expect(actor.getSnapshot().context.canCancel).toBe(true)
		expect(actor.getSnapshot().context.timeoutSlot).toBe("63540")

		actor.stop()
		bridge.stop()
		wallet.stop()
	})
})
