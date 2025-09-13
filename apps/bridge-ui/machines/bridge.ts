import { type Networks, type WalletEmit, detectWalletChange } from "@lumina-dex/sdk"
import type { walletMachine } from "@lumina-dex/sdk"
import * as Sentry from "@sentry/nuxt"
import * as Comlink from "comlink"
import { nanoid } from "nanoid"
import { type ActorRefFromLogic, and, assign, enqueueActions, fromPromise, setup } from "xstate"
import { bridgeOperationMachine } from "./bridgeOperation"
import { createLogger } from "./debug"
import type { ActionState, OperationsWorker, PendingOperations } from "./operations.worker"
import workerUrl from "./operations.worker?worker&url"

const worker = new Worker(new URL(workerUrl, import.meta.url), { type: "module" })
if (import.meta.client) {
	Sentry.addIntegration(Sentry.webWorkerIntegration({ worker }))
}

const { act, logger } = createLogger("[BRIDGE]")

type OperationStatus = "started" | "paused" | "completed"
type Operations = Map<
	string,
	{
		status: OperationStatus
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}
>
type Wallet = ActorRefFromLogic<typeof walletMachine>
type OperationWorker = Comlink.Remote<OperationsWorker>

type Command = "start" | "resumeDeposit" | "resumeWithdrawal" | "complete"
type StartOperationSettings = {
	amount: string
	command: Command
	state?: {
		id?: string
		status: OperationStatus
		source: Networks
		destination: Networks
		transaction: ActionState["transaction"]
	}
}

type PendingOperationsInput = {
	wallet: Wallet
	worker: OperationWorker
	sourceNetwork: Networks
	destinationNetwork: Networks
}

export type BridgeEvents =
	| { type: "StartOperation"; amount: string }
	| { type: "CompleteOperation"; id: string }
	| { type: "PauseOperation"; id: string }
	| { type: "TerminateOperation"; id: string }
	| { type: "InvertDirection" }
	| { type: "SetSource"; sourceNetwork: Networks }
	| { type: "SetDestination"; destinationNetwork: Networks }
	| { type: "SwitchToTesnet" }

export interface BridgeContext {
	sourceNetwork: Networks
	destinationNetwork: Networks
	operations: Operations
	operationsToUnpause: string[]
	wallet: Wallet
	walletReady: boolean
	accountReady: boolean
	activeOperation: string | null
	worker: OperationWorker
}

const currentNetwork = (context: BridgeContext) =>
	context.wallet.getSnapshot().context.currentNetwork

