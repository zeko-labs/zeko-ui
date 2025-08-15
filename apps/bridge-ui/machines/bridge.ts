import { type Networks, type WalletEmit, detectWalletChange } from "@lumina-dex/sdk"
import type { walletMachine } from "@lumina-dex/sdk"
import * as Comlink from "comlink"
import { nanoid } from "nanoid"
import {
	type ActorRefFromLogic,
	and,
	assign,
	enqueueActions,
	fromPromise,
	setup,
	spawnChild
} from "xstate"
import { bridgeOperationMachine } from "./bridgeOperation"
import type { OperationsWorker, PendingOperations } from "./operations.worker"
import workerUrl from "./operations.worker?worker&url"

//TODO: Fix with https://github.com/vitejs/vite/issues/13680
const jsWorker = `import ${JSON.stringify(new URL(workerUrl, import.meta.url))}`
const blobWorker = new Blob([jsWorker], { type: "application/javascript" })

type Operations = Map<
	string,
	{
		status: "started" | "paused" | "completed"
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}
>
type Wallet = ActorRefFromLogic<typeof walletMachine>

export type BridgeEvents =
	| { type: "StartOperation"; amount: string }
	| { type: "CompleteOperation"; id: string }
	| { type: "InvertDirection" }
	| { type: "SetSource"; sourceNetwork: Networks }
	| { type: "SetDestination"; destinationNetwork: Networks }

