import type { Networks, walletMachine } from "@lumina-dex/sdk"
import { produce } from "immer"
import {
	type ActionArgs,
	type ActorRef,
	type ActorRefFromLogic,
	and,
	assign,
	type ErrorActorEvent,
	type EventObject,
	enqueueActions,
	fromCallback,
	fromPromise,
	type Snapshot,
	sendTo,
	setup
} from "xstate"
import { finalizeNotification } from "../app/service-worker/notificationList"
import type { BridgeContext, BridgeEvents } from "./bridge"
import { createLogger } from "./debug"
import { sendMetric } from "./metrics"
import type { ActionState } from "./operations.worker"
import { type Result, transactionMachine } from "./transaction"

const { act, logger, measure } = createLogger("[BRIDGE OPERATION]", { metrics: true })

const bridgeParameters = ({ bridge, user, l1, l2 }: BridgeOperationContext) => {
	return { bridge, user, l1, l2 }
}

const addError =
	(error: Error) =>
	({
		context,
		event
	}: ActionArgs<BridgeOperationContext, ErrorActorEvent, BridgeOperationEvents>) => {
		const e = event.error instanceof Error ? event.error : error
		logger.error(e)
		return { errors: [...context.errors, e] }
	}

const addToContext = ({
	context,
	key,
	transaction,
	result
}: {
	context: BridgeOperationContext
	key: keyof BridgeOperationContext["transactions"]
	transaction?: string
	result?: Result
}) =>
	produce(context, (draft) => {
		if (transaction) draft.transactions[key] = { transaction, result: null }
		if (result && draft.transactions[key]) {
			draft.transactions[key].result = result
		}
	})

const worker = (bridge: Bridge) => bridge.getSnapshot().context.worker

const sendAndConfirm = (
	context: BridgeOperationContext,
	key: keyof BridgeOperationContext["transactions"]
) => {
	if (!context.transactions[key]) throw new Error(`No ${key} transaction found`)
	return {
		id: context.id,
		transaction: context.transactions[key].transaction,
		wallet: context.wallet,
		worker: worker(context.bridge)
	}
}

//To avoid circular dependencies
type Bridge = ActorRef<Snapshot<unknown> & { context: BridgeContext }, BridgeEvents>
type Wallet = ActorRefFromLogic<typeof walletMachine>

export type ReturnTo =
	| false
	| "INIT_BRIDGE_OPERATION"
	| "FINALIZE_DEPOSIT"
	| "FINALIZE_WITHDRAWAL"
	| "TO_FINALIZE"
	| "CANCEL_DEPOSIT"

type Direction = "deposit" | "withdrawal"

type WalletTransaction = { transaction: string; result: Result | null } | null

type BridgeOperationEvents =
	| { type: "SetCurrentNetwork"; network: Networks }
	| { type: "StartBridgeOperation" }
	| { type: "CompleteBridgeOperation" }
	| { type: "CompleteBridgeOperationCancelled" }
	| { type: "Resume"; paused: boolean }
	| { type: "Pause" }
	| { type: "ReturnTo" }
	| { type: "CanFinalize" }
	| { type: "CanCancel" }
	| { type: "Finalize" }
	| { type: "Cancel" }
	| { type: "Destroy" }

export interface BridgeOperationContext {
	id: string
	bridge: Bridge
	wallet: Wallet
	user: string
	direction: Direction
	source: Networks
	destination: Networks
	l1: Networks
	l2: Networks
	amount: string
	timeoutSlots?: number
	paused: boolean
	transaction?: ActionState["transaction"]
	errors: Error[]
	transactions: {
		submitDeposit: WalletTransaction
		finalizeDeposit: WalletTransaction
		cancelDeposit: WalletTransaction
		submitWithdrawal: WalletTransaction
		finalizeWithdrawal: WalletTransaction
	}
	returnTo: ReturnTo
	changeNetworkTo: Networks
	canCancel: boolean
}
const currentNetwork = (context: BridgeOperationContext) =>
	context.wallet.getSnapshot().context.currentNetwork

const fetchMina = ({ network }: { network: Networks }) =>
	({
		type: "FetchBalance",
		network,
		tokens: [] as []
	}) as const

const POLL_INTERVAL = 20_000

type BridgeWorker = { bridge: Bridge; l1: Networks; l2: Networks; user: string }

