import type { After, Direction, Networks, Transfer } from "@lumina-dex/sdk"
import type { walletMachine } from "@lumina-dex/sdk"
import {
	type ActorRef,
	type ActorRefFromLogic,
	type Snapshot,
	assign,
	enqueueActions,
	fromPromise,
	sendTo,
	setup
} from "xstate"
import type { BridgeEvents } from "./bridge"
const wait = (ms = 1000) => new Promise((res) => setTimeout(res, ms))

type SyncedTransfers = { after: After }
type AllTransfers = { transfer: Transfer; afterAll: After }
const isDefined = <T>(value: T) => {
	if (value === undefined) throw new Error("Value is undefined")
	return value
}

type BridgeParent = ActorRef<Snapshot<unknown>, BridgeEvents>

type Wallet = ActorRefFromLogic<typeof walletMachine>
export type ReturnTo =
	| false
	| "CONFIRMING_TRANSFER_REQUEST"
	| "FINDING_ALL_TRANSFERS"
	| "FINDING_SYNCED_TRANSFERS"
	| "CONFIRMING_TRANSFER_CLAIM"

interface BridgeOperationContext {
	bridge: BridgeParent
	wallet: Wallet
	returnTo: ReturnTo
	requestAccountUpdates: string
	claimAccountUpdates: string
	sourceNetwork: Networks
	destinationNetwork: Networks
	changeNetworkTo: Networks
	amount: string
	requestHash: string
	claimHash: string
	claimParameters: {
		transfer?: Transfer
		afterAll?: After
		after?: After
	}
}
const currentNetwork = (context: BridgeOperationContext) =>
	context.wallet.getSnapshot().context.currentNetwork