const operationId = () => `bridgeOperation-${Date.now()}-${nanoid(8)}`
const supportedNetworks = ["mina:devnet", "zeko:testnet"] as const

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
		validDestination: ({ context }) => supportedNetworks.includes(context.destinationNetwork)
	},
	actors: {
		bridgeOperationMachine,
		detectWalletChange,
		findPendingOperations: fromPromise<PendingOperations, PendingOperationsInput>(({ input }) => {
			return act("findPendingOperation", async () => {
				const { wallet, worker, sourceNetwork, destinationNetwork } = input
				const account = wallet.getSnapshot().context.account

				const l1 = sourceNetwork.includes("mina") ? sourceNetwork : destinationNetwork
				const l2 = sourceNetwork.includes("zeko") ? sourceNetwork : destinationNetwork

				const result = await worker.findPendingOperations({ account, l1, l2 })
				console.log(
					`Found ${result.deposits.length} deposits and ${result.withdrawals.length} withdrawals`
				)
				return result
			})
		})
	},
	actions: {
		startOperation: assign(({ context, self, spawn }, settings: StartOperationSettings) => {
			logger.info("Starting an operation with settings", settings)
			const { amount, command, state } = settings
			const { wallet } = context
			const source = state?.source ?? (context.sourceNetwork as Networks)
			const destination = state?.destination ?? (context.destinationNetwork as Networks)
			const regularDirection = source.includes("mina") ? "deposit" : "withdrawal"
			const direction = (
				{
					start: regularDirection,
					complete: regularDirection,
					resumeDeposit: "deposit",
					resumeWithdrawal: "withdrawal"
				} as const
			)[command]

			const id = state?.id ?? operationId()
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
					transaction: state?.transaction
				}
			})
			if (command === "start") operation.send({ type: "StartBridgeOperation" })
			if (command === "resumeDeposit" || command === "resumeWithdrawal") {
				operation.send({ type: "Resume", paused: state?.status === "paused" })
			}
			if (command === "complete") operation.send({ type: "CompleteBridgeOperation" })
			const operations = context.operations.set(id, {
				status: state?.status ?? "started",
				operation
			})
			return {
				operations: new Map(operations),
				activeOperation:
					command === "complete" || state?.status === "paused" ? context.activeOperation : id
			}
		}),
		pauseOperation: assign(({ context }, params: { id: string }) => {
			const { id } = params
			const operations = context.operations
			const pausedOperation = operations.get(id)?.operation
			if (!pausedOperation) throw new Error("Operation not found")
			operations.set(id, { status: "paused", operation: pausedOperation })
			return {
				operations: new Map(operations),
				operationsToUnpause: [...context.operationsToUnpause, id]
			}
		}),
		completeOperation: assign(({ context }, params: { id: string; terminate?: boolean }) => {
			logger.info("Completing operation", params.id)
			const { id, terminate } = params
			const operations = context.operations
			const completedOperation = operations.get(id)?.operation
			if (!completedOperation) throw new Error("Operation not found")
			if (terminate) operations.delete(id)
			else operations.set(id, { status: "completed", operation: completedOperation })
			// Resume the next operation
			const [idToResume, ...rest] = context.operationsToUnpause
			logger.info("Found operation to resume", idToResume, rest)
			if (idToResume) {
				const operation = operations.get(idToResume)?.operation
				if (operation) {
					logger.info("Resuming operation", idToResume)
					operation.send({ type: "Resume", paused: false })
					operations.set(idToResume, { status: "started", operation })
				}
			}
			return {
				operations: new Map(operations),
				operationsToUnpause: idToResume ? rest : [],
				activeOperation: idToResume ?? null
			}
		})
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
			operationsToUnpause: [],
			sourceNetwork,
			destinationNetwork,
			walletReady: false,
			accountReady: false,
			activeOperation: null
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
					// biome-ignore lint/complexity/noForEach: <explanation>
					context.operations.forEach(({ operation }) => {
						operation.send({ type: "Destroy" })
					})
					context.operations.clear()
					enqueue.assign({ operations: new Map(), operationsToUnpause: [], activeOperation: null })
				})
			}
		],
		NetworkChanged: [
			{
				target: ".MAINNET",
				description: "TODO: this should be removed once the bridge supports mainnet.",
				guard: ({ context }) => currentNetwork(context).includes("mainnet"),
				actions: enqueueActions(({ context, enqueue }) => {
					logger.error("Mainnet is not supported yet, manually change to a compatible network.")
					enqueue.assign({ walletReady: false })
					enqueue.sendTo(context.wallet, { type: "RequestNetworkChange", network: "zeko:testnet" })
				})
			},
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
					//Check for mainnet
					if (sourceNetwork.includes("mainnet")) {
						logger.error("Mainnet is not supported yet, changing to 'zeko:testnet' ")
						enqueue.sendTo(context.wallet, {
							type: "RequestNetworkChange",
							network: "zeko:testnet"
						})
						return
					}
					//Notify all operations
					for (const { status, operation } of context.operations.values()) {
						if (status === "started" || status === "paused") {
							operation.send({
								type: "SetCurrentNetwork",
								network: sourceNetwork
							})
						}
					}
					// Assign data
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
				params: ({ event }) => ({ amount: event.amount, command: "start" })
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
		}
	},
	states: {
		IDLE: {},
		MAINNET: {
			on: {
				SwitchToTesnet: {
					description: "TODO: this should be removed once the bridge supports mainnet.",
					actions: enqueueActions(({ enqueue, context }) => {
						enqueue.sendTo(context.wallet, {
							type: "RequestNetworkChange",
							network: "zeko:testnet"
						})
					})
				}
			}
		},
		READY: {},
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
						interface StartArgs {
							status: OperationStatus
							actionState: ActionState
							command: Command
						}
						const start = ({ status, actionState, command }: StartArgs) => {
							const { amount, source, destination, transaction, id } = actionState
							enqueue({
								type: "startOperation",
								params: {
									amount,
									command,
									state: { id, status, destination, source, transaction }
								}
							})
						}
						const handlePending = () => {
							const [deposit, ...deposits] = event.output.deposits.filter(
								(a) => a.finalised === false
							)
							const [withdrawal, ...withdrawals] = event.output.withdrawals.filter(
								(a) => a.finalised === false
							)

							// We only truly resume the first deposit or withdrawal, everything else is paused.
							if (deposit)
								start({ status: "started", actionState: deposit, command: "resumeDeposit" })

							if (withdrawal) {
								const status = deposit ? "paused" : "started"
								start({ status, actionState: withdrawal, command: "resumeWithdrawal" })
							}

							for (const actionState of deposits)
								start({ status: "paused", actionState, command: "resumeDeposit" })

							for (const actionState of withdrawals)
								start({ status: "paused", actionState, command: "resumeWithdrawal" })
							// Queue the un-finalized operations to unpause them one by one
							enqueue.assign({
								operationsToUnpause: deposits
									.map((d) => d.id)
									.concat(deposit && withdrawal ? [withdrawal.id] : [])
									.concat(withdrawals.map((w) => w.id))
							})
						}

						const handleComplete = () => {
							const deposits = event.output.deposits.filter((a) => a.finalised === true)
							const withdrawals = event.output.withdrawals.filter((a) => a.finalised === true)

							for (const actionState of deposits)
								start({ status: "completed", actionState, command: "complete" })

							for (const actionState of withdrawals)
								start({ status: "completed", actionState, command: "complete" })
						}

						handlePending()
						handleComplete()
					})
				}
			}
		}
	}
})
