import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { assign, createActor, fromPromise, setup, waitFor } from "xstate"
import { toUserFriendlyMessage } from "../../app/errors"
import { bridgeOperationMachine } from "../../machines/bridgeOperation"

const firstWithdrawalTooSmallMessage =
	"First Zeko->Mina withdrawal amount is too small: recipient B62test does not have an L1 helper account yet, so the first withdrawal must be at least 1 MINA to cover the Mina account creation fee. This withdrawal is 0.2 MINA and cannot proceed as submitted."

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
		const bridge = createActor(
			setup({
				types: {
					context: {} as {
						activeOperation: string | null
						events: Array<{ type: string; id?: string }>
						worker: object
					},
					events: {} as { type: string; id?: string }
				}
			}).createMachine({
				context: {
					activeOperation: null,
					events: [],
					worker: {}
				},
				on: {
					TerminateOperation: {
						actions: assign({
							events: ({ context, event }) => [...context.events, event]
						})
					}
				}
			})
		)
		const wallet = createActor(
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
					currentNetwork: "zeko:testnet",
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
})
