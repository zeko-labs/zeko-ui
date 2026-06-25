import { MINA_NETWORKS, ZEKO_M_NETWORKS } from "@zeko/networks"
import { detectWalletChange, type WalletEmit, type walletMachine } from "@zeko/sdk"
import { nanoid } from "nanoid"
import { type ActorRefFromLogic, and, assign, enqueueActions, fromPromise, setup } from "xstate"
import {
	bridgeOperationMachine,
	type BridgeOperationCompletionVerification
} from "./bridgeOperation"
import { createLogger } from "./debug"
import type { BridgeDebugMode } from "./debugMode"
import type { ActionState, PendingOperations } from "./operations.worker"
import type { BridgeNetwork } from "./networks"
import { createOperationsWorkerClient, type OperationWorker } from "./operationWorkerClient"
import {
	isMinaBridgeNetwork,
	isZekoBridgeNetwork,
	supportedNetworks,
	walletNetworkToBridgeNetwork
} from "./networks"
import type { RecoveredOperations, RecoveryLane } from "./recovery"
import {
	buildRecoverySyncState,
	classifyRecoveredOperations,
	matchRecoveryOperationIds
} from "./recovery"

export { supportedNetworks } from "./networks"

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
		source: BridgeNetwork
		destination: BridgeNetwork
		transaction: ActionState["transaction"]
		actionIndex: number
		progress?: ActionState["progress"]
		cancellable?: boolean
		timeoutSlot?: string
		completionVerification?: BridgeOperationCompletionVerification
	}
}

type PendingOperationsInput = {
	wallet: Wallet
	worker: OperationWorker
	sourceNetwork: BridgeNetwork
	destinationNetwork: BridgeNetwork
}

export type BridgeEvents =
	| { type: "StartOperation"; amount: string; timeoutSlots?: number }
	| { type: "CompleteOperation"; id: string }
	| { type: "FailOperation"; id: string }
	| { type: "PauseOperation"; id: string }
	| { type: "TerminateOperation"; id: string }
	| { type: "RefreshOperations" }
	| { type: "SimulatePageRefresh" }
	| { type: "ActivateCancellationOperation"; id: string }
	| { type: "ReleaseCancellationOperation"; id: string }
	| { type: "InvertDirection" }
	| { type: "SetSource"; sourceNetwork: BridgeNetwork }
	| { type: "SetDestination"; destinationNetwork: BridgeNetwork }

export interface BridgeContext {
	sourceNetwork: BridgeNetwork
	destinationNetwork: BridgeNetwork
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

type BridgeMachineInput = {
	wallet: Wallet
	debugMode?: BridgeDebugMode
}

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
type StartArgs = {
	status: OperationStatus
	actionState: ActionState
	command: Command
}

type RecoveryEnqueue = (action: { type: "startOperation"; params: StartOperationSettings }) => void

type RecoveredOperationToStart = {
	actionState: ActionState
	command: Command
	lane?: RecoveryLane
	status: OperationStatus
	completionVerification?: BridgeOperationCompletionVerification
}

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
					actionIndex: actionState.index,
					progress: actionState.progress,
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
	lane,
	status,
	completionVerification
}: {
	enqueue: RecoveryEnqueue
	actionState: ActionState
	command: Command
	lane?: RecoveryLane
	status: OperationStatus
	completionVerification?: BridgeOperationCompletionVerification
}) => {
	enqueue({
		type: "startOperation",
		params: {
			amount: actionState.amount,
			command,
			lane,
			state: {
				id: actionState.id,
				status,
				source: actionState.source,
				destination: actionState.destination,
				transaction: actionState.transaction,
				actionIndex: actionState.index,
				progress: actionState.progress,
				cancellable: actionState.cancellable,
				timeoutSlot: actionState.timeoutSlot,
				completionVerification:
					completionVerification ??
					(command === "complete" || command === "completeCancelled" ? "verified" : undefined)
			}
		}
	})
}