interface BridgeContext {
	sourceNetwork: Networks
	destinationNetwork: Networks
	operations: Operations
	operationsToUnpause: string[]
	wallet: Wallet
	walletReady: boolean
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

// type imported from worker

type StartOperationSettings = {
	amount: string
	command: "start" | "resumeDeposit" | "resumeWithdrawal" | "complete"
	state?: {
		id?: string
		status: "started" | "paused" | "completed"
		source: Networks
		destination: Networks
	}
}

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
		findPendingOperations: fromPromise<PendingOperations, { wallet: Wallet }>(async ({ input }) => {
			const { wallet } = input
			const account = wallet.getSnapshot().context.account
			// TODO: compute l1/l2 from current networks if needed
			const l1 = "mina:devnet" as const
			const l2 = "zeko:testnet" as const

			const ww = new Worker(URL.createObjectURL(blobWorker), { type: "module" })
			const worker = Comlink.wrap<OperationsWorker>(ww)
			const result = await worker.findPendingOperations({ account, l1, l2 })
			console.log(
				`Found ${result.deposits.length} deposits and ${result.withdrawals.length} withdrawals`
			)
			return result
		})
	},
	actions: {
		startOperation: assign(({ context, self, spawn }, settings: StartOperationSettings) => {
			console.log("Starting an operation with settings", settings)
			const { amount, command, state } = settings
			const { wallet } = context
			const direction = (
				{
					start: context.sourceNetwork.includes("mina") ? "deposit" : "withdrawal",
					complete: context.sourceNetwork.includes("mina") ? "deposit" : "withdrawal",
					resumeDeposit: "deposit",
					resumeWithdrawal: "withdrawal"
				} as const
			)[command]

			const source = state?.source ?? (context.sourceNetwork as Networks)
			const destination = state?.destination ?? (context.destinationNetwork as Networks)

			const id = state?.id ?? operationId()
			const operation = spawn("bridgeOperationMachine", {
				id,
				systemId: id,
				input: {
					bridgeMachine: self,
					wallet,
					source,
					destination,
					direction,
					amount
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
			return { operations: new Map(operations) }
		}),
		completeOperation: assign(({ context }, params: { id: string }) => {
			console.log("Completing operation", params.id)
			const { id } = params
			const operations = context.operations
			const completedOperation = operations.get(id)?.operation
			if (!completedOperation) throw new Error("Operation not found")
			operations.set(id, {
				status: "completed",
				operation: completedOperation
			})
			// Resume the next operation
			const [idToResume, ...rest] = context.operationsToUnpause
			console.log("Found operation to resume", idToResume, rest)
			if (idToResume) {
				const operation = operations.get(idToResume)?.operation
				if (operation) {
					console.log("Resuming operation", idToResume)
					operation.send({ type: "Resume", paused: false })
					operations.set(idToResume, { status: "started", operation })
				}
			}
			return {
				operations: new Map(operations),
				operationsToUnpause: idToResume ? rest : []
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
			operations: new Map(),
			operationsToUnpause: [],
			sourceNetwork,
			destinationNetwork,
			walletReady: false
		}
	},
	entry: spawnChild("detectWalletChange", {
		input: ({ context }) => ({ wallet: context.wallet })
	}),
	on: {
		NetworkChanged: [
			{
				target: ".READY",
				guard: ({ context }) => !context.walletReady,
				actions: enqueueActions(({ context, enqueue, event }) => {
					const sourceNetwork = event.network
					const destinationNetwork = bridgeDirections[event.network]
					//Check for mainnet
					if (sourceNetwork.includes("mainnet")) {
						console.error("Mainnet is not supported yet, changing to 'zeko:testnet' ")
						return enqueue.sendTo(context.wallet, {
							type: "RequestNetworkChange",
							network: "zeko:testnet"
						})
					}
					enqueue.assign({ walletReady: true, sourceNetwork, destinationNetwork })
				})
			},
			{
				description:
					"Change the network of all operations and invert direction if the network is different.",
				guard: ({ event, context }) => event.network !== currentNetwork(context),
				actions: enqueueActions(({ context, event, enqueue }) => {
					const sourceNetwork = event.network
					const destinationNetwork = bridgeDirections[event.network]
					//Check for mainnet
					if (sourceNetwork.includes("mainnet")) {
						console.error("Mainnet is not supported yet, changing to 'zeko:testnet' ")
						return enqueue.sendTo(context.wallet, {
							type: "RequestNetworkChange",
							network: "zeko:testnet"
						})
					}
					//Notify all operations
					for (const { status, operation } of context.operations.values()) {
						if (status === "started") {
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
			target: ".READY",
			guard: ({ event, context }) => event.sourceNetwork !== context.sourceNetwork,
			actions: assign(({ event }) => ({
				sourceNetwork: event.sourceNetwork,
				destinationNetwork: bridgeDirections[event.sourceNetwork]
			}))
		},
		SetDestination: {
			target: ".READY",
			guard: ({ event, context }) => event.destinationNetwork !== context.destinationNetwork,
			actions: assign(({ event }) => ({
				destinationNetwork: event.destinationNetwork,
				sourceNetwork: bridgeDirections[event.destinationNetwork]
			}))
		}
	},
	states: {
		IDLE: {},
		READY: {
			// entry: enqueueActions(() => {
			// 	console.log("Entering READY state")
			// }),
			invoke: {
				src: "findPendingOperations",
				input: ({ context }) => ({ wallet: context.wallet }),
				onDone: {
					actions: enqueueActions(({ event, enqueue }) => {
						const handlePending = () => {
							const [deposit, ...deposits] = event.output.deposits.filter(
								(a) => a.finalised === false
							)
							const [withdrawal, ...withdrawals] = event.output.withdrawals.filter(
								(a) => a.finalised === false
							)
							const type = "startOperation"
							// We only truly resume the first deposit or withdrawal, everything else is paused.
							if (deposit) {
								const { amount, source, destination, id } = deposit
								enqueue({
									type,
									params: {
										amount,
										command: "resumeDeposit",
										state: { id, status: "started", destination, source }
									}
								})
							}
							if (withdrawal) {
								const { amount, source, destination, id } = withdrawal
								enqueue({
									type,
									params: {
										amount,
										command: "resumeWithdrawal",
										state: {
											id,
											status: deposit ? "paused" : "started",
											destination,
											source
										}
									}
								})
							}
							for (const { amount, source, destination, id } of deposits)
								enqueue({
									type,
									params: {
										amount,
										command: "resumeDeposit",
										state: { id, status: "paused", source, destination }
									}
								})
							for (const { amount, source, destination, id } of withdrawals)
								enqueue({
									type,
									params: {
										amount,
										command: "resumeWithdrawal",
										state: { id, status: "paused", source, destination }
									}
								})
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
							const type = "startOperation"

							for (const { amount, source, destination, id } of deposits)
								enqueue({
									type,
									params: {
										amount,
										command: "complete",
										state: { id, status: "completed", source, destination }
									}
								})
							for (const { amount, source, destination, id } of withdrawals)
								enqueue({
									type,
									params: {
										amount,
										command: "complete",
										state: { id, status: "completed", source, destination }
									}
								})
						}

						handlePending()
						handleComplete()
					})
				}
			},
			on: {
				InvertDirection: {
					actions: assign(({ context: { sourceNetwork, destinationNetwork } }) => ({
						sourceNetwork: destinationNetwork,
						destinationNetwork: sourceNetwork
					}))
				},
				StartOperation: {
					guard: and(["validSource", "validDestination"]),
					actions: {
						type: "startOperation",
						params: ({ event }) => ({ amount: event.amount, command: "start" })
					}
				},
				CompleteOperation: {
					actions: {
						type: "completeOperation",
						params: ({ event }) => ({ id: event.id })
					}
				}
			}
		}
	}
})
