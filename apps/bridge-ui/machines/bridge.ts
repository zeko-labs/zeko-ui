import { type Networks, type WalletEmit, detectWalletChange } from "@lumina-dex/sdk"
import type { walletMachine } from "@lumina-dex/sdk"
import { nanoid } from "nanoid"
import { type ActorRefFromLogic, and, assign, enqueueActions, setup, spawnChild } from "xstate"
import { bridgeOperationMachine } from "./bridgeOperation"

type Operations = Map<
	string,
	{
		status: "started" | "completed"
		operation: ActorRefFromLogic<typeof bridgeOperationMachine>
	}
>
type Wallet = ActorRefFromLogic<typeof walletMachine>

type BridgeNetworks = Networks | "invalid"

export type BridgeEvents =
	| { type: "ApplyNetworkChange"; network: Networks }
	| { type: "StartOperation"; amount: string }
	| { type: "CompleteOperation"; id: string }
	| { type: "InvertDirection" }
	| { type: "_InvalidNetworks" }
	| { type: "SetNetworks"; sourceNetwork: Networks; destinationNetwork: Networks }

interface BridgeContext {
	sourceNetwork: BridgeNetworks
	destinationNetwork: BridgeNetworks
	operations: Operations
	wallet: Wallet
}

const currentNetwork = (context: BridgeContext) =>
	context.wallet.getSnapshot().context.currentNetwork

const supportedNetworks = ["mina:testnet", "zeko:testnet"] as const

// Parent Bridge Machine
export const bridgeMachine = setup({
	types: {
		context: {} as BridgeContext,
		input: {} as { wallet: Wallet; currentNetwork: Networks },
		events: {} as BridgeEvents | WalletEmit
	},
	guards: {
		validSource: ({ context }) => supportedNetworks.includes(context.sourceNetwork),
		validDestination: ({ context }) => supportedNetworks.includes(context.destinationNetwork)
	},
	actors: {
		bridgeOperationMachine,
		detectWalletChange
	},
	actions: {
		startOperation: assign(({ context, self, spawn }, { amount }: { amount: string }) => {
			const { wallet } = context
			const sourceNetwork = context.sourceNetwork as Networks
			const destinationNetwork = context.destinationNetwork as Networks
			const id = `bridgeOperation-${Date.now()}-${nanoid(8)}`
			const operation = spawn("bridgeOperationMachine", {
				id,
				systemId: id,
				input: { bridge: self, wallet, sourceNetwork, destinationNetwork, amount }
			})
			operation.send({ type: "StartBridgeOperation" })
			const operations = context.operations.set(id, { status: "started", operation })
			return { operations }
		}),
		completeOperation: assign(({ context }, params: { id: string }) => {
			const { id } = params
			const currentOperation = context.operations.get(id)?.operation
			if (!currentOperation) throw new Error("Operation not found")
			const operations = context.operations.set(id, {
				status: "completed",
				operation: currentOperation
			})
			return { operations }
		})
	}
}).createMachine({
	id: "bridge",
	initial: "READY",
	context: ({ input: { wallet } }) => ({
		wallet,
		operations: new Map(),
		sourceNetwork: "mina:devnet",
		destinationNetwork: "zeko:testnet"
	}),
	entry: spawnChild("detectWalletChange", {
		input: ({ context }) => ({ wallet: context.wallet })
	}),
	on: {
		NetworkChanged: {
			description:
				"Change the network of all operations and invert direction if the network is different.",
			guard: ({ event, context }) => event.network !== currentNetwork(context),
			actions: enqueueActions(({ context, event, enqueue }) => {
				for (const { status, operation } of context.operations.values()) {
					if (status === "started") {
						operation.send({ type: "SetCurrentNetwork", network: event.network })
					}
				}

				if (event.network.includes("testnet")) {
					return enqueue.assign({
						sourceNetwork: event.network.includes("mina") ? "mina:devnet" : "zeko:testnet",
						destinationNetwork: event.network.includes("mina") ? "zeko:testnet" : "mina:devnet"
					})
				}

				const destinationNetwork = supportedNetworks.includes(context.destinationNetwork)
					? context.destinationNetwork
					: supportedNetworks.find((network) => network !== event.network) //First valid network

				enqueue.raise({
					type: "SetNetworks",
					sourceNetwork: event.network,
					destinationNetwork: destinationNetwork as Networks
				})
			})
		},
		SetNetworks: {
			target: ".READY",
			guard: ({ event, context }) =>
				// If the source network is the same, destination must be different
				// If the destination network is the same, source must be different
				(event.sourceNetwork === context.sourceNetwork
					? event.destinationNetwork !== context.destinationNetwork
					: event.destinationNetwork === context.destinationNetwork
						? event.sourceNetwork !== context.sourceNetwork
						: true) &&
				// Both networks must be supported
				supportedNetworks.includes(event.sourceNetwork) &&
				supportedNetworks.includes(event.destinationNetwork) &&
				// Both networks must be different
				event.sourceNetwork !== event.destinationNetwork,
			actions: assign(({ event }) => ({
				sourceNetwork: event.sourceNetwork,
				destinationNetwork: event.destinationNetwork
			}))
		}
	},
	states: {
		READY: {
			on: {
				InvertDirection: {
					actions: assign(({ context: { sourceNetwork, destinationNetwork } }) => ({
						sourceNetwork: destinationNetwork,
						destinationNetwork: sourceNetwork
					}))
				},
				StartOperation: {
					guard: and(["validSource", "validDestination"]),
					actions: { type: "startOperation", params: ({ event }) => ({ amount: event.amount }) }
				},
				CompleteOperation: {
					actions: {
						type: "completeOperation",
						params: ({ event }) => ({ id: event.id })
					}
				},
				_InvalidNetworks: {
					target: "INVALID_NETWORKS",
					actions: assign({ sourceNetwork: "invalid", destinationNetwork: "invalid" })
				}
			}
		},
		INVALID_NETWORKS: {}
	}
})