const recoverableTransactionHash = (
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>
) => {
	const context = operation.getSnapshot().context
	return (
		context.transaction?.hash ??
		context.transactions.submitDeposit?.result?.hash ??
		context.transactions.submitWithdrawal?.result?.hash
	)
}

const matchesRecoveredActionIndex = (
	operation: ActorRefFromLogic<typeof bridgeOperationMachine>,
	actionState: ActionState
) => {
	const actionIndex = operation.getSnapshot().context.actionIndex
	return actionIndex === undefined || actionIndex === actionState.index
}

const isTerminalOperationActor = (operation: ActorRefFromLogic<typeof bridgeOperationMachine>) => {
	const snapshot = operation.getSnapshot()
	return (
		snapshot.matches("BRIDGE_OPERATION_COMPLETED") ||
		snapshot.matches("BRIDGE_OPERATION_DONE") ||
		snapshot.matches("BRIDGE_OPERATION_DONE_NOOP") ||
		snapshot.matches("BRIDGE_OPERATION_CANCELLED_DONE_NOOP") ||
		snapshot.matches("BRIDGE_OPERATION_CANCELLED_DONE")
	)
}

const terminalRecoveredOperations = (
	recovered: RecoveredOperations
): RecoveredOperationToStart[] => [
	...recovered.completedDeposits.map((actionState) => ({
		actionState,
		command: "complete" as const,
		status: "completed" as const,
		completionVerification: "verified" as const
	})),
	...recovered.completedWithdrawals.map((actionState) => ({
		actionState,
		command: "complete" as const,
		status: "completed" as const,
		completionVerification: "verified" as const
	})),
	...recovered.cancelledDeposits.map((actionState) => ({
		actionState,
		command: "completeCancelled" as const,
		status: "completed" as const,
		completionVerification: "verified" as const
	}))
]

