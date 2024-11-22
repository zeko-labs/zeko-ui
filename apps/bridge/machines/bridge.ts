import type { Networks } from "@zeko/sdk"
import type { walletMachine } from "@zeko/sdk/vue"
import { nanoid } from "nanoid"
import { type ActorRefFromLogic, type EventObject, assign, fromCallback, setup } from "xstate"
import { bridgeOperationMachine } from "./bridgeOperation"

const wait = (ms = 1000) => new Promise((res) => setTimeout(res, ms))
type Network = "mina" | "zeko"
type Operations = Map<
	string,
	{
		status: "started" | "completed"
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}
>
type Wallet = ActorRefFromLogic<typeof walletMachine>

export type BridgeEvents =
	| { type: "ApplyNetworkChange"; network: Networks }
	| { type: "StartOperation"; amount: string }
	| { type: "OperationComplete"; id: string }
	| { type: "InvertDirection" }

// Parent Bridge Machine
export const bridgeMachine = setup({
	types: {
		context: {} as {
			sourceNetwork: Network
			destinationNetwork: Network
			currentNetwork: Networks
			operations: Operations
			wallet: Wallet
		},
		input: {} as { wallet: Wallet; currentNetwork: Networks },
		events: {} as BridgeEvents
	},
	actors: {
		bridgeOperationMachine,
		detectNetworkChange: fromCallback<EventObject, { wallet: Wallet }>(
			({ sendBack, input: { wallet } }) => {
				const sub = wallet.on("NetworkChanged", (emitted) => {
					console.log("NetworkChanged received by actor", emitted)
					sendBack({ type: "NetworkChanged", network: emitted.network })
				})
				return () => {
					sub.unsubscribe()
				}
			}
		)
	},
	actions: {
		startOperation: assign({
			//@ts-ignore there are some random errors
			operations: ({ self, context, spawn }, params: { amount: string }) => {
				const { amount } = params
				const { wallet, sourceNetwork, destinationNetwork, currentNetwork: n } = context
				//TODO: Add testnet support
				const currentNetwork = n.includes("mina") ? "mina" : "zeko"
				const id = `bridgeOperation-${Date.now()}-${nanoid(8)}`
				const operation = spawn("bridgeOperationMachine", {
					id,
					input: {
						bridge: self,
						wallet,
						sourceNetwork,
						currentNetwork,
						destinationNetwork,
						amount
					}
				})
				operation.send({ type: "StartBridgeOperation" })
				return context.operations.set(id, { status: "started", operation })
			}
		}),
		completeOperation: assign({
			//@ts-ignore there are some random errors
			operations: ({ context }, params: { id: string }) => {
				const { id } = params
				const currentOperation = context.operations.get(id)?.operation
				if (!currentOperation) throw new Error("Operation not found")
				return context.operations.set(id, {
					status: "completed",
					operation: currentOperation
				})
			}
		}),
		changeOperationNetwork: ({ context }, { network }: { network: Network }) => {
			for (const { status, operation } of context.operations.values()) {
				if (status === "started") {
					//TODO: Handle testnet
					operation.send({ type: "SetCurrentNetwork", network })
				}
			}
		}
	}
}).createMachine({
	id: "bridge",
	initial: "READY",
	context: ({ input: { wallet, currentNetwork } }) => ({
		wallet,
		operations: new Map(),
		sourceNetwork: "mina",
		destinationNetwork: "zeko",
		currentNetwork
	}),
	states: {
		READY: {
			invoke: {
				src: "detectNetworkChange",
				input: ({ context: { wallet } }) => ({ wallet })
			},
			on: {
				ApplyNetworkChange: [
					{
						description:
							"Change the network of all operations and invert direction if the network is different.",
						guard: ({ event, context }) => event.network !== context.currentNetwork,
						//TODO: Handle networks that are not mina or zeko and testnet
						actions: [
							{
								type: "changeOperationNetwork",
								params: ({ event }) => ({
									network: event.network.includes("mina") ? "mina" : "zeko"
								})
							},
							//We assume the user wants to change direction
							assign(({ event }) => ({
								currentNetwork: event.network,
								sourceNetwork: event.network.includes("mina") ? "mina" : "zeko",
								destinationNetwork: event.network.includes("mina") ? "zeko" : "mina"
							}))
						]
					}
				],
				InvertDirection: {
					actions: assign(({ context: { sourceNetwork, destinationNetwork } }) => ({
						sourceNetwork: destinationNetwork,
						destinationNetwork: sourceNetwork
					}))
				},
				StartOperation: {
					actions: {
						type: "startOperation",
						params: ({ event }) => ({ amount: event.amount })
					}
				},
				OperationComplete: {
					actions: {
						type: "completeOperation",
						params: ({ event }) => ({ id: event.id })
					}
				}
			}
		}
	}
})
