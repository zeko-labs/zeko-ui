import type { EventObject, Networks } from "@lumina-dex/sdk"
import type { walletMachine } from "@lumina-dex/sdk"
import { Bridge } from "@zeko/bridge-sdk"
import { PublicKey, UInt32, UInt64 } from "o1js"
import {
	type ActorRef,
	type ActorRefFromLogic,
	type Snapshot,
	and,
	assign,
	enqueueActions,
	fromCallback,
	fromPromise,
	sendTo,
	setup
} from "xstate"
import type { BridgeEvents } from "./bridge"
import { sendTransaction } from "./helpers"

const bridgeAndWallet = (context: BridgeOperationContext) => {
	const bridge = context.bridge
	if (!bridge) throw new Error("Bridge is not initialized")
	return { bridge, wallet: context.wallet }
}

type BridgeMachine = ActorRef<Snapshot<unknown>, BridgeEvents>

type Wallet = ActorRefFromLogic<typeof walletMachine>
export type ReturnTo = false | "INIT_BRIDGE_OPERATION" | "FINALIZE_DEPOSIT" | "FINALIZE_WITHDRAWAL"

type Direction = "deposit" | "withdrawal"

type Result = Awaited<ReturnType<typeof sendTransaction>>

interface BridgeOperationContext {
	bridgeMachine: BridgeMachine
	bridge: Bridge | null
	wallet: Wallet
	direction: Direction
	amount: string
	source: Networks
	destination: Networks
	paused: boolean
	result: {
		submitDeposit: Result | null
		finalizeDeposit: Result | null
		submitWithdraw: Result | null
		finalizeWithdraw: Result | null
	}
	returnTo: ReturnTo
	changeNetworkTo: Networks
}
const currentNetwork = (context: BridgeOperationContext) =>
	context.wallet.getSnapshot().context.currentNetwork