const syncRecoveredOperations = ({
	context,
	recovered
}: {
	context: BridgeContext
	recovered: RecoveredOperations
}) => {
	const operations = new Map(context.operations)
	const pendingRecoveredOperations = [...recovered.mainPending, ...recovered.cancellableDeposits]
	const pendingRecoveredOperationById = new Map(
		pendingRecoveredOperations.map(
			(pendingOperation) => [pendingOperation.actionState.id, pendingOperation] as const
		)
	)
	const pendingActionStateById = new Map(
		pendingRecoveredOperations.map(({ actionState }) => [actionState.id, actionState] as const)
	)
	const terminalOperations = terminalRecoveredOperations(recovered)
	const matchedRecoveryOperationIds = matchRecoveryOperationIds({
		actionStates: [
			...pendingRecoveredOperations.map(({ actionState }) => actionState),
			...terminalOperations.map(({ actionState }) => actionState)
		],
		candidates: [...operations.entries()].map(([id, { status, operation }]) => ({
			id,
			status,
			transactionHash: recoverableTransactionHash(operation)
		}))
	})
	const terminalActionStateById = new Map(
		terminalOperations.map(({ actionState }) => [actionState.id, actionState] as const)
	)
	const recoveryOperationIds = new Map(
		[...matchedRecoveryOperationIds.entries()].filter(([recoveredId, operationId]) => {
			const terminalActionState = terminalActionStateById.get(recoveredId)
			if (!terminalActionState) return true
			const entry = operations.get(operationId)
			return entry ? matchesRecoveredActionIndex(entry.operation, terminalActionState) : true
		})
	)
	const matchedOperationIds = new Set(recoveryOperationIds.values())
	const activeEntry =
		context.activeOperation === null ? undefined : operations.get(context.activeOperation)
	const preservedActiveMainOperationId =
		context.activeOperation !== null &&
		activeEntry?.lane === "main" &&
		activeEntry.status === "started" &&
		!matchedOperationIds.has(context.activeOperation)
			? context.activeOperation
			: null
	const mergeStatus = ({
		lane,
		status
	}: {
		lane: RecoveryLane
		status: OperationStatus
	}): OperationStatus =>
		preservedActiveMainOperationId !== null && lane === "main" && status === "started"
			? "paused"
			: status
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
		const actionState = pendingActionStateById.get(id)
		if (!entry || entry.status === "completed") continue
		if (!actionState) continue
		const mergedStatus = mergeStatus({ lane, status })
		entry.operation.send({
			type: "SyncRecoveredState",
			actionIndex: actionState.index,
			transaction: actionState.transaction,
			progress: actionState.progress,
			cancellable,
			timeoutSlot
		})
		if (entry.status !== mergedStatus) {
			if (mergedStatus === "started") entry.operation.send({ type: "Resume", paused: false })
			if (entry.status === "started" && mergedStatus === "paused")
				entry.operation.send({ type: "Pause" })
		}
		operations.set(operationId, {
			...entry,
			status: mergedStatus,
			lane,
			order
		})
	}

	for (const { actionState, command } of terminalOperations) {
		const operationId = recoveryOperationIds.get(actionState.id)
		if (!operationId) continue
		const entry = operations.get(operationId)
		if (!entry) continue
		if (!matchesRecoveredActionIndex(entry.operation, actionState)) continue
		entry.operation.send({
			type: "VerifyCompletion",
			actionIndex: actionState.index,
			transaction: actionState.transaction
		})
		if (!isTerminalOperationActor(entry.operation)) {
			entry.operation.send({
				type:
					command === "completeCancelled"
						? "RecoverBridgeOperationCancelled"
						: "RecoverBridgeOperationCompleted"
			})
		}
		operations.set(operationId, {
			...entry,
			status: "completed"
		})
	}

	const operationsToStart: RecoveredOperationToStart[] = syncState.pendingOperations.flatMap(
		({ id, lane, status }) => {
			if (recoveryOperationIds.has(id)) return []
			const pendingOperation = pendingRecoveredOperationById.get(id)
			return pendingOperation
				? [{ ...pendingOperation, lane, status: mergeStatus({ lane, status }) }]
				: []
		}
	)
	const terminalOperationsToStart = terminalOperations.filter(
		({ actionState }) => !matchedRecoveryOperationIds.has(actionState.id)
	)

	return {
		operations,
		activeOperation: (() => {
			if (preservedActiveMainOperationId !== null) return preservedActiveMainOperationId
			if (!syncState.activeOperation) return null
			return recoveryOperationIds.get(syncState.activeOperation) ?? null
		})(),
		activeCancellationOperation: (() => {
			if (!syncState.activeCancellationOperation) return null
			return recoveryOperationIds.get(syncState.activeCancellationOperation) ?? null
		})(),
		operationsToStart: [...operationsToStart, ...terminalOperationsToStart]
	}
}

const bridgeDirections = {
	[ZEKO_M_NETWORKS.mainnet]: MINA_NETWORKS.mainnet,
	[MINA_NETWORKS.mainnet]: ZEKO_M_NETWORKS.mainnet,
	[ZEKO_M_NETWORKS.testnet]: MINA_NETWORKS.devnet,
	[MINA_NETWORKS.devnet]: ZEKO_M_NETWORKS.testnet
} as const satisfies Record<BridgeNetwork, BridgeNetwork>

