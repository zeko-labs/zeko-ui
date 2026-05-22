import type { walletMachine } from "@lumina-dex/sdk"
import { detectWalletChange, type Networks, type WalletEmit } from "@lumina-dex/sdk"
import * as Sentry from "@sentry/nuxt"
import * as Comlink from "comlink"
import { nanoid } from "nanoid"
import { type ActorRefFromLogic, and, assign, enqueueActions, fromPromise, setup } from "xstate"
import { bridgeOperationMachine } from "./bridgeOperation"
import { createLogger } from "./debug"
import type { ActionState, OperationsWorker, PendingOperations } from "./operations.worker"
import type { RecoveredOperations, RecoveryLane } from "./recovery"
import {
	buildRecoverySyncState,
	classifyRecoveredOperations,
	matchRecoveryOperationIds
} from "./recovery"
import workerUrl from "./operations.worker?worker&url"

const worker = new Worker(new URL(workerUrl, import.meta.url), { type: "module" })
if (import.meta.client) {
	Sentry.addIntegration(Sentry.webWorkerIntegration({ worker }))
}

const { act, logger } = createLogger("[BRIDGE]", { metrics: true })

type OperationStatus = "started" | "paused" | "completed"
type Operations = Map<
	string,
	{
		order: number
		status: OperationStatus
		lane: RecoveryLane
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}
>
type Wallet = ActorRefFromLogic<typeof walletMachine>
type OperationWorker = Comlink.Remote<OperationsWorker>
const REFRESH_INTERVAL = 20_000

type Command = "start" | "resumeDeposit" | "resumeWithdrawal" | "complete" | "completeCancelled"
type StartOperationSettings = {
	amount: string
	command: Command
	lane?: RecoveryLane
	timeoutSlots?: number
	state?: {
		id?: string
		status: OperationStatus
		source: Networks
		destination: Networks
		transaction: ActionState["transaction"]
		cancellable?: boolean
		timeoutSlot?: string
	}
}

type PendingOperationsInput = {
	wallet: Wallet
	worker: OperationWorker
	sourceNetwork: Networks
	destinationNetwork: Networks
}

export type BridgeEvents =
	| { type: "StartOperation"; amount: string; timeoutSlots?: number }
	| { type: "CompleteOperation"; id: string }
	| { type: "PauseOperation"; id: string }
	| { type: "TerminateOperation"; id: string }
	| { type: "ActivateCancellationOperation"; id: string }
	| { type: "ReleaseCancellationOperation"; id: string }
	| { type: "InvertDirection" }
	| { type: "SetSource"; sourceNetwork: Networks }
	| { type: "SetDestination"; destinationNetwork: Networks }

export interface BridgeContext {
	sourceNetwork: Networks
	destinationNetwork: Networks
	operations: Operations
	wallet: Wallet
	walletReady: boolean
	accountReady: boolean
	activeOperation: string | null
	activeCancellationOperation: string | null
	nextOperationOrder: number
	currentSlot?: string
	worker: OperationWorker
}

const _currentNetwork = (context: BridgeContext) =>
	context.wallet.getSnapshot().context.currentNetwork

const directionPriority = (operation: ActorRefFromLogic<typeof bridgeOperationMachine>) =>
	operation.getSnapshot().context.direction === "deposit" ? 0 : 1

const pausedMainQueueIds = (operations: Operations) =>
	[...operations.entries()]
		.filter(([, { lane, status }]) => lane === "main" && status === "paused")
		.sort(
			([, left], [, right]) =>
				directionPriority(left.operation) - directionPriority(right.operation) ||
				left.order - right.order
		)
		.map(([id]) => id)

const operationId = () => `bridgeOperation-${Date.now()}-${nanoid(8)}`
export const supportedNetworks = [
	"mina:devnet",
	"zeko:testnet",
	"mina:mainnet",
	"zeko:mainnet"
] as const

type StartArgs = {
	status: OperationStatus
	actionState: ActionState
	command: Command
}

type RecoveryEnqueue = (action: { type: "startOperation"; params: StartOperationSettings }) => void

