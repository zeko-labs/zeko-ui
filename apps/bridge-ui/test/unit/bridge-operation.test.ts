import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { assign, createActor, fromPromise, setup, waitFor } from "xstate"
import { QuietError, toUserFriendlyMessage } from "../../app/errors"
import { bridgeOperationMachine } from "../../machines/bridgeOperation"
import {
	loadPendingBridgeTransactions,
	savePendingBridgeTransaction
} from "../../machines/pendingTransactions"
import type { BridgeNetwork } from "../../machines/networks"

const unsignedTransaction = ({ fee, user }: { fee: number; user: string }) =>
	JSON.stringify({
		accountUpdates: [],
		feePayer: { authorization: "", body: { fee: String(fee), publicKey: user } },
		memo: ""
	})

vi.mock("../../app/service-worker/notificationList", () => ({
	finalizeNotification: vi.fn(async () => {})
}))

const firstWithdrawalTooSmallMessage =
	"First Zeko->Mina withdrawal amount is too small: recipient B62test requires 0.2 MINA bridge fees, 1 MINA helper account creation, and 1 MINA recipient account creation on Mina, so the transfer amount must be at least 2.2 MINA."

type MemoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const createMemoryStorage = (): MemoryStorage => {
	const values = new Map<string, string>()
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key)
	}
}

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
				CompleteOperation: {
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
				},
				RefreshOperations: {
					actions: assign({
						events: ({ context, event }) => [...context.events, event]
					})
				}
			}
		})
	)

