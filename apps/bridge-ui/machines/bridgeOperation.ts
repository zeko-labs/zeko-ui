import type { walletMachine } from "@zeko/sdk"
import { produce } from "immer"
import {
	type ActorRef,
	type ActorRefFromLogic,
	and,
	assign,
	type EventObject,
	enqueueActions,
	fromCallback,
	type Snapshot,
	sendTo,
	setup
} from "xstate"
import { finalizeNotification } from "../app/service-worker/notificationList"
import { isTerminalBridgeError } from "../app/errors"
import type { BridgeContext, BridgeEvents } from "./bridge"
import { createLogger } from "./debug"
import { sendMetric } from "./metrics"
import type { BridgeNetwork } from "./networks"
import {
	bridgeNetworkToWalletNetwork,
	isMinaBridgeNetwork,
	isZekoBridgeNetwork,
	walletNetworkToBridgeNetwork
} from "./networks"
import type { ActionState } from "./operations.worker"
import {
	DEFAULT_TRANSACTION_FEE_NANOMINA,
	type Result,
	transactionMachine,
	type TransactionMachineInput
} from "./transaction"

const { act, logger, measure } = createLogger("[BRIDGE OPERATION]", { metrics: true })

const bridgeParameters = ({
	id,
	bridge,
	wallet,
	user,
	l1,
	l2,
	source,
	destination,
	direction
}: BridgeOperationContext) => {
	return { id, bridge, wallet, user, l1, l2, source, destination, direction }
}

const workerParameters = ({ user, l1, l2 }: BridgeOperationContext) => {
	return { user, l1, l2 }
}

const addError =
	(error: Error) =>
	({
		context,
		event
	}: {
		context: BridgeOperationContext
		event: EventObject & { error?: unknown }
	}) => {
		const eventError =
			typeof event === "object" && event !== null && "error" in event ? event.error : undefined
		const e = eventError instanceof Error ? eventError : error
		logger.error(e)
		return { errors: [...context.errors, e] }
	}

const worker = (bridge: Bridge) => bridge.getSnapshot().context.worker

const addCompletedTransactionResult = ({
	context,
	key,
	result
}: {
	context: BridgeOperationContext
	key: TransactionKey
	result: Result
}) => {
	return produce(context, (draft) => {
		draft.transactions[key] = {
			transaction: result.hash,
			result
		}
	})
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
type TransactionKey = keyof BridgeOperationContext["transactions"]

type BridgeOperationEvents =
	| { type: "SetCurrentNetwork"; network: BridgeNetwork }
	| { type: "StartBridgeOperation" }
	| { type: "CompleteBridgeOperation" }
	| { type: "CompleteBridgeOperationCancelled" }
	| { type: "RecoverBridgeOperationCompleted" }
	| { type: "RecoverBridgeOperationCancelled" }
	| { type: "Resume"; paused: boolean }
	| { type: "Pause" }
	| { type: "ReturnTo" }
	| { type: "CanFinalize"; index?: number }
	| { type: "CanCancel" }
	| {
			type: "SyncRecoveredState"
			actionIndex: number
			transaction: ActionState["transaction"]
			progress?: ActionState["progress"]
			cancellable: boolean
			timeoutSlot?: string
	  }
	| { type: "TerminalError"; error: Error }
	| { type: "AlreadyFinalised"; index?: number }
	| { type: "Finalize" }
	| { type: "Cancel" }
	| {
			type: "VerifyCompletion"
			actionIndex: number
			transaction: ActionState["transaction"]
	  }
	| { type: "Destroy" }

export type BridgeOperationCompletionVerification = "unverified" | "verified"

export interface BridgeOperationContext {
	id: string
	bridge: Bridge
	wallet: Wallet
	user: string
	direction: Direction
	source: BridgeNetwork
	destination: BridgeNetwork
	l1: BridgeNetwork
	l2: BridgeNetwork
	amount: string
	timeoutSlots?: number
	timeoutSlot?: string
	actionIndex?: number
	progress?: ActionState["progress"]
	paused: boolean
	transaction?: ActionState["transaction"]
	completedAtMs?: number
	completionVerification: BridgeOperationCompletionVerification
	errors: Error[]
	transactions: {
		submitDeposit: WalletTransaction
		finalizeDeposit: WalletTransaction
		cancelDeposit: WalletTransaction
		submitWithdrawal: WalletTransaction
		finalizeWithdrawal: WalletTransaction
	}
	returnTo: ReturnTo
	changeNetworkTo: BridgeNetwork
	canCancel: boolean
}
const currentNetwork = (context: BridgeOperationContext) =>
	walletNetworkToBridgeNetwork(context.wallet.getSnapshot().context.currentNetwork)

const fetchMina = ({ network }: { network: BridgeNetwork }) =>
	({
		type: "FetchBalance",
		network: bridgeNetworkToWalletNetwork(network),
		tokens: [] as []
	}) as const

const POLL_INTERVAL = 20_000

const createPollScheduler = (callback: () => void) => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined

	return {
		schedule() {
			timeoutId = setTimeout(callback, POLL_INTERVAL)
		},
		clear() {
			if (timeoutId === undefined) return
			clearTimeout(timeoutId)
			timeoutId = undefined
		}
	}
}