const enqueueRecoveredOperations = ({
	enqueue,
	recovered
}: {
	enqueue: RecoveryEnqueue
	recovered: RecoveredOperations
}) => {
	const start = ({ status, actionState, command }: StartArgs) => {
		const { amount, source, destination, transaction, id, cancellable, timeoutSlot } = actionState
		enqueue({
			type: "startOperation",
			params: {
				amount,
				command,
				lane: command === "resumeDeposit" && cancellable === true ? "cancellation" : "main",
				state: {
					id,
					status,
					destination,
					source,
					transaction,
					cancellable,
					timeoutSlot
				}
			}
		})
	}

	const [currentMainOperation, ...queuedMainOperations] = recovered.mainPending

	if (currentMainOperation) {
		start({
			status: "started",
			actionState: currentMainOperation.actionState,
			command: currentMainOperation.command
		})
	}

	for (const pendingOperation of queuedMainOperations) {
		start({
			status: "paused",
			actionState: pendingOperation.actionState,
			command: pendingOperation.command
		})
	}

	for (const pendingOperation of recovered.cancellableDeposits) {
		start({
			status: "paused",
			actionState: pendingOperation.actionState,
			command: pendingOperation.command
		})
	}
}

const enqueueRecoveredOperation = ({
	enqueue,
	actionState,
	command,
	status
}: {
	enqueue: RecoveryEnqueue
	actionState: ActionState
	command: Command
	status: OperationStatus
}) => {
	enqueue({
		type: "startOperation",
		params: {
			amount: actionState.amount,
			command,
			state: {
				id: actionState.id,
				status,
				source: actionState.source,
				destination: actionState.destination,
				transaction: actionState.transaction,
				cancellable: actionState.cancellable,
				timeoutSlot: actionState.timeoutSlot
			}
		}
	})
}

const syncRecoveredOperations = ({
	context,
	recovered
}: {
	context: BridgeContext
	recovered: RecoveredOperations
}) => {
	const operations = new Map(context.operations)
	const recoveryOperationIds = matchRecoveryOperationIds({
		actionStates: [...recovered.mainPending, ...recovered.cancellableDeposits].map(
			({ actionState }) => actionState
		),
		candidates: [...operations.entries()].map(([id, { status, operation }]) => ({
			id,
			status,
			transactionHash: operation.getSnapshot().context.transaction?.hash
		}))
	})
	const syncState = buildRecoverySyncState({
		recovered,
		entryStateById: new Map(
			[...recoveryOperationIds.entries()].flatMap(([recoveredId, operationId]) => {
				const operation = operations.get(operationId)
				return operation
					? ([[recoveredId, { status: operation.status, lane: operation.lane }]] as const)
					: []
			})
		)
	})

	for (const { id, lane, order, status, cancellable, timeoutSlot } of syncState.pendingOperations) {
		const operationId = recoveryOperationIds.get(id)
		if (!operationId) continue
		const entry = operations.get(operationId)
		if (!entry || entry.status === "completed") continue
		entry.operation.send({ type: "SyncRecoveredState", cancellable, timeoutSlot })
		if (entry.status !== status) {
			if (status === "started") entry.operation.send({ type: "Resume", paused: false })
			if (entry.status === "started" && status === "paused") entry.operation.send({ type: "Pause" })
		}
		operations.set(operationId, {
			...entry,
			status,
			lane,
			order
		})
	}

	return {
		operations,
		activeOperation: (() => {
			if (!syncState.activeOperation) return null
			return recoveryOperationIds.get(syncState.activeOperation) ?? null
		})(),
		activeCancellationOperation: (() => {
			if (!syncState.activeCancellationOperation) return null
			return recoveryOperationIds.get(syncState.activeCancellationOperation) ?? null
		})()
	}
}

const bridgeDirections = {
	"zeko:mainnet": "mina:mainnet",
	"mina:mainnet": "zeko:mainnet",
	"zeko:testnet": "mina:devnet",
	"mina:devnet": "zeko:testnet"
} as const