// Parent Bridge Machine
export const bridgeMachine = setup({
	types: {
		context: {} as BridgeContext,
		input: {} as BridgeMachineInput,
		events: {} as BridgeEvents | WalletEmit
	},
	guards: {
		validSource: ({ context }) => supportedNetworks.includes(context.sourceNetwork),
		validDestination: ({ context }) => supportedNetworks.includes(context.destinationNetwork),
		shouldRefreshPendingOperations: ({ context }) =>
			[...context.operations.values()].some(
				({ status, operation }) =>
					status !== "completed" ||
					operation.getSnapshot().context.completionVerification === "unverified"
			),
		canFindPendingOperations: ({ context }) => context.accountReady && context.walletReady
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
					const l1 = isMinaBridgeNetwork(sourceNetwork) ? sourceNetwork : destinationNetwork
					const l2 = isZekoBridgeNetwork(sourceNetwork) ? sourceNetwork : destinationNetwork

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
			const source = state?.source ?? context.sourceNetwork
			const destination = state?.destination ?? context.destinationNetwork
			const regularDirection = isMinaBridgeNetwork(source) ? "deposit" : "withdrawal"
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
					actionIndex: state?.actionIndex,
					progress: state?.progress,
					transaction: state?.transaction,
					cancellable: state?.cancellable,
					completionVerification: state?.completionVerification
				}
			})
			if (command === "start") operation.send({ type: "StartBridgeOperation" })
			if (command === "resumeDeposit" || command === "resumeWithdrawal") {
				operation.send({ type: "Resume", paused: state?.status === "paused" })
			}
			if (command === "complete") operation.send({ type: "RecoverBridgeOperationCompleted" })
			if (command === "completeCancelled")
				operation.send({ type: "RecoverBridgeOperationCancelled" })
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
		failOperation: assign(({ context }, params: { id: string }) => {
			logger.info("Failing operation", params.id)
			const { id } = params
			const operations = context.operations
			const failedEntry = operations.get(id)
			if (!failedEntry) throw new Error("Operation not found")
			const { lane, operation: failedOperation, order } = failedEntry
			operations.set(id, { status: "completed", lane, operation: failedOperation, order })

			let idToResume: string | null = null
			if (lane === "main" && context.activeOperation === id) {
				const [nextId, ...rest] = pausedMainQueueIds(operations)
				idToResume = nextId ?? null
				logger.info("Found operation to resume after failure", idToResume, rest)
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
				activeOperation:
					lane === "main" && context.activeOperation === id ? idToResume : context.activeOperation,
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
	context: ({ input }) => {
		const { wallet } = input
		const workerClient = createOperationsWorkerClient({
			debugMode: input.debugMode
		})
		const sourceNetwork = walletNetworkToBridgeNetwork(wallet.getSnapshot().context.currentNetwork)
		const destinationNetwork = bridgeDirections[sourceNetwork]
		return {
			wallet,
			worker: workerClient.worker,
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
					for (const id of context.operations.keys()) enqueue.stopChild(id)
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
					const sourceNetwork = walletNetworkToBridgeNetwork(event.network)
					const destinationNetwork = bridgeDirections[sourceNetwork]
					enqueue.assign({ walletReady: true, sourceNetwork, destinationNetwork })
				})
			},
			{
				description:
					"Change the network of all operations and invert direction if the network is different.",
				actions: enqueueActions(({ context, event, enqueue }) => {
					const sourceNetwork = walletNetworkToBridgeNetwork(event.network)
					const destinationNetwork = bridgeDirections[sourceNetwork]
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
		RefreshOperations: {
			target: ".REFRESH_OPERATIONS",
			guard: "canFindPendingOperations"
		},
		SimulatePageRefresh: {
			target: ".FIND_OPERATIONS",
			guard: "canFindPendingOperations",
			actions: enqueueActions(({ context, enqueue }) => {
				for (const id of context.operations.keys()) enqueue.stopChild(id)
				context.operations.clear()
				enqueue.assign({
					operations: new Map(),
					activeOperation: null,
					activeCancellationOperation: null,
					nextOperationOrder: 0,
					currentSlot: undefined
				})
			})
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
		FailOperation: {
			description: "Mark a failed operation inactive without deleting its actor.",
			actions: { type: "failOperation", params: ({ event }) => ({ id: event.id }) }
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
					actions: enqueueActions(({ context, event, enqueue }) => {
						const recovered = classifyRecoveredOperations(event.output)
						const { operations, activeOperation, activeCancellationOperation, operationsToStart } =
							syncRecoveredOperations({
								context,
								recovered
							})

						enqueue.assign({
							operations,
							activeOperation,
							activeCancellationOperation,
							currentSlot: event.output.currentSlot
						})

						for (const {
							actionState,
							command,
							lane,
							status,
							completionVerification
						} of operationsToStart) {
							enqueueRecoveredOperation({
								enqueue,
								actionState,
								command,
								lane,
								status,
								completionVerification
							})
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