type BridgeWorker = {
	bridge: Bridge
	id: string
	wallet: Wallet
	l1: BridgeNetwork
	l2: BridgeNetwork
	user: string
	source: BridgeNetwork
	destination: BridgeNetwork
	direction: Direction
}

const BRIDGE_FEE_NANOMINA = 1 * 10e8

const initialTransactionFeeNanomina = (key: TransactionKey) =>
	key === "submitDeposit" || key === "submitWithdrawal"
		? DEFAULT_TRANSACTION_FEE_NANOMINA
		: BRIDGE_FEE_NANOMINA

const createSdkSignature = (
	context: BridgeOperationContext,
	key: TransactionKey,
	feeNanomina: number
) => {
	const params = workerParameters(context)
	switch (key) {
		case "submitDeposit":
			return worker(context.bridge).submitDeposit({
				...params,
				amount: context.amount,
				timeoutSlots: context.timeoutSlots,
				feeNanomina
			})
		case "finalizeDeposit":
			return worker(context.bridge).finalizeDeposit({ ...params, feeNanomina })
		case "cancelDeposit":
			return worker(context.bridge).cancelDeposit({ ...params, feeNanomina })
		case "submitWithdrawal":
			return worker(context.bridge).submitWithdrawal({
				...params,
				amount: context.amount,
				feeNanomina
			})
		case "finalizeWithdrawal":
			return worker(context.bridge).finalizeWithdrawal({ ...params, feeNanomina })
	}
}

const transactionInput = (
	context: BridgeOperationContext,
	key: TransactionKey
): TransactionMachineInput => ({
	id: context.id,
	key,
	user: context.user,
	network: currentNetwork(context),
	initialFeeNanomina: initialTransactionFeeNanomina(key),
	createSdkSignature: ({ feeNanomina }) => createSdkSignature(context, key, feeNanomina),
	completeSdkSignature: ({ requestId, signedTransaction }) =>
		worker(context.bridge).completeSdkSignature({
			requestId,
			signedTransaction
		}),
	rejectSdkSignature: ({ requestId, message }) =>
		worker(context.bridge).rejectSdkSignature({ requestId, message })
})