//TODO: Error handling
export const bridgeOperationMachine = setup({
	types: {
		context: {} as BridgeOperationContext,
		input: {} as {
			bridge: Bridge
			wallet: Wallet
			direction: Direction
			source: Networks
			destination: Networks
			amount: string
			timeoutSlots?: number
			transaction?: ActionState["transaction"]
		},
		events: {} as BridgeOperationEvents,
		tags: {} as "loading" | "cta",
		meta: {} as { step: number }
	},
	actors: {
		transactionMachine,
		submitDeposit: fromPromise<string, BridgeWorker & { amount: string; timeoutSlots?: number }>(
			({ input }) => {
				return act(
					"submitDeposit",
					async () => {
						const { bridge, l1, l2, amount, user, timeoutSlots } = input
						const tx = await worker(bridge).submitDeposit({ l1, l2, user, amount, timeoutSlots })
						return tx
					},
					input.user
				)
			}
		),
		pendingDeposit: fromCallback<EventObject, BridgeWorker & { depositTimestamp?: Date }>(
			({ sendBack, input }) => {
				const label = "pendingDeposit"
				const stop = measure(label)
				logger.start(label)
				const { bridge, l1, l2, user } = input
				const controller = new AbortController()
				const checkDepositStatus = async (signal: AbortSignal): Promise<void> => {
					if (signal.aborted) return
					try {
						const [canFinalize, canCancel] = await Promise.all([
							worker(bridge).canFinalizeDeposit({ l1, l2, user }),
							worker(bridge).canCancelDeposit({ l1, l2, user })
						])
						logger.info(`Deposit status: ${JSON.stringify({ canFinalize, canCancel })}`)
						if (canFinalize) sendBack({ type: "CanFinalize" })
						else if (canCancel) sendBack({ type: "CanCancel" })
						else if (!signal.aborted) setTimeout(() => checkDepositStatus(signal), POLL_INTERVAL)
					} catch (error) {
						logger.error(error instanceof Error ? error : new Error(String(error)))
						if (!signal.aborted) setTimeout(() => checkDepositStatus(signal), POLL_INTERVAL)
					}
				}
				checkDepositStatus(controller.signal)
				return () => {
					controller.abort()
					logger.success(label)
					stop()
				}
			}
		),
		finalizeDeposit: fromPromise<string, BridgeWorker>(({ input }) => {
			return act(
				"finalizeDeposit",
				async () => {
					const { bridge, l1, l2, user } = input
					const tx = await worker(bridge).finalizeDeposit({ l1, l2, user })
					return tx
				},
				input.user
			)
		}),
		submitWithdrawal: fromPromise<string, BridgeWorker & { amount: string }>(({ input }) => {
			return act(
				"submitWithdrawal",
				async () => {
					const { bridge, l1, l2, amount, user } = input
					const tx = await worker(bridge).submitWithdrawal({ l1, l2, user, amount })
					return tx
				},
				input.user
			)
		}),
		pendingWithdrawal: fromCallback<EventObject, BridgeWorker>(({ sendBack, input }) => {
			const label = "pendingWithdrawal"
			const stop = measure(label)
			logger.start(label)
			const { bridge, user, l1, l2 } = input
			const controller = new AbortController()
			const checkWithdrawalStatus = async (signal: AbortSignal): Promise<void> => {
				if (signal.aborted) return
				try {
					logger.info("Checking withdrawal status...")
					const can = await worker(bridge).canFinalizeWithdrawal({ l1, l2, user })
					if (can) sendBack({ type: "CanFinalize" })
					else if (!signal.aborted) setTimeout(() => checkWithdrawalStatus(signal), POLL_INTERVAL)
				} catch (error) {
					logger.error(error instanceof Error ? error : new Error(String(error)))
					if (!signal.aborted) setTimeout(() => checkWithdrawalStatus(signal), POLL_INTERVAL)
				}
			}
			checkWithdrawalStatus(controller.signal)
			return () => {
				controller.abort()
				logger.success(label)
				stop()
			}
		}),
		finalizeWithdrawal: fromPromise<string, BridgeWorker>(({ input }) => {
			return act(
				"finalizeWithdrawal",
				async () => {
					const { bridge, l1, l2, user } = input
					const tx = await worker(bridge).finalizeWithdrawal({ l1, l2, user })
					return tx
				},
				input.user
			)
		}),
		cancelDeposit: fromPromise<string, BridgeWorker>(({ input }) => {
			return act(
				"cancelDeposit",
				async () => {
					const { bridge, l1, l2, user } = input
					const tx = await worker(bridge).cancelDeposit({ l1, l2, user })
					return tx
				},
				input.user
			)
		})
	},
	guards: {
		currentNetworkIsSource: ({ context }) => currentNetwork(context) === context.source,
		currentNetworkIsDestination: ({ context }) => currentNetwork(context) === context.destination,
		deposit: ({ context }) => context.direction === "deposit",
		withdrawal: ({ context }) => context.direction === "withdrawal",
		toInitBridgeOperation: ({ context: { returnTo } }) => returnTo === "INIT_BRIDGE_OPERATION",
		toFinalizeDeposit: ({ context: { returnTo } }) => returnTo === "FINALIZE_DEPOSIT",
		toFinalizeWithdrawal: ({ context: { returnTo } }) => returnTo === "FINALIZE_WITHDRAWAL",
		toFinalize: ({ context: { returnTo } }) => returnTo === "TO_FINALIZE",
		toCancelDeposit: ({ context: { returnTo } }) => returnTo === "CANCEL_DEPOSIT",
		anotherOperationIsActive: ({ context }) => {
			const ao = context.bridge.getSnapshot().context.activeOperation
			return ao !== null && context.id !== ao
		}
	},
	delays: {
		exitTimeout: () => 2_000
	}
}).createMachine({
	id: "bridgeOperation",
	initial: "IDLE",
	context: ({
		input: { direction, source, destination, amount, timeoutSlots, bridge, wallet, transaction },
		self: { id }
	}) => ({
		id,
		wallet,
		bridge,
		user: wallet.getSnapshot().context.account,
		direction,
		changeNetworkTo: source,
		source,
		destination,
		amount,
		timeoutSlots,
		returnTo: false,
		paused: false,
		transaction,
		errors: [],
		transactions: {
			submitDeposit: null,
			finalizeDeposit: null,
			cancelDeposit: null,
			submitWithdrawal: null,
			finalizeWithdrawal: null
		},
		canCancel: false,
		l1: source.includes("mina") ? source : destination,
		l2: source.includes("zeko") ? source : destination
	}),
	on: {
		Destroy: {
			description: "When the operation is destroyed, we immediately exit all states.",
			target: ".BRIDGE_OPERATION_DONE_NOOP"
		},
		SetCurrentNetwork: {
			description:
				"When the parent change the network, we receive the event and raise a return to an action if we can.",
			actions: enqueueActions(({ context, enqueue, event }) => {
				if (context.returnTo !== false) {
					if (context.changeNetworkTo === event.network) enqueue.raise({ type: "ReturnTo" })
					else {
						//If we are still on the wrong network, we need to request a change
						enqueue.sendTo(
							({ context }) => context.wallet,
							({ context }) => ({ type: "RequestNetworkChange", network: context.changeNetworkTo })
						)
					}
				}
			})
		}
	},
	states: {
		IDLE: {
			on: {
				Resume: {
					target: "RESUMING",
					actions: assign({ paused: ({ event }) => event.paused })
				},
				Pause: {
					target: "PAUSED",
					actions: assign({ paused: true })
				},
				CompleteBridgeOperation: { target: "BRIDGE_OPERATION_DONE_NOOP" },
				CompleteBridgeOperationCancelled: { target: "BRIDGE_OPERATION_CANCELLED_DONE" },
				StartBridgeOperation: [
					{
						target: "INIT_BRIDGE_OPERATION",
						guard: "currentNetworkIsSource",
						actions: ({ context }) => {
							const amount = Number(context.amount)
							sendMetric(
								{
									category: "bridge_operation",
									action: "started",
									amount: Number.isNaN(amount) ? 0 : amount,
									source: context.source,
									destination: context.destination,
									label: context.direction
								},
								context.user
							)
						}
					},
					{
						target: "WAITING_FOR_NETWORK",
						guard: "currentNetworkIsDestination",
						actions: assign({
							returnTo: "INIT_BRIDGE_OPERATION",
							changeNetworkTo: ({ context }) => context.source
						})
					}
				]
			}
		},
		PAUSED: {
			on: {
				Resume: { target: "RESUMING", actions: assign({ paused: ({ event }) => event.paused }) }
			}
		},
		RESUMING: {
			description: "This state always immediately transitions.",
			always: [
				{ target: "PAUSED", guard: ({ context }) => context.paused === true },
				{ target: "PENDING_WITHDRAWAL", guard: "withdrawal" },
				{ target: "PENDING_DEPOSIT", guard: "deposit" }
			]
		},
		TO_FINALIZE: {
			tags: ["cta"],
			meta: { step: 2 },
			description: "This state needs an event to transition.",
			always: [
				{ target: "PAUSED", guard: ({ context }) => context.paused === true },
				{ actions: ({ context }) => finalizeNotification(context) }
			],
			on: {
				Finalize: [
					{
						target: "FINALIZE_WITHDRAWAL",
						guard: and(["withdrawal", "currentNetworkIsDestination"])
					},
					{
						target: "FINALIZE_DEPOSIT",
						guard: and(["deposit", "currentNetworkIsDestination"])
					},
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign(({ context }) => ({
							returnTo:
								context.direction === "deposit" ? "FINALIZE_DEPOSIT" : "FINALIZE_WITHDRAWAL",
							changeNetworkTo: context.destination
						}))
					}
				]
			}
		},
		WAITING_FOR_NETWORK: {
			description:
				"When the network is incorrect, we request a network change and return to the previous action.",
			entry: sendTo(
				({ context }) => context.wallet,
				({ context }) => ({ type: "RequestNetworkChange", network: context.changeNetworkTo })
			),
			on: {
				ReturnTo: [
					{
						target: "INIT_BRIDGE_OPERATION",
						guard: "toInitBridgeOperation",
						actions: assign({ returnTo: false })
					},
					{
						target: "FINALIZE_DEPOSIT",
						guard: "toFinalizeDeposit",
						actions: assign({ returnTo: false })
					},
					{
						target: "FINALIZE_WITHDRAWAL",
						guard: "toFinalizeWithdrawal",
						actions: assign({ returnTo: false })
					},
					{
						target: "TO_FINALIZE",
						guard: "toFinalize",
						actions: assign({ returnTo: false })
					},
					{
						target: "CANCEL_DEPOSIT",
						guard: "toCancelDeposit",
						actions: assign({ returnTo: false })
					}
				]
			}
		},
		INIT_BRIDGE_OPERATION: {
			always: [
				{ target: "SUBMIT_DEPOSIT", guard: "deposit" },
				{ target: "SUBMIT_WITHDRAWAL", guard: "withdrawal" }
			]
		},
		SUBMIT_DEPOSIT: {
			initial: "transaction",
			states: {
				transaction: {
					tags: ["loading"],
					meta: { step: 0 },
					invoke: {
						src: "submitDeposit",
						input: ({ context }) => ({
							...bridgeParameters(context),
							amount: context.amount,
							timeoutSlots: context.timeoutSlots
						}),
						onDone: {
							target: "send_and_confirm",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "submitDeposit", transaction: event.output })
							)
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							actions: sendTo(
								({ context }) => context.bridge,
								({ self }) => ({ type: "TerminateOperation", id: self.id })
							)
						}
					}
				},
				send_and_confirm: {
					tags: ["loading"],
					meta: { step: 0 },
					invoke: {
						src: "transactionMachine",
						input: ({ context }) => ({ ...sendAndConfirm(context, "submitDeposit") }),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "submitDeposit", result: event.output.result })
							)
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							actions: sendTo(
								({ context }) => context.bridge,
								({ self }) => ({ type: "TerminateOperation", id: self.id })
							)
						}
					}
				},
				done: {
					type: "final",
					meta: { step: 1 },
					entry: sendTo(
						({ context }) => context.wallet,
						({ context }) => fetchMina({ network: context.source })
					)
				}
			},
			onDone: [
				{
					target: "PAUSED",
					guard: "anotherOperationIsActive",
					actions: [
						sendTo(
							({ context }) => context.bridge,
							({ self }) => ({ type: "PauseOperation", id: self.id })
						),
						assign({ paused: true })
					]
				},
				{ target: "PENDING_DEPOSIT" }
			]
		},
		PENDING_DEPOSIT: {
			tags: ["loading"],
			meta: { step: 1 },
			invoke: {
				src: "pendingDeposit",
				input: ({ context }) => ({ ...bridgeParameters(context), amount: context.amount })
			},
			on: {
				CanFinalize: { target: "TO_FINALIZE" },
				CanCancel: { target: "CAN_CANCEL", actions: assign({ canCancel: true }) }
			}
		},
		CAN_CANCEL: {
			tags: ["cta"],
			meta: { step: 1 },
			description:
				"The deposit can be cancelled because the timeout has passed and it was not finalized.",
			entry: ({ context }) => {
				sendMetric(
					{
						category: "bridge_operation",
						action: "canCancel",
						source: context.source,
						destination: context.destination
					},
					context.user
				)
			},
			on: {
				Cancel: [
					{
						target: "CANCEL_DEPOSIT",
						guard: "currentNetworkIsSource"
					},
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "CANCEL_DEPOSIT",
							changeNetworkTo: ({ context }) => context.source
						})
					}
				]
			}
		},
		FINALIZE_DEPOSIT: {
			initial: "transaction",
			states: {
				transaction: {
					tags: ["loading"],
					meta: { step: 2 },
					invoke: {
						src: "finalizeDeposit",
						input: ({ context }) => ({ ...bridgeParameters(context) }),
						onDone: {
							target: "send_and_confirm",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "finalizeDeposit", transaction: event.output })
							)
						},
						onError: [
							{
								target: "#bridgeOperation.FAILED",
								guard: ({ context }) => context.errors.length >= 3,
								actions: assign(addError(new Error("Failed to finalize deposit")))
							},
							{
								target: "#bridgeOperation.FINALIZE_DEPOSIT",
								actions: assign(addError(new Error("Failed to finalize deposit")))
							}
						]
					}
				},
				send_and_confirm: {
					tags: ["loading"],
					meta: { step: 3 },
					invoke: {
						src: "transactionMachine",
						input: ({ context }) => ({ ...sendAndConfirm(context, "finalizeDeposit") }),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "finalizeDeposit", result: event.output.result })
							)
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							// target: "send_and_confirm",
							// reenter: true,
							actions: assign(({ context, event }) => ({
								errors: [...context.errors, event.error as Error]
							}))
						}
					}
				},
				done: { type: "final" }
			},
			onDone: { target: "BRIDGE_OPERATION_COMPLETED" }
		},
		CANCEL_DEPOSIT: {
			initial: "transaction",
			states: {
				transaction: {
					tags: ["loading"],
					meta: { step: 1 },
					invoke: {
						src: "cancelDeposit",
						input: ({ context }) => ({ ...bridgeParameters(context) }),
						onDone: {
							target: "send_and_confirm",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "cancelDeposit", transaction: event.output })
							)
						},
						onError: [
							{
								target: "#bridgeOperation.FAILED",
								guard: ({ context }) => context.errors.length >= 3,
								actions: assign(addError(new Error("Failed to cancel deposit")))
							},
							{
								target: "#bridgeOperation.CANCEL_DEPOSIT",
								actions: assign(addError(new Error("Failed to cancel deposit")))
							}
						]
					}
				},
				send_and_confirm: {
					tags: ["loading"],
					meta: { step: 1 },
					invoke: {
						src: "transactionMachine",
						input: ({ context }) => ({ ...sendAndConfirm(context, "cancelDeposit") }),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "cancelDeposit", result: event.output.result })
							)
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							actions: assign(({ context, event }) => ({
								errors: [...context.errors, event.error as Error]
							}))
						}
					}
				},
				done: {
					type: "final",
					entry: sendTo(
						({ context }) => context.wallet,
						({ context }) => fetchMina({ network: context.source })
					)
				}
			},
			onDone: { target: "DEPOSIT_CANCELLED" }
		},
		DEPOSIT_CANCELLED: {
			meta: { step: 1 },
			after: { exitTimeout: "BRIDGE_OPERATION_CANCELLED_DONE" }
		},
		SUBMIT_WITHDRAWAL: {
			initial: "transaction",
			states: {
				transaction: {
					tags: ["loading"],
					meta: { step: 0 },
					invoke: {
						src: "submitWithdrawal",
						input: ({ context }) => ({ ...bridgeParameters(context), amount: context.amount }),
						onDone: {
							target: "send_and_confirm",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "submitWithdrawal", transaction: event.output })
							)
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							actions: sendTo(
								({ context }) => context.bridge,
								({ self }) => ({ type: "TerminateOperation", id: self.id })
							)
						}
					}
				},
				send_and_confirm: {
					tags: ["loading"],
					meta: { step: 1 },
					invoke: {
						src: "transactionMachine",
						input: ({ context }) => ({ ...sendAndConfirm(context, "submitWithdrawal") }),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "submitWithdrawal", result: event.output.result })
							)
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							actions: sendTo(
								({ context }) => context.bridge,
								({ self }) => ({ type: "TerminateOperation", id: self.id })
							)
						}
					}
				},
				done: {
					meta: { step: 1 },
					type: "final",
					entry: sendTo(
						({ context }) => context.wallet,
						({ context }) => fetchMina({ network: context.source })
					)
				}
			},
			onDone: [
				{
					target: "PAUSED",
					guard: "anotherOperationIsActive",
					actions: [
						sendTo(
							({ context }) => context.bridge,
							({ self }) => ({ type: "PauseOperation", id: self.id })
						),
						assign({ paused: true })
					]
				},
				{ target: "PENDING_WITHDRAWAL" }
			]
		},
		PENDING_WITHDRAWAL: {
			tags: ["loading"],
			meta: { step: 1 },
			invoke: {
				src: "pendingWithdrawal",
				input: ({ context }) => ({ ...bridgeParameters(context), amount: context.amount })
			},
			on: {
				CanFinalize: { target: "TO_FINALIZE" }
			}
		},
		FINALIZE_WITHDRAWAL: {
			initial: "transaction",
			states: {
				transaction: {
					tags: ["loading"],
					meta: { step: 2 },
					invoke: {
						src: "finalizeWithdrawal",
						input: ({ context }) => ({ ...bridgeParameters(context) }),
						onDone: {
							target: "send_and_confirm",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "finalizeWithdrawal", transaction: event.output })
							)
						},
						onError: [
							{
								target: "#bridgeOperation.FAILED",
								guard: ({ context }) => context.errors.length >= 3,
								actions: assign(addError(new Error("Failed to finalize withdrawal")))
							},
							{
								target: "#bridgeOperation.PENDING_WITHDRAWAL",
								actions: assign(addError(new Error("Failed to finalize withdrawal")))
							}
						]
					}
				},
				send_and_confirm: {
					tags: ["loading"],
					meta: { step: 3 },
					invoke: {
						src: "transactionMachine",
						input: ({ context }) => ({ ...sendAndConfirm(context, "finalizeWithdrawal") }),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addToContext({ context, key: "finalizeWithdrawal", result: event.output.result })
							)
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							actions: assign(({ context, event }) => ({
								errors: [...context.errors, event.error as Error]
							}))
						}
					}
				},
				done: {
					type: "final",
					meta: { step: 3 },
					entry: sendTo(
						({ context }) => context.wallet,
						({ context }) => fetchMina({ network: context.destination })
					)
				}
			},
			onDone: { target: "BRIDGE_OPERATION_COMPLETED" }
		},
		BRIDGE_OPERATION_COMPLETED: {
			meta: { step: 4 },
			entry: ({ context }) => {
				sendMetric(
					{
						category: "bridge_operation",
						action: "completed",
						source: context.source,
						destination: context.destination,
						label: context.direction
					},
					context.user
				)
			},
			after: { exitTimeout: "BRIDGE_OPERATION_DONE" }
		},
		BRIDGE_OPERATION_DONE: {
			meta: { step: 4 },
			type: "final",
			entry: sendTo(
				({ context }) => context.bridge,
				({ self }) => ({ type: "CompleteOperation", id: self.id })
			)
		},
		BRIDGE_OPERATION_CANCELLED_DONE: {
			meta: { step: 1 },
			type: "final",
			entry: sendTo(
				({ context }) => context.bridge,
				({ self }) => ({ type: "CompleteOperation", id: self.id })
			)
		},
		BRIDGE_OPERATION_DONE_NOOP: {
			meta: { step: 4 },
			type: "final"
		},
		FAILED: {
			type: "final",
			entry: ({ context }) => {
				const lastError = context.errors.at(-1)
				sendMetric(
					{
						category: "bridge_operation",
						action: "failed",
						source: context.source,
						destination: context.destination,
						success: false,
						label: lastError?.message ?? "unknown error"
					},
					context.user
				)
			}
		}
	}
})