// Parent Bridge Machine
export const bridgeMachine = setup({
	types: {
		context: {} as BridgeContext,
		input: {} as { wallet: Wallet },
		events: {} as BridgeEvents | WalletEmit
	},
	guards: {
		validSource: ({ context }) => supportedNetworks.includes(context.sourceNetwork),
		validDestination: ({ context }) => supportedNetworks.includes(context.destinationNetwork),
		shouldRefreshPendingOperations: ({ context }) =>
			[...context.operations.values()].some(({ status }) => status !== "completed")
	},
	actors: {
		bridgeOperationMachine,
		detectWalletChange,
		findPendingOperations: fromPromise<PendingOperations, PendingOperationsInput>(({ input }) => {
			const { wallet, worker, sourceNetwork, destinationNetwork } = input
			const account = wallet.getSnapshot().context.account
			return act(
				"findPendingOperation",
				async () => {
					if (account.length === 0) throw new Error("No account found in the wallet")
					const l1 = sourceNetwork.includes("mina") ? sourceNetwork : destinationNetwork
					const l2 = sourceNetwork.includes("zeko") ? sourceNetwork : destinationNetwork

					const result = await worker.findPendingOperations({ account, l1, l2 })
					console.log(
						`Found ${result.deposits.length} deposits and ${result.withdrawals.length} withdrawals`
					)
					return result
				},
				account
			)
		})
	},
	actions: {
		startOperation: assign(({ context, self, spawn }, settings: StartOperationSettings) => {
			logger.info("Starting an operation with settings", settings)
			const { amount, command, state, timeoutSlots, lane = "main" } = settings
			const { wallet } = context
			const source = state?.source ?? (context.sourceNetwork as Networks)
			const destination = state?.destination ?? (context.destinationNetwork as Networks)
			const regularDirection = source.includes("mina") ? "deposit" : "withdrawal"
			const direction = (
				{
					start: regularDirection,
					complete: regularDirection,
					completeCancelled: regularDirection,
					resumeDeposit: "deposit",
					resumeWithdrawal: "withdrawal"
				} as const
			)[command]

			const id = state?.id ?? operationId()
			if (context.operations.has(id)) {
				logger.warn(`Operation ${id} already exists, skipping spawn`)
				return {}
			}
			const order = context.nextOperationOrder
			const operation = spawn("bridgeOperationMachine", {
				id,
				systemId: id,
				input: {
					bridge: self,
					wallet,
					source,
					destination,
					direction,
					amount,
					timeoutSlots,
					timeoutSlot: state?.timeoutSlot,
					transaction: state?.transaction,
					cancellable: state?.cancellable
				}
			})
			if (command === "start") operation.send({ type: "StartBridgeOperation" })
			if (command === "resumeDeposit" || command === "resumeWithdrawal") {
				operation.send({ type: "Resume", paused: state?.status === "paused" })
			}
			if (command === "complete") operation.send({ type: "CompleteBridgeOperation" })
			if (command === "completeCancelled")
				operation.send({ type: "CompleteBridgeOperationCancelled" })
			const operations = context.operations.set(id, {
				order,
				status: state?.status ?? "started",
				lane,
				operation
			})
			return {
				operations: new Map(operations),
				nextOperationOrder: order + 1,
				activeOperation:
					lane === "cancellation" ||
					command === "complete" ||
					command === "completeCancelled" ||
					state?.status === "paused"
						? context.activeOperation
						: id,
				activeCancellationOperation:
					lane === "cancellation" && state?.status !== "paused"
						? id
						: context.activeCancellationOperation
			}
		}),
		pauseOperation: assign(({ context }, params: { id: string }) => {
			const { id } = params
			const operations = context.operations
			const pausedEntry = operations.get(id)
			if (!pausedEntry) throw new Error("Operation not found")
			operations.set(id, { ...pausedEntry, status: "paused" })
			return {
				operations: new Map(operations)
			}
		}),
		completeOperation: assign(({ context }, params: { id: string; terminate?: boolean }) => {
			logger.info("Completing operation", params.id)
			const { id, terminate } = params
			const operations = context.operations
			const completedEntry = operations.get(id)
			if (!completedEntry) throw new Error("Operation not found")
			const { lane, operation: completedOperation, order } = completedEntry
			if (terminate) operations.delete(id)
			else operations.set(id, { status: "completed", lane, operation: completedOperation, order })

			let idToResume: string | null = null
			if (lane === "main") {
				const [nextId, ...rest] = pausedMainQueueIds(operations)
				idToResume = nextId ?? null
				logger.info("Found operation to resume", idToResume, rest)
				if (idToResume) {
					const nextEntry = operations.get(idToResume)
					const operation = nextEntry?.operation
					if (operation && nextEntry) {
						logger.info("Resuming operation", idToResume)
						operation.send({ type: "Resume", paused: false })
						operations.set(idToResume, { ...nextEntry, status: "started" })
					}
				}
			}

			return {
				operations: new Map(operations),
				activeOperation: lane === "main" ? idToResume : context.activeOperation,
				activeCancellationOperation:
					context.activeCancellationOperation === id ? null : context.activeCancellationOperation
			}
		}),
		activateCancellationOperation: assign(({ context }, params: { id: string }) => ({
			activeCancellationOperation:
				context.activeCancellationOperation === null ||
				context.activeCancellationOperation === params.id
					? params.id
					: context.activeCancellationOperation
		})),
		releaseCancellationOperation: assign(({ context }, params: { id: string }) => ({
			activeCancellationOperation:
				context.activeCancellationOperation === params.id
					? null
					: context.activeCancellationOperation
		}))
	}
}).createMachine({
	id: "bridge",
	initial: "IDLE",
	context: ({ input: { wallet } }) => {
		const sourceNetwork = wallet.getSnapshot().context.currentNetwork
		const destinationNetwork = bridgeDirections[sourceNetwork]
		return {
			wallet,
			worker: Comlink.wrap<OperationsWorker>(worker),
			operations: new Map(),
			sourceNetwork,
			destinationNetwork,
			walletReady: false,
			accountReady: false,
			activeOperation: null,
			activeCancellationOperation: null,
			nextOperationOrder: 0,
			currentSlot: undefined
		}
	},
	invoke: {
		src: "detectWalletChange",
		systemId: "wallet",
		input: ({ context }) => ({ wallet: context.wallet })
	},
	on: {
		AccountChanged: [
			{ guard: ({ context }) => !context.accountReady, actions: assign({ accountReady: true }) },
			{
				target: ".FIND_OPERATIONS",
				guard: ({ context }) => context.accountReady && context.walletReady,
				actions: enqueueActions(({ enqueue, context }) => {
					context.operations.forEach(({ operation }) => {
						operation.send({ type: "Destroy" })
					})
					context.operations.clear()
					enqueue.assign({
						operations: new Map(),
						activeOperation: null,
						activeCancellationOperation: null,
						nextOperationOrder: 0,
						currentSlot: undefined
					})
				})
			}
		],
		NetworkChanged: [
			{
				target: ".FIND_OPERATIONS",
				description:
					"This is taken automatically for the first time as Auro will send the event on page load.",
				guard: ({ context }) => !context.walletReady,
				actions: enqueueActions(({ enqueue, event }) => {
					const sourceNetwork = event.network
					const destinationNetwork = bridgeDirections[event.network]
					enqueue.assign({ walletReady: true, sourceNetwork, destinationNetwork })
				})
			},
			{
				description:
					"Change the network of all operations and invert direction if the network is different.",
				actions: enqueueActions(({ context, event, enqueue }) => {
					const sourceNetwork = event.network
					const destinationNetwork = bridgeDirections[event.network]
					for (const { status, operation } of context.operations.values()) {
						if (status === "started" || status === "paused") {
							operation.send({
								type: "SetCurrentNetwork",
								network: sourceNetwork
							})
						}
					}
					enqueue.assign({ sourceNetwork, destinationNetwork })
				})
			}
		],
		SetSource: {
			target: ".FIND_OPERATIONS",
			guard: ({ event, context }) => event.sourceNetwork !== context.sourceNetwork,
			actions: assign(({ event }) => ({
				sourceNetwork: event.sourceNetwork,
				destinationNetwork: bridgeDirections[event.sourceNetwork]
			}))
		},
		SetDestination: {
			target: ".FIND_OPERATIONS",
			guard: ({ event, context }) => event.destinationNetwork !== context.destinationNetwork,
			actions: assign(({ event }) => ({
				destinationNetwork: event.destinationNetwork,
				sourceNetwork: bridgeDirections[event.destinationNetwork]
			}))
		},
		InvertDirection: {
			target: ".READY",
			actions: assign(({ context: { sourceNetwork, destinationNetwork } }) => ({
				sourceNetwork: destinationNetwork,
				destinationNetwork: sourceNetwork
			}))
		},
		StartOperation: {
			description:
				"Start a new bridge operation. Operation concurrency is handled by BridgeOperation. If there's an activeOperation, the operation will pause itself at the right time with the `anotherOperationIsActive` guard.",
			guard: and(["validSource", "validDestination"]),
			actions: {
				type: "startOperation",
				params: ({ event }) => ({
					amount: event.amount,
					timeoutSlots: event.timeoutSlots,
					command: "start"
				})
			}
		},
		PauseOperation: {
			description: "Set operation status to paused and add it to the operationToUnpause array.",
			actions: { type: "pauseOperation", params: ({ event }) => ({ id: event.id }) }
		},
		TerminateOperation: {
			description: "Complete an operation and terminate it.",
			actions: {
				type: "completeOperation",
				params: ({ event }) => ({ id: event.id, terminate: true })
			}
		},
		CompleteOperation: {
			description: "Complete an operation.",
			actions: { type: "completeOperation", params: ({ event }) => ({ id: event.id }) }
		},
		ActivateCancellationOperation: {
			actions: {
				type: "activateCancellationOperation",
				params: ({ event }) => ({ id: event.id })
			}
		},
		ReleaseCancellationOperation: {
			actions: {
				type: "releaseCancellationOperation",
				params: ({ event }) => ({ id: event.id })
			}
		}
	},
	states: {
		IDLE: {},
		READY: {
			after: {
				[REFRESH_INTERVAL]: {
					target: "REFRESH_OPERATIONS",
					guard: "shouldRefreshPendingOperations"
				}
			}
		},
		REFRESH_OPERATIONS: {
			invoke: {
				src: "findPendingOperations",
				input: ({ context: { wallet, worker, sourceNetwork, destinationNetwork } }) => ({
					wallet,
					worker,
					sourceNetwork,
					destinationNetwork
				}),
				onDone: {
					target: "READY",
					actions: assign(({ context, event }) => {
						const recovered = classifyRecoveredOperations(event.output)
						const { operations, activeOperation, activeCancellationOperation } =
							syncRecoveredOperations({
								context,
								recovered
							})

						return {
							operations,
							activeOperation,
							activeCancellationOperation,
							currentSlot: event.output.currentSlot
						}
					})
				},
				onError: {
					target: "READY"
				}
			}
		},
		ERROR: {},
		FIND_OPERATIONS: {
			invoke: {
				src: "findPendingOperations",
				input: ({ context: { wallet, worker, sourceNetwork, destinationNetwork } }) => ({
					wallet,
					worker,
					sourceNetwork,
					destinationNetwork
				}),
				onDone: {
					target: "READY",
					actions: enqueueActions(({ event, enqueue }) => {
						const recovered = classifyRecoveredOperations(event.output)

						const handleComplete = () => {
							const deposits = recovered.completedDeposits
							const withdrawals = recovered.completedWithdrawals

							for (const actionState of deposits)
								enqueueRecoveredOperation({
									enqueue,
									actionState,
									command: "complete",
									status: "completed"
								})

							for (const actionState of withdrawals)
								enqueueRecoveredOperation({
									enqueue,
									actionState,
									command: "complete",
									status: "completed"
								})
						}

						const handleCancelled = () => {
							const deposits = recovered.cancelledDeposits
							for (const actionState of deposits)
								enqueueRecoveredOperation({
									enqueue,
									actionState,
									command: "completeCancelled",
									status: "completed"
								})
						}

						enqueueRecoveredOperations({ enqueue, recovered })
						handleComplete()
						handleCancelled()
						enqueue.assign({ currentSlot: event.output.currentSlot })
					})
				},
				onError: { target: "ERROR" }
			}
		}
	}
})