//TODO: Error handling
export const bridgeOperationMachine = setup({
	types: {
		context: {} as BridgeOperationContext,
		input: {} as {
			bridge: Bridge
			wallet: Wallet
			direction: Direction
			source: BridgeNetwork
			destination: BridgeNetwork
			amount: string
			timeoutSlots?: number
			timeoutSlot?: string
			actionIndex?: number
			progress?: ActionState["progress"]
			transaction?: ActionState["transaction"]
			cancellable?: boolean
			completionVerification?: BridgeOperationCompletionVerification
		},
		events: {} as BridgeOperationEvents,
		tags: {} as "loading" | "cta",
		meta: {} as { step: number }
	},
	actors: {
		transactionMachine,
		pendingDeposit: fromCallback<EventObject, BridgeWorker & { depositTimestamp?: Date }>(
			({ sendBack, input }) => {
				const label = "pendingDeposit"
				const stop = measure(label)
				logger.start(label)
				const { bridge, l1, l2, user } = input
				const controller = new AbortController()
				const scheduler = createPollScheduler(() => {
					void checkDepositStatus(controller.signal)
				})
				const checkDepositStatus = async (signal: AbortSignal): Promise<void> => {
					if (signal.aborted) return
					try {
						const finalizeResult = await worker(bridge).canFinalizeDeposit({ l1, l2, user })
						logger.info(`Deposit status: ${JSON.stringify({ finalizeResult })}`)
						if (finalizeResult.available) {
							sendBack({ type: "CanFinalize", index: finalizeResult.index })
							if (!signal.aborted) scheduler.schedule()
						} else if (!signal.aborted) scheduler.schedule()
					} catch (error) {
						logger.error(error instanceof Error ? error : new Error(String(error)))
						if (!signal.aborted) scheduler.schedule()
					}
				}
				void checkDepositStatus(controller.signal)
				return () => {
					controller.abort()
					scheduler.clear()
					logger.success(label)
					stop()
				}
			}
		),
		pendingWithdrawal: fromCallback<EventObject, BridgeWorker>(({ sendBack, input }) => {
			const label = "pendingWithdrawal"
			const stop = measure(label)
			logger.start(label)
			const { bridge, user, l1, l2 } = input
			const controller = new AbortController()
			const scheduler = createPollScheduler(() => {
				void checkWithdrawalStatus(controller.signal)
			})
			const checkWithdrawalStatus = async (signal: AbortSignal): Promise<void> => {
				if (signal.aborted) return
				try {
					logger.info("Checking withdrawal status...")
					const result = await worker(bridge).canFinalizeWithdrawal({ l1, l2, user })
					if (result.available) {
						sendBack({ type: "CanFinalize", index: result.index })
						if (!signal.aborted) scheduler.schedule()
					} else if (result.status === "alreadyFinalised") {
						sendBack({ type: "AlreadyFinalised", index: result.index })
						if (!signal.aborted) scheduler.schedule()
					} else if (!signal.aborted) scheduler.schedule()
				} catch (error) {
					logger.error(error instanceof Error ? error : new Error(String(error)))
					if (isTerminalBridgeError(error)) {
						sendBack({
							type: "TerminalError",
							error: error instanceof Error ? error : new Error(String(error))
						})
						return
					}
					if (!signal.aborted) scheduler.schedule()
				}
			}
			void checkWithdrawalStatus(controller.signal)
			return () => {
				controller.abort()
				scheduler.clear()
				logger.success(label)
				stop()
			}
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
		cancellationReady: ({ context }) => context.canCancel === true,
		cancellationSlotAvailable: ({ context }) => {
			const activeCancellationOperation =
				context.bridge.getSnapshot().context.activeCancellationOperation
			return activeCancellationOperation === null || activeCancellationOperation === context.id
		},
		anotherOperationIsActive: ({ context }) => {
			const ao = context.bridge.getSnapshot().context.activeOperation
			return ao !== null && context.id !== ao
		},
		matchesActionIndex: ({ context, event }) => {
			return (
				"index" in event && context.actionIndex !== undefined && event.index === context.actionIndex
			)
		}
	},
	delays: {
		exitTimeout: () => 2_000
	}
}).createMachine({
	id: "bridgeOperation",
	initial: "IDLE",
	context: ({
		input: {
			direction,
			source,
			destination,
			amount,
			timeoutSlots,
			timeoutSlot,
			actionIndex,
			progress,
			bridge,
			wallet,
			transaction,
			cancellable,
			completionVerification
		},
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
		timeoutSlot,
		actionIndex,
		progress,
		returnTo: false,
		paused: false,
		transaction,
		completedAtMs: undefined,
		completionVerification: completionVerification ?? "unverified",
		errors: [],
		transactions: {
			submitDeposit: null,
			finalizeDeposit: null,
			cancelDeposit: null,
			submitWithdrawal: null,
			finalizeWithdrawal: null
		},
		canCancel: cancellable ?? false,
		l1: isMinaBridgeNetwork(source) ? source : destination,
		l2: isZekoBridgeNetwork(source) ? source : destination
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
							({ context }) => ({
								type: "RequestNetworkChange",
								network: bridgeNetworkToWalletNetwork(context.changeNetworkTo)
							})
						)
					}
				}
			})
		},
		SyncRecoveredState: {
			actions: assign(({ event }) => ({
				actionIndex: event.actionIndex,
				transaction: event.transaction,
				progress: event.progress,
				canCancel: event.cancellable,
				timeoutSlot: event.timeoutSlot
			}))
		},
		VerifyCompletion: {
			actions: assign(({ event }) => ({
				actionIndex: event.actionIndex,
				transaction: event.transaction,
				progress: undefined,
				completionVerification: "verified"
			}))
		},
		CompleteBridgeOperation: {
			target: ".BRIDGE_OPERATION_COMPLETED",
			actions: assign({ completionVerification: "verified", progress: undefined })
		},
		CompleteBridgeOperationCancelled: {
			target: ".BRIDGE_OPERATION_CANCELLED_DONE",
			actions: assign({ completionVerification: "verified", progress: undefined })
		},
		RecoverBridgeOperationCompleted: {
			target: ".BRIDGE_OPERATION_DONE_NOOP",
			actions: assign({ completionVerification: "verified", progress: undefined })
		},
		RecoverBridgeOperationCancelled: {
			target: ".BRIDGE_OPERATION_CANCELLED_DONE_NOOP",
			actions: assign({ completionVerification: "verified", progress: undefined })
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
				CompleteBridgeOperation: {
					target: "BRIDGE_OPERATION_DONE_NOOP",
					actions: assign({ completionVerification: "verified", progress: undefined })
				},
				CompleteBridgeOperationCancelled: {
					target: "BRIDGE_OPERATION_CANCELLED_DONE",
					actions: assign({ completionVerification: "verified", progress: undefined })
				},
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
				Resume: { target: "RESUMING", actions: assign({ paused: ({ event }) => event.paused }) },
				Cancel: [
					{
						target: "CANCEL_DEPOSIT",
						guard: and([
							"cancellationReady",
							"currentNetworkIsSource",
							"cancellationSlotAvailable"
						]),
						actions: sendTo(
							({ context }) => context.bridge,
							({ self }) => ({ type: "ActivateCancellationOperation", id: self.id })
						)
					},
					{
						target: "WAITING_FOR_NETWORK",
						guard: and(["cancellationReady", "cancellationSlotAvailable"]),
						actions: [
							sendTo(
								({ context }) => context.bridge,
								({ self }) => ({ type: "ActivateCancellationOperation", id: self.id })
							),
							assign({
								returnTo: "CANCEL_DEPOSIT",
								changeNetworkTo: ({ context }) => context.source
							})
						]
					}
				]
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
				Pause: {
					target: "PAUSED",
					actions: assign({ paused: true })
				},
				SyncRecoveredState: [
					{
						actions: assign(({ event }) => ({
							actionIndex: event.actionIndex,
							transaction: event.transaction,
							progress: event.progress,
							canCancel: event.cancellable,
							timeoutSlot: event.timeoutSlot
						}))
					}
				],
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
				({ context }) => ({
					type: "RequestNetworkChange",
					network: bridgeNetworkToWalletNetwork(context.changeNetworkTo)
				})
			),
			on: {
				Pause: {
					target: "PAUSED",
					actions: assign({ paused: true })
				},
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
						id: "transaction",
						src: "transactionMachine",
						input: ({ context }) => transactionInput(context, "submitDeposit"),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) => ({
								...addCompletedTransactionResult({
									context,
									key: "submitDeposit",
									result: event.output.result
								}),
								transaction: {
									hash: event.output.result.hash,
									timestampMs: Date.now()
								}
							}))
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
				Pause: {
					target: "PAUSED",
					actions: assign({ paused: true })
				},
				CanFinalize: {
					target: "TO_FINALIZE",
					guard: "matchesActionIndex",
					actions: assign({ progress: undefined })
				},
				SyncRecoveredState: {
					actions: assign(({ event }) => ({
						actionIndex: event.actionIndex,
						transaction: event.transaction,
						progress: event.progress,
						canCancel: event.cancellable,
						timeoutSlot: event.timeoutSlot
					}))
				}
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
				Pause: {
					target: "PAUSED",
					actions: assign({ paused: true })
				},
				SyncRecoveredState: {
					actions: assign(({ event }) => ({
						actionIndex: event.actionIndex,
						transaction: event.transaction,
						progress: event.progress,
						canCancel: event.cancellable,
						timeoutSlot: event.timeoutSlot
					}))
				},
				Cancel: [
					{
						target: "CANCEL_DEPOSIT",
						guard: and(["currentNetworkIsSource", "cancellationSlotAvailable"]),
						actions: sendTo(
							({ context }) => context.bridge,
							({ self }) => ({ type: "ActivateCancellationOperation", id: self.id })
						)
					},
					{
						target: "WAITING_FOR_NETWORK",
						guard: "cancellationSlotAvailable",
						actions: [
							sendTo(
								({ context }) => context.bridge,
								({ self }) => ({ type: "ActivateCancellationOperation", id: self.id })
							),
							assign({
								returnTo: "CANCEL_DEPOSIT",
								changeNetworkTo: ({ context }) => context.source
							})
						]
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
						id: "transaction",
						src: "transactionMachine",
						input: ({ context }) => transactionInput(context, "finalizeDeposit"),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addCompletedTransactionResult({
									context,
									key: "finalizeDeposit",
									result: event.output.result
								})
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
						id: "transaction",
						src: "transactionMachine",
						input: ({ context }) => transactionInput(context, "cancelDeposit"),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addCompletedTransactionResult({
									context,
									key: "cancelDeposit",
									result: event.output.result
								})
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
						id: "transaction",
						src: "transactionMachine",
						input: ({ context }) => transactionInput(context, "submitWithdrawal"),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) => ({
								...addCompletedTransactionResult({
									context,
									key: "submitWithdrawal",
									result: event.output.result
								}),
								transaction: {
									hash: event.output.result.hash,
									timestampMs: Date.now()
								}
							}))
						},
						onError: {
							target: "#bridgeOperation.FAILED",
							actions: [
								assign(addError(new Error("Failed to submit withdrawal"))),
								sendTo(
									({ context }) => context.bridge,
									({ self }) => ({ type: "TerminateOperation", id: self.id })
								)
							]
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
				Pause: {
					target: "PAUSED",
					actions: assign({ paused: true })
				},
				CanFinalize: {
					target: "TO_FINALIZE",
					guard: "matchesActionIndex",
					actions: assign({ progress: undefined })
				},
				AlreadyFinalised: {
					target: "BRIDGE_OPERATION_COMPLETED",
					guard: "matchesActionIndex",
					actions: assign({ progress: undefined })
				},
				TerminalError: {
					target: "FAILED",
					actions: [
						assign(addError(new Error("Failed to determine withdrawal status"))),
						sendTo(
							({ context }) => context.bridge,
							({ self }) => ({ type: "TerminateOperation", id: self.id })
						)
					]
				}
			}
		},
		FINALIZE_WITHDRAWAL: {
			initial: "transaction",
			states: {
				transaction: {
					tags: ["loading"],
					meta: { step: 2 },
					invoke: {
						id: "transaction",
						src: "transactionMachine",
						input: ({ context }) => transactionInput(context, "finalizeWithdrawal"),
						onDone: {
							target: "done",
							actions: assign(({ context, event }) =>
								addCompletedTransactionResult({
									context,
									key: "finalizeWithdrawal",
									result: event.output.result
								})
							)
						},
						onError: [
							{
								target: "#bridgeOperation.FAILED",
								guard: ({ event }) => isTerminalBridgeError(event.error),
								actions: [
									assign(addError(new Error("Failed to finalize withdrawal"))),
									sendTo(
										({ context }) => context.bridge,
										({ self }) => ({ type: "TerminateOperation", id: self.id })
									)
								]
							},
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
			entry: [
				assign({
					completedAtMs: ({ context }) => context.completedAtMs ?? Date.now(),
					progress: undefined
				}),
				({ context }) => {
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
				sendTo(
					({ context }) => context.bridge,
					({ context }) => ({ type: "CompleteOperation", id: context.id })
				)
			],
			after: { exitTimeout: "BRIDGE_OPERATION_DONE" }
		},
		BRIDGE_OPERATION_DONE: {
			meta: { step: 4 }
		},
		BRIDGE_OPERATION_CANCELLED_DONE: {
			meta: { step: 1 },
			entry: sendTo(
				({ context }) => context.bridge,
				({ context }) => ({ type: "CompleteOperation", id: context.id })
			)
		},
		BRIDGE_OPERATION_CANCELLED_DONE_NOOP: {
			meta: { step: 1 }
		},
		BRIDGE_OPERATION_DONE_NOOP: {
			meta: { step: 4 }
		},
		FAILED: {
			type: "final",
			entry: [
				sendTo(
					({ context }) => context.bridge,
					({ self }) => ({ type: "ReleaseCancellationOperation", id: self.id })
				),
				({ context }) => {
					const lastError = context.errors.at(-1)
					sendMetric(
						{
							category: "bridge_operation",
							action: "failed",
							source: context.source,
							destination: context.destination,
							success: false,
							label: (lastError?.message ?? "unknown error").slice(0, 500)
						},
						context.user
					)
				}
			]
		}
	}
})