export const bridgeOperationMachine = setup({
	types: {
		context: {} as BridgeOperationContext,
		input: {} as {
			bridge: BridgeParent
			wallet: Wallet
			sourceNetwork: Networks
			destinationNetwork: Networks
			amount: string
		},
		events: {} as
			| { type: "SetCurrentNetwork"; network: Networks }
			| { type: "StartBridgeOperation" }
			| { type: "ReturnTo" }
	},
	actors: {
		proveTransferRequest: fromPromise<string, { direction: Direction; amount: string }>(
			async () => {
				await wait()
				return "someAccountUpdates"
			}
		),
		confirmTransferRequest: fromPromise<string, { accountUpdates: string }>(async () => {
			await wait()
			return "transactionHash"
		}),
		findAllTransfers: fromPromise(async () => {
			await wait()
			return { transfer: {}, afterAll: {} } as AllTransfers
		}),
		findSyncedTransfers: fromPromise<SyncedTransfers, AllTransfers>(async () => {
			await wait()
			return { after: {} } as SyncedTransfers
		}),
		proveTransferClaim: fromPromise<string, { after: After; direction: Direction }>(async () => {
			return "someAccountUpdates"
		}),
		confirmTransferClaim: fromPromise<string, { accountUpdates: string }>(async () => {
			await wait()
			return "transactionHash"
		})
	},
	guards: {
		currentNetworkIsSource: ({ context }) => currentNetwork(context) === context.sourceNetwork,
		currentNetworkIsDestination: ({ context }) =>
			currentNetwork(context) === context.destinationNetwork,
		toConfirmingTransferRequest: ({ context: { returnTo } }) =>
			returnTo === "CONFIRMING_TRANSFER_REQUEST",
		toFindingAllTransfers: ({ context: { returnTo } }) => returnTo === "FINDING_ALL_TRANSFERS",
		toFindingSyncedTransfers: ({ context: { returnTo } }) =>
			returnTo === "FINDING_SYNCED_TRANSFERS",
		toConfirmingTransferClaim: ({ context: { returnTo } }) =>
			returnTo === "CONFIRMING_TRANSFER_CLAIM"
	}
}).createMachine({
	id: "bridgeOperation",
	initial: "IDLE",
	context: ({ input: { sourceNetwork, destinationNetwork, amount, bridge, wallet } }) => ({
		bridge,
		wallet,
		changeNetworkTo: sourceNetwork,
		sourceNetwork,
		destinationNetwork,
		amount,
		returnTo: false,
		requestAccountUpdates: "",
		claimAccountUpdates: "",
		requestHash: "",
		claimHash: "",
		claimParameters: {}
	}),
	on: {
		SetCurrentNetwork: {
			description:
				"When the parent change the network, we receive the event and raise a return to an action if we can.",
			actions: enqueueActions(({ context, enqueue }) => {
				if (context.returnTo !== false) enqueue.raise({ type: "ReturnTo" })
			})
		}
	},
	states: {
		IDLE: {
			on: { StartBridgeOperation: { target: "PROVING_TRANSFER_REQUEST" } }
		},
		WAITING_FOR_NETWORK: {
			entry: sendTo(
				({ context }) => context.wallet,
				({ context }) => ({
					type: "RequestNetworkChange",
					network: context.changeNetworkTo
				})
			),
			on: {
				ReturnTo: [
					{
						target: "CONFIRMING_TRANSFER_REQUEST",
						guard: "toConfirmingTransferRequest",
						actions: assign({ returnTo: false })
					},
					{
						target: "FINDING_ALL_TRANSFERS",
						guard: "toFindingAllTransfers",
						actions: assign({ returnTo: false })
					},
					{
						target: "FINDING_SYNCED_TRANSFERS",
						guard: "toFindingSyncedTransfers",
						actions: assign({ returnTo: false })
					},
					{
						target: "CONFIRMING_TRANSFER_CLAIM",
						guard: "toConfirmingTransferClaim",
						actions: assign({ returnTo: false })
					}
				]
			}
		},
		PROVING_TRANSFER_REQUEST: {
			invoke: {
				src: "proveTransferRequest",
				input: ({ context }) => ({
					direction: context.destinationNetwork.includes("zeko") ? "DEPOSIT" : "WITHDRAW",
					amount: context.amount
				}),
				onDone: [
					{
						target: "CONFIRMING_TRANSFER_REQUEST",
						description: "Must be started on the source network.",
						actions: assign({
							requestAccountUpdates: ({ event }) => event.output
						}),
						guard: "currentNetworkIsSource"
					},
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "CONFIRMING_TRANSFER_REQUEST",
							changeNetworkTo: ({ context }) => context.sourceNetwork,
							requestAccountUpdates: ({ event }) => event.output
						}),
						guard: "currentNetworkIsDestination"
					}
				]
			}
		},
		CONFIRMING_TRANSFER_REQUEST: {
			invoke: {
				src: "confirmTransferRequest",
				input: ({ context }) => ({
					accountUpdates: context.requestAccountUpdates
				}),
				onDone: [
					{
						target: "FINDING_ALL_TRANSFERS",
						description: "Must be started on the source network.",
						actions: assign(({ event }) => ({ requestHash: event.output })),
						guard: "currentNetworkIsSource"
					},
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "FINDING_ALL_TRANSFERS",
							changeNetworkTo: ({ context }) => context.sourceNetwork,
							requestHash: ({ event }) => event.output
						}),
						guard: "currentNetworkIsDestination"
					}
				]
			}
		},
		FINDING_ALL_TRANSFERS: {
			invoke: {
				src: "findAllTransfers",
				onDone: [
					{
						target: "FINDING_SYNCED_TRANSFERS",
						description: "Must be started on the destination network.",
						actions: assign({
							claimParameters: ({ event }) => ({
								transfer: event.output.transfer,
								afterAll: event.output.afterAll
							})
						}),
						guard: "currentNetworkIsDestination"
					},
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "FINDING_SYNCED_TRANSFERS",
							changeNetworkTo: ({ context }) => context.destinationNetwork,
							claimParameters: ({ event }) => ({
								transfer: event.output.transfer,
								afterAll: event.output.afterAll
							})
						}),
						guard: "currentNetworkIsSource"
					}
				]
			}
		},
		FINDING_SYNCED_TRANSFERS: {
			invoke: {
				src: "findSyncedTransfers",
				input: ({ context }) => ({
					afterAll: isDefined(context.claimParameters.afterAll),
					transfer: isDefined(context.claimParameters.transfer)
				}),
				onDone: {
					target: "PROVING_TRANSFER_CLAIM",
					actions: assign(({ context, event }) => ({
						claimParameters: {
							...context.claimParameters,
							after: event.output.after
						}
					}))
				}
			}
		},
		PROVING_TRANSFER_CLAIM: {
			invoke: {
				src: "proveTransferClaim",
				input: ({ context }) => ({
					direction: context.destinationNetwork.includes("zeko")
						? ("DEPOSIT" as const)
						: ("WITHDRAW" as const),
					after: isDefined(context.claimParameters.after)
				}),
				onDone: [
					{
						target: "CONFIRMING_TRANSFER_CLAIM",
						description: "Must be started on the destination network.",
						actions: assign({
							claimAccountUpdates: ({ event }) => event.output
						}),
						guard: "currentNetworkIsDestination"
					},
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "CONFIRMING_TRANSFER_CLAIM",
							changeNetworkTo: ({ context }) => context.destinationNetwork,
							claimAccountUpdates: ({ event }) => event.output
						}),
						guard: "currentNetworkIsSource"
					}
				]
			}
		},
		CONFIRMING_TRANSFER_CLAIM: {
			invoke: {
				src: "confirmTransferClaim",
				input: ({ context: { claimAccountUpdates } }) => ({
					accountUpdates: claimAccountUpdates
				}),
				onDone: {
					target: "BRIDGE_OPERATION_DONE",
					actions: assign(({ event }) => ({
						accountUpdates: "",
						claimHash: event.output
					}))
				}
			}
		},
		BRIDGE_OPERATION_DONE: {
			type: "final",
			entry: sendTo(
				({ context }) => context.bridge,
				({ self }) => ({ type: "CompleteOperation", id: self.id })
			)
		}
	}
})