const createWalletActor = (currentNetwork = "mina:devnet") =>
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

	it("stores and clears the early withdrawal threshold SDK error from submitWithdrawal", async () => {
		const bridge = createBridgeActor()
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => {
						throw new Error(firstWithdrawalTooSmallMessage)
					})
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko-m:testnet",
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
		expect(toUserFriendlyMessage(error)).toContain("at least 2.2 MINA")
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
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 0
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
				source: "zeko-m:testnet",
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

	it("signs and completes an SDK deposit request without the legacy send path", async () => {
		const transactionMachine = vi.fn(async ({ input }) => {
			expect(input).toMatchObject({
				id: expect.any(String),
				user: "B62test",
				network: "mina:devnet"
			})
			return {
				result: {
					hash: "5JuyQd4aQLYP6SLUihfy1wMcPVsqUKagbDVXw4P2iX2PpA5iPzUc",
					url: "https://minascan.io/devnet/tx/5JuyQd4aQLYP6SLUihfy1wMcPVsqUKagbDVXw4P2iX2PpA5iPzUc"
				}
			}
		})
		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(transactionMachine),
					pendingDeposit: fromPromise(async () => undefined)
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko-m:testnet",
					direction: "deposit",
					amount: "1"
				}
			}
		)

		actor.start()
		actor.send({ type: "StartBridgeOperation" })

		await waitFor(actor, (snapshot) => snapshot.matches("PENDING_DEPOSIT"))

		expect(transactionMachine).toHaveBeenCalledOnce()
		expect(actor.getSnapshot().context.transactions.submitDeposit?.result).toEqual({
			hash: "5JuyQd4aQLYP6SLUihfy1wMcPVsqUKagbDVXw4P2iX2PpA5iPzUc",
			url: "https://minascan.io/devnet/tx/5JuyQd4aQLYP6SLUihfy1wMcPVsqUKagbDVXw4P2iX2PpA5iPzUc"
		})

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("requests a parent refresh after signing a withdrawal", async () => {
		const transactionMachine = vi.fn(async () => ({
			result: {
				hash: "5JuwithdrawalSubmitHash",
				url: "https://zekoscan.io/testnet/tx/5JuwithdrawalSubmitHash"
			}
		}))
		const bridge = createBridgeActor()
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(transactionMachine),
					pendingWithdrawal: fromPromise(async () => undefined)
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko-m:testnet",
					destination: "mina:devnet",
					direction: "withdrawal",
					amount: "1"
				}
			}
		)

		actor.start()
		actor.send({ type: "StartBridgeOperation" })

		await waitFor(actor, (snapshot) => snapshot.matches("PENDING_WITHDRAWAL"))

		expect(transactionMachine).toHaveBeenCalledOnce()
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "RefreshOperations")
		).toBe(true)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("allows a recovered cancellable deposit to cancel from PAUSED", async () => {
		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: { hash: "HASH", url: "https://example.com" }
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko-m:testnet",
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
		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: { hash: "HASH", url: "https://example.com" }
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko-m:testnet",
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
				destination: "zeko-m:testnet",
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
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" }
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: true })
		actor.send({
			type: "SyncRecoveredState",
			actionIndex: 0,
			transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" },
			cancellable: true,
			timeoutSlot: "63540"
		})

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
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 0
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
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 0
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await waitFor(actor, (snapshot) => snapshot.matches("PENDING_DEPOSIT"))

		actor.send({
			type: "SyncRecoveredState",
			actionIndex: 0,
			transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" },
			cancellable: true,
			timeoutSlot: "63540"
		})

		await Promise.resolve()
		expect(actor.getSnapshot().matches("PENDING_DEPOSIT")).toBe(true)
		expect(actor.getSnapshot().context.canCancel).toBe(true)
		expect(actor.getSnapshot().context.timeoutSlot).toBe("63540")

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("keeps the main widget on finalization until queued cancellations have a separate UI", async () => {
		const bridge = createBridgeActor({
			canFinalizeDeposit: vi.fn(async () => ({ available: true, reason: null, index: 0 })),
			canCancelDeposit: vi.fn(async () => ({ available: true, reason: null }))
		})
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 0
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
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 0
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		expect(actor.getSnapshot().matches("TO_FINALIZE")).toBe(true)

		actor.send({
			type: "SyncRecoveredState",
			actionIndex: 0,
			transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" },
			cancellable: true,
			timeoutSlot: "63540"
		})

		await Promise.resolve()
		expect(actor.getSnapshot().matches("TO_FINALIZE")).toBe(true)
		expect(actor.getSnapshot().context.canCancel).toBe(true)
		expect(actor.getSnapshot().context.timeoutSlot).toBe("63540")

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("ignores a deposit finalization capability for another action index", async () => {
		const canFinalizeDeposit = vi.fn(async () => ({ available: true, reason: null, index: 1 }))
		const bridge = createBridgeActor({
			canFinalizeDeposit
		})
		const wallet = createWalletActor()
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 2
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await vi.waitFor(() => {
			expect(canFinalizeDeposit).toHaveBeenCalled()
		})
		await Promise.resolve()
		expect(actor.getSnapshot().matches("PENDING_DEPOSIT")).toBe(true)

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
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 0
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		expect(actor.getSnapshot().matches("TO_FINALIZE")).toBe(true)

		actor.send({
			type: "SyncRecoveredState",
			actionIndex: 0,
			transaction: { date: new Date("2026-03-24T00:00:00Z"), hash: "RECOVERED" },
			cancellable: true,
			timeoutSlot: "63540"
		})
		actor.send({ type: "Pause" })

		await waitFor(actor, (snapshot) => snapshot.matches("PAUSED"))
		expect(actor.getSnapshot().context.canCancel).toBe(true)
		expect(actor.getSnapshot().context.timeoutSlot).toBe("63540")

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("notifies the parent immediately when SDK deposit finalization completes", async () => {
		const bridge = createBridgeActor()
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: {
							hash: "5JuyQd4aQLYP6SLUihfy1wMcPVsqUKagbDVXw4P2iX2PpA5iPzUc",
							url: "https://minascan.io/devnet/tx/5JuyQd4aQLYP6SLUihfy1wMcPVsqUKagbDVXw4P2iX2PpA5iPzUc"
						}
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko-m:testnet",
					direction: "deposit",
					amount: "1",
					actionIndex: 0
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		await waitFor(actor, (snapshot) => snapshot.matches("BRIDGE_OPERATION_COMPLETED"))

		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "CompleteOperation")
		).toBe(true)
		expect(bridge.getSnapshot().context.events).toContainEqual({
			type: "CompleteOperation",
			id: actor.id
		})

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("passes cloneable worker payloads when finalizing a deposit", async () => {
		const user = "B62test"
		const signedCommand = {
			accountUpdates: [],
			feePayer: { authorization: "", body: { fee: "100000000", publicKey: user } },
			memo: ""
		}
		vi.stubGlobal("mina", {
			sendTransaction: vi.fn(async () => ({
				signedData: JSON.stringify({ zkappCommand: signedCommand })
			}))
		})

		const finalizeDeposit = vi.fn(async (input) => {
			expect(() => structuredClone(input)).not.toThrow()
			expect(input).not.toHaveProperty("bridge")
			expect(input).not.toHaveProperty("wallet")
			return {
				requestId: "request-finalize-deposit",
				transaction: unsignedTransaction({ fee: 100000000, user })
			}
		})
		const bridge = createBridgeActor({
			finalizeDeposit,
			completeSdkSignature: vi.fn(async () => "5JfinalizeDepositHash")
		})
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "mina:devnet",
				destination: "zeko-m:testnet",
				direction: "deposit",
				amount: "1",
				actionIndex: 0
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		await waitFor(actor, (snapshot) => snapshot.matches("BRIDGE_OPERATION_COMPLETED"))

		expect(finalizeDeposit).toHaveBeenCalledWith({
			l1: "mina:devnet",
			l2: "zeko-m:testnet",
			user,
			feeNanomina: 100_000_000
		})

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("requests a parent refresh when a withdrawal becomes claimable", async () => {
		const bridge = createBridgeActor({
			canFinalizeWithdrawal: vi.fn(async () => ({
				available: true,
				reason: null,
				index: 0
			}))
		})
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "zeko-m:testnet",
				destination: "mina:devnet",
				direction: "withdrawal",
				amount: "1",
				actionIndex: 0
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await waitFor(actor, (snapshot) => snapshot.matches("TO_FINALIZE"))

		expect(bridge.getSnapshot().context.events).toContainEqual({
			type: "RefreshOperations"
		})

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("does not return to claim when local pending storage says withdrawal is finalizing", async () => {
		const storage = createMemoryStorage()
		vi.stubGlobal("localStorage", storage)
		savePendingBridgeTransaction(
			{
				schemaVersion: 1,
				walletAddress: "B62test",
				l1: "mina:devnet" as BridgeNetwork,
				l2: "zeko-m:testnet" as BridgeNetwork,
				source: "zeko-m:testnet" as BridgeNetwork,
				destination: "mina:devnet" as BridgeNetwork,
				direction: "withdrawal",
				amount: "1",
				transactionHash: "5JoriginalWithdrawalHash",
				submittedAtMs: Date.now(),
				status: "finalizing"
			},
			{ storage }
		)
		const bridge = createBridgeActor({
			canFinalizeWithdrawal: vi.fn(async () => ({
				available: true,
				reason: null,
				index: 0
			}))
		})
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "zeko-m:testnet",
				destination: "mina:devnet",
				direction: "withdrawal",
				amount: "1",
				actionIndex: 0,
				transaction: { timestampMs: Date.now(), hash: "5JoriginalWithdrawalHash" }
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await waitFor(actor, (snapshot) => snapshot.matches("BRIDGE_OPERATION_COMPLETED"))

		expect(actor.getSnapshot().matches("TO_FINALIZE")).toBe(false)
		expect(actor.getSnapshot().context.completionVerification).toBe("unverified")
		expect(bridge.getSnapshot().context.events).toContainEqual({
			type: "CompleteOperation",
			id: actor.id
		})

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("persists finalizing status for the original transaction when withdrawal finalization is submitted", async () => {
		const storage = createMemoryStorage()
		vi.stubGlobal("localStorage", storage)
		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: {
							hash: "5JfinalizeWithdrawalHash",
							url: "https://minascan.io/devnet/tx/5JfinalizeWithdrawalHash"
						}
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko-m:testnet",
					destination: "mina:devnet",
					direction: "withdrawal",
					amount: "1",
					actionIndex: 0,
					transaction: { timestampMs: Date.now(), hash: "5JoriginalWithdrawalHash" }
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		await waitFor(actor, (snapshot) => snapshot.matches("BRIDGE_OPERATION_COMPLETED"))

		expect(
			loadPendingBridgeTransactions(
				{
					walletAddress: "B62test",
					l1: "mina:devnet",
					l2: "zeko-m:testnet"
				},
				{ storage }
			)
		).toMatchObject([
			{
				direction: "withdrawal",
				transactionHash: "5JoriginalWithdrawalHash",
				status: "finalizing"
			}
		])

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("completes a pending withdrawal when the SDK reports it is already finalised", async () => {
		const bridge = createBridgeActor({
			canFinalizeWithdrawal: vi.fn(async () => ({
				available: false,
				reason: "Withdrawal already finalised",
				status: "alreadyFinalised",
				index: 0
			}))
		})
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "zeko-m:testnet",
				destination: "mina:devnet",
				direction: "withdrawal",
				amount: "1",
				actionIndex: 0
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await waitFor(actor, (snapshot) => snapshot.matches("BRIDGE_OPERATION_COMPLETED"))

		expect(bridge.getSnapshot().context.events).toContainEqual({
			type: "CompleteOperation",
			id: actor.id
		})

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("ignores an already-finalised withdrawal result for another action index", async () => {
		const bridge = createBridgeActor({
			canFinalizeWithdrawal: vi.fn(async () => ({
				available: false,
				reason: "Withdrawal already finalised",
				status: "alreadyFinalised",
				index: 1
			}))
		})
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(bridgeOperationMachine, {
			input: {
				bridge: bridge as never,
				wallet: wallet as never,
				source: "zeko-m:testnet",
				destination: "mina:devnet",
				direction: "withdrawal",
				amount: "1",
				actionIndex: 2
			}
		})

		actor.start()
		actor.send({ type: "Resume", paused: false })

		await vi.waitFor(() => {
			expect(actor.getSnapshot().matches("PENDING_WITHDRAWAL")).toBe(true)
		})
		expect(bridge.getSnapshot().context.events).not.toContainEqual({
			type: "CompleteOperation",
			id: actor.id
		})

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("records a local completion timestamp when withdrawal finalization completes", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-05-07T18:30:00.000Z"))

		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: {
							hash: "5JfinalizeWithdrawalHash",
							url: "https://minascan.io/devnet/tx/5JfinalizeWithdrawalHash"
						}
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko-m:testnet",
					destination: "mina:devnet",
					direction: "withdrawal",
					amount: "1",
					actionIndex: 0
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		await waitFor(actor, (snapshot) => snapshot.matches("BRIDGE_OPERATION_COMPLETED"))

		expect(actor.getSnapshot().context.completedAtMs).toBe(1778178600000)

		actor.stop()
		bridge.stop()
		wallet.stop()
		vi.useRealTimers()
	})

	it("keeps local completion unverified until matching terminal recovery arrives", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-05-07T18:30:00.000Z"))

		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => ({
						result: {
							hash: "5JfinalizeWithdrawalHash",
							url: "https://minascan.io/devnet/tx/5JfinalizeWithdrawalHash"
						}
					}))
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko-m:testnet",
					destination: "mina:devnet",
					direction: "withdrawal",
					amount: "1",
					actionIndex: 0
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		await waitFor(actor, (snapshot) => snapshot.matches("BRIDGE_OPERATION_COMPLETED"))

		expect(actor.getSnapshot().context.completionVerification).toBe("unverified")

		await vi.advanceTimersByTimeAsync(2_000)
		expect(actor.getSnapshot().matches("BRIDGE_OPERATION_DONE")).toBe(true)

		actor.send({
			type: "VerifyCompletion",
			actionIndex: 0,
			transaction: {
				hash: "5JrecoveredWithdrawalHash",
				timestampMs: 1778178605000
			}
		})

		expect(actor.getSnapshot().context.completionVerification).toBe("verified")
		expect(actor.getSnapshot().context.transaction?.hash).toBe("5JrecoveredWithdrawalHash")

		actor.stop()
		bridge.stop()
		wallet.stop()
		vi.useRealTimers()
	})

	it("fails visibly after a deposit claim backend error instead of returning to claim", async () => {
		const claimError = new Error("Debug scenario: claim failed")
		const bridge = createBridgeActor()
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => {
						throw claimError
					})
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko-m:testnet",
					direction: "deposit",
					amount: "4",
					actionIndex: 0
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		await waitFor(actor, (snapshot) => snapshot.matches("FAILED"))

		expect(actor.getSnapshot().context.errors.at(-1)).toBe(claimError)
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "TerminateOperation")
		).toBe(false)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("keeps a deposit claim wallet rejection retryable", async () => {
		const walletRejection = new QuietError("User rejected the request")
		const bridge = createBridgeActor()
		const wallet = createWalletActor("zeko:testnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => {
						throw walletRejection
					})
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "mina:devnet",
					destination: "zeko-m:testnet",
					direction: "deposit",
					amount: "4",
					actionIndex: 0
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		const retryable = await waitFor(
			actor,
			(snapshot) =>
				snapshot.matches("TO_FINALIZE") && snapshot.context.errors.at(-1) === walletRejection
		)

		expect(retryable.context.errors.at(-1)).toBe(walletRejection)
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "TerminateOperation")
		).toBe(false)
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "CompleteOperation")
		).toBe(false)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("fails visibly after a withdrawal claim backend error instead of returning to claim", async () => {
		const claimError = new Error("Debug scenario: claim failed")
		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => {
						throw claimError
					})
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko-m:testnet",
					destination: "mina:devnet",
					direction: "withdrawal",
					amount: "4",
					actionIndex: 0
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		await waitFor(actor, (snapshot) => snapshot.matches("FAILED"))

		expect(actor.getSnapshot().context.errors.at(-1)).toBe(claimError)
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "TerminateOperation")
		).toBe(false)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})

	it("keeps a withdrawal claim wallet rejection retryable", async () => {
		const walletRejection = new QuietError("User rejected the request")
		const bridge = createBridgeActor()
		const wallet = createWalletActor("mina:devnet")
		bridge.start()
		wallet.start()

		const actor = createActor(
			bridgeOperationMachine.provide({
				actors: {
					transactionMachine: fromPromise(async () => {
						throw walletRejection
					})
				}
			}),
			{
				input: {
					bridge: bridge as never,
					wallet: wallet as never,
					source: "zeko-m:testnet",
					destination: "mina:devnet",
					direction: "withdrawal",
					amount: "4",
					actionIndex: 0
				}
			}
		)

		actor.start()
		actor.send({ type: "Resume", paused: false })
		actor.send({ type: "CanFinalize", index: 0 })
		actor.send({ type: "Finalize" })

		const retryable = await waitFor(
			actor,
			(snapshot) =>
				snapshot.matches("TO_FINALIZE") && snapshot.context.errors.at(-1) === walletRejection
		)

		expect(retryable.context.errors.at(-1)).toBe(walletRejection)
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "TerminateOperation")
		).toBe(false)
		expect(
			bridge.getSnapshot().context.events.some((event) => event.type === "CompleteOperation")
		).toBe(false)

		actor.stop()
		bridge.stop()
		wallet.stop()
	})
})