const POLL_INTERVAL = 20_000
//TODO: Error handling
export const bridgeOperationMachine = setup({
	types: {
		context: {} as BridgeOperationContext,
		input: {} as {
			bridgeMachine: BridgeMachine
			wallet: Wallet
			direction: Direction
			source: Networks
			destination: Networks
			amount: string
		},
		events: {} as
			| { type: "SetCurrentNetwork"; network: Networks }
			| { type: "StartBridgeOperation" }
			| { type: "CompleteBridgeOperation" }
			| { type: "Resume"; paused: boolean }
			| { type: "ReturnTo" }
			| { type: "CanFinalize" }
	},
	actors: {
		initializeBridge: fromPromise<Bridge>(async () => {
			const bridge = await Bridge.init({
				l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
				l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
				zekoUrl: "https://alphanet.zeko.io/graphql",
				l1Network: "testnet",
				l2Network: "testnet",
				pollTimeout: 3_600_000
			})
			return bridge
		}),
		submitDeposit: fromPromise<Result, { bridge: Bridge; amount: string; wallet: Wallet }>(
			async ({ input }) => {
				const { bridge, amount, wallet } = input
				const recipient = PublicKey.fromBase58(wallet.getSnapshot().context.account)
				const tx = await bridge.submitDeposit(
					{ sender: recipient, fee: 0.1 * 10e8 },
					{
						recipient,
						amount: UInt64.from(Number(amount) * 10e8),
						timeout: UInt32.MAXINT(),
						holderAccountL1: bridge.outerHolders[0]
					}
				)
				const result = await sendTransaction({ tx, wallet })
				return result
			}
		),
		pendingDeposit: fromCallback<EventObject, { bridge: Bridge; wallet: Wallet }>(
			({ sendBack, input }) => {
				const { bridge, wallet } = input
				const recipient = PublicKey.fromBase58(wallet.getSnapshot().context.account)
				const checkDepositStatus = async () => {
					console.log("Checking deposit status ...")
					const can = await bridge.canFinalizeDeposit(recipient)
					if (can) sendBack({ type: "CanFinalize" })
				}
				checkDepositStatus()
				const interval = setInterval(checkDepositStatus, POLL_INTERVAL)
				return () => {
					clearInterval(interval)
				}
			}
		),
		finalizeDeposit: fromPromise<Result, { bridge: Bridge; wallet: Wallet }>(async ({ input }) => {
			const { bridge, wallet } = input
			const tx = await bridge.finalizeDeposit(
				PublicKey.fromBase58(wallet.getSnapshot().context.account)
			)
			const result = await sendTransaction({ tx, wallet, sender: bridge.sequencerPk })
			return result
		}),
		submitWithdrawal: fromPromise<Result, { bridge: Bridge; amount: string; wallet: Wallet }>(
			async ({ input }) => {
				const { bridge, amount, wallet } = input
				const recipient = PublicKey.fromBase58(wallet.getSnapshot().context.account)
				const tx = await bridge.submitWithdrawal(
					{ sender: recipient, fee: 0.1 * 10e8 },
					{
						recipient,
						amount: UInt64.from(Number(amount) * 10e8)
					}
				)
				const result = await sendTransaction({ tx, wallet })
				return result
			}
		),
		pendingWithdrawal: fromCallback<EventObject, { bridge: Bridge; wallet: Wallet }>(
			({ sendBack, input }) => {
				const { bridge, wallet } = input
				const recipient = PublicKey.fromBase58(wallet.getSnapshot().context.account)
				const checkWithdrawalStatus = async () => {
					console.log("Checking withdrawal status...")
					const can = await bridge.canFinalizeWithdrawal(recipient)
					if (can) sendBack({ type: "CanFinalize" })
				}
				checkWithdrawalStatus()
				const interval = setInterval(checkWithdrawalStatus, POLL_INTERVAL)
				return () => {
					clearInterval(interval)
				}
			}
		),
		finalizeWithdrawal: fromPromise<string, { bridge: Bridge; wallet: Wallet }>(
			async ({ input }) => {
				const { bridge, wallet } = input
				const recipient = PublicKey.fromBase58(wallet.getSnapshot().context.account)
				const tx = await bridge.finalizeWithdrawal(
					recipient,
					{ sender: recipient, fee: 0.1 * 10e8 },
					bridge.outerHolders[0]
				)
				const result = await sendTransaction({ tx, wallet })
				return result.hash
			}
		)
	},
	guards: {
		currentNetworkIsSource: ({ context }) => currentNetwork(context) === context.source,
		currentNetworkIsDestination: ({ context }) => currentNetwork(context) === context.destination,
		deposit: ({ context }) => context.direction === "deposit",
		withdrawal: ({ context }) => context.direction === "withdrawal",
		toInitBridgeOperation: ({ context: { returnTo } }) => returnTo === "INIT_BRIDGE_OPERATION",
		toFinalizeDeposit: ({ context: { returnTo } }) => returnTo === "FINALIZE_DEPOSIT",
		toFinalizeWithdrawal: ({ context: { returnTo } }) => returnTo === "FINALIZE_WITHDRAWAL"
	}
}).createMachine({
	id: "bridgeOperation",
	initial: "IDLE",
	context: ({ input: { direction, source, destination, amount, bridgeMachine, wallet } }) => ({
		wallet,
		bridgeMachine,
		bridge: null,
		direction,
		changeNetworkTo: source,
		source,
		destination,
		amount,
		returnTo: false,
		paused: false,
		result: {
			submitDeposit: null,
			finalizeDeposit: null,
			submitWithdraw: null,
			finalizeWithdraw: null
		}
	}),
	on: {
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
							({ context }) => ({ type: "RequestNetworkChange", network: context.changeNetworkTo }),
							{ delay: 5000 }
						)
					}
				}
			})
		}
	},
	states: {
		IDLE: {
			on: {
				Resume: { target: "RESUMING", actions: assign({ paused: ({ event }) => event.paused }) },
				CompleteBridgeOperation: { target: "BRIDGE_OPERATION_DONE_NOOP" },
				StartBridgeOperation: [
					{ target: "INIT_BRIDGE_OPERATION", guard: "currentNetworkIsSource" },
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "INIT_BRIDGE_OPERATION",
							changeNetworkTo: ({ context }) => context.source
						}),
						guard: "currentNetworkIsDestination"
					}
				]
			}
		},
		PAUSED: {
			description: "Paused with bridge initialized.",
			on: {
				Resume: { target: "TO_FINALIZE", actions: assign({ paused: ({ event }) => event.paused }) }
			}
		},
		RESUMING: {
			invoke: {
				src: "initializeBridge",
				onDone: { target: "TO_FINALIZE", actions: assign({ bridge: ({ event }) => event.output }) }
			}
		},
		TO_FINALIZE: {
			always: [
				{ target: "PAUSED", guard: ({ context }) => context.paused === true },
				{
					target: "FINALIZE_WITHDRAWAL",
					guard: and(["withdrawal", "currentNetworkIsSource"])
				},
				{
					target: "FINALIZE_DEPOSIT",
					guard: and(["deposit", "currentNetworkIsDestination"])
				},
				{
					target: "WAITING_FOR_NETWORK",
					actions: assign({
						returnTo: "FINALIZE_DEPOSIT",
						changeNetworkTo: ({ context }) => context.destination
					}),
					guard: and(["deposit", "currentNetworkIsSource"])
				},
				{
					target: "WAITING_FOR_NETWORK",
					actions: assign({
						returnTo: "FINALIZE_WITHDRAWAL",
						changeNetworkTo: ({ context }) => context.source
					}),
					guard: and(["withdrawal", "currentNetworkIsDestination"])
				}
			]
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
					}
				]
			}
		},
		INIT_BRIDGE_OPERATION: {
			invoke: {
				src: "initializeBridge",
				onDone: [
					{
						target: "SUBMIT_DEPOSIT",
						guard: ({ context }) => context.direction === "deposit",
						actions: assign({ bridge: ({ event }) => event.output })
					},
					{
						target: "SUBMIT_WITHDRAWAL",
						guard: ({ context }) => context.direction === "withdrawal",
						actions: assign({ bridge: ({ event }) => event.output })
					}
				]
			}
		},
		SUBMIT_DEPOSIT: {
			invoke: {
				src: "submitDeposit",
				input: ({ context }) => ({ ...bridgeAndWallet(context), amount: context.amount }),
				onDone: [
					{
						target: "PENDING_DEPOSIT",
						actions: assign(({ context, event }) => ({
							result: { ...context.result, submitDeposit: event.output }
						}))
					}
				]
			}
		},
		PENDING_DEPOSIT: {
			invoke: {
				src: "pendingDeposit",
				input: ({ context }) => ({ ...bridgeAndWallet(context), amount: context.amount })
			},
			on: {
				CanFinalize: [
					{ target: "FINALIZE_DEPOSIT", guard: "currentNetworkIsDestination" },
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "FINALIZE_DEPOSIT",
							changeNetworkTo: ({ context }) => context.destination
						}),
						guard: "currentNetworkIsSource"
					}
				]
			}
		},
		FINALIZE_DEPOSIT: {
			invoke: {
				src: "finalizeDeposit",
				input: ({ context }) => ({ ...bridgeAndWallet(context) }),
				onDone: {
					target: "BRIDGE_OPERATION_DONE",
					actions: assign(({ context, event }) => ({
						result: { ...context.result, finalizeDeposit: event.output }
					}))
				}
			}
		},
		SUBMIT_WITHDRAWAL: {
			invoke: {
				src: "submitWithdrawal",
				input: ({ context }) => ({ ...bridgeAndWallet(context), amount: context.amount }),
				onDone: [
					{
						target: "PENDING_WITHDRAWAL",
						actions: assign(({ context, event }) => ({
							result: { ...context.result, submitWithdrawal: event.output }
						}))
					}
				]
			}
		},
		PENDING_WITHDRAWAL: {
			invoke: {
				src: "pendingWithdrawal",
				input: ({ context }) => ({ ...bridgeAndWallet(context), amount: context.amount })
			},
			on: {
				CanFinalize: [
					{ target: "FINALIZE_WITHDRAWAL", guard: "currentNetworkIsSource" },
					{
						target: "WAITING_FOR_NETWORK",
						actions: assign({
							returnTo: "FINALIZE_WITHDRAWAL",
							changeNetworkTo: ({ context }) => context.source
						}),
						guard: "currentNetworkIsDestination"
					}
				]
			}
		},
		FINALIZE_WITHDRAWAL: {
			invoke: {
				src: "finalizeWithdrawal",
				input: ({ context }) => ({ ...bridgeAndWallet(context) }),
				onDone: {
					target: "BRIDGE_OPERATION_DONE",
					actions: assign(({ context, event }) => ({
						result: { ...context.result, finalizeWithdrawal: event.output }
					}))
				}
			}
		},
		BRIDGE_OPERATION_DONE: {
			type: "final",
			entry: sendTo(
				({ context }) => context.bridgeMachine,
				({ self }) => ({ type: "CompleteOperation", id: self.id })
			)
		},
		BRIDGE_OPERATION_DONE_NOOP: { type: "final" }
	}
})
