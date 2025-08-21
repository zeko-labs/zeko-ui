import type { Networks, walletMachine } from "@lumina-dex/sdk"
import { Bridge } from "@zeko/bridge-sdk"
import { PublicKey, UInt32, UInt64 } from "o1js"
import {
	type ActionArgs,
	type ActorRef,
	type ActorRefFromLogic,
	type ErrorActorEvent,
	type EventObject,
	type Snapshot,
	and,
	assign,
	enqueueActions,
	fromCallback,
	fromPromise,
	sendTo,
	setup
} from "xstate"
import type { BridgeContext, BridgeEvents } from "./bridge"
import { sendTransaction } from "./helpers"
import type { ActionState } from "./operations.worker"

const bridgeAndWallet = (context: BridgeOperationContext) => {
	const bridge = context.bridge
	if (!bridge) throw new Error("Bridge is not initialized")
	return { bridge, wallet: context.wallet }
}

const addError =
	(e: Error) =>
	({ context }: ActionArgs<BridgeOperationContext, ErrorActorEvent, BridgeOperationEvents>) => {
		console.error(e)
		return { errors: [...context.errors, e] }
	}

type BridgeMachine = ActorRef<Snapshot<unknown> & { context: BridgeContext }, BridgeEvents>

type Wallet = ActorRefFromLogic<typeof walletMachine>
export type ReturnTo = false | "INIT_BRIDGE_OPERATION" | "FINALIZE_DEPOSIT" | "FINALIZE_WITHDRAWAL"

type Direction = "deposit" | "withdrawal"

type Result = Awaited<ReturnType<typeof sendTransaction>>

type BridgeOperationEvents =
	| { type: "SetCurrentNetwork"; network: Networks }
	| { type: "StartBridgeOperation" }
	| { type: "CompleteBridgeOperation" }
	| { type: "Resume"; paused: boolean }
	| { type: "Pause" }
	| { type: "ReturnTo" }
	| { type: "CanFinalize" }
	| { type: "Finalize" }

interface BridgeOperationContext {
	id: string
	bridgeMachine: BridgeMachine
	bridge: Bridge | null
	wallet: Wallet
	direction: Direction
	amount: string
	source: Networks
	destination: Networks
	paused: boolean
	transaction?: ActionState["transaction"]
	errors: Error[]
	result: {
		submitDeposit: Result | null
		finalizeDeposit: Result | null
		submitWithdrawal: Result | null
		finalizeWithdrawal: Result | null
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
			transaction?: ActionState["transaction"]
		},
		events: {} as BridgeOperationEvents
	},
	actors: {
		initializeBridge: fromPromise<Bridge>(async () => {
			//TODO: Initialize with the correct config
			const bridge = await Bridge.init({
				l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
				l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
				zekoUrl: "https://alphanet.zeko.io/graphql",
				zekoArchiveUrl: "https://archive.alphanet.zeko.io/graphql",
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
		finalizeWithdrawal: fromPromise<Result, { bridge: Bridge; wallet: Wallet }>(
			async ({ input }) => {
				const { bridge, wallet } = input
				const recipient = PublicKey.fromBase58(wallet.getSnapshot().context.account)
				const tx = await bridge.finalizeWithdrawal(
					recipient,
					{ sender: recipient, fee: 0.1 * 10e8 },
					bridge.outerHolders[0]
				)
				const result = await sendTransaction({ tx, wallet })
				return result
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
		toFinalizeWithdrawal: ({ context: { returnTo } }) => returnTo === "FINALIZE_WITHDRAWAL",
		anotherOperationIsActive: ({ context }) => {
			const ao = context.bridgeMachine.getSnapshot().context.activeOperation
			return ao !== null && context.id !== ao
		}
	}
}).createMachine({
	id: "bridgeOperation",
	initial: "IDLE",
	context: ({
		input: { direction, source, destination, amount, bridgeMachine, wallet, transaction },
		self: { id }
	}) => ({
		id,
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
		transaction,
		errors: [],
		result: {
			submitDeposit: null,
			finalizeDeposit: null,
			submitWithdrawal: null,
			finalizeWithdrawal: null
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
				Pause: { target: "PAUSED", actions: assign({ paused: true }) },
				CompleteBridgeOperation: { target: "BRIDGE_OPERATION_DONE_NOOP" },
				StartBridgeOperation: [
					{ target: "INIT_BRIDGE_OPERATION", guard: "currentNetworkIsSource" },
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
			always: [{ target: "PAUSED", guard: ({ context }) => context.paused === true }],
			on: {
				Finalize: [
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
						guard: and(["deposit", "currentNetworkIsSource"]),
						actions: assign({
							returnTo: "FINALIZE_DEPOSIT",
							changeNetworkTo: ({ context }) => context.destination
						})
					},
					{
						target: "WAITING_FOR_NETWORK",
						guard: and(["withdrawal", "currentNetworkIsDestination"]),
						actions: assign({
							returnTo: "FINALIZE_WITHDRAWAL",
							changeNetworkTo: ({ context }) => context.source
						})
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
						target: "PAUSED",
						guard: "anotherOperationIsActive",
						actions: [
							sendTo(
								({ context }) => context.bridgeMachine,
								({ self }) => ({ type: "PauseOperation", id: self.id })
							),
							assign({ paused: true })
						]
					},
					{
						target: "PENDING_DEPOSIT",
						actions: assign(({ context, event }) => ({
							result: { ...context.result, submitDeposit: event.output }
						}))
					}
				],
				onError: {
					target: "FAILED",
					actions: sendTo(
						({ context }) => context.bridgeMachine,
						({ self }) => ({ type: "TerminateOperation", id: self.id })
					)
				}
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
						guard: "currentNetworkIsSource",
						actions: assign({
							returnTo: "FINALIZE_DEPOSIT",
							changeNetworkTo: ({ context }) => context.destination
						})
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
				},
				onError: [
					{
						target: "FAILED",
						guard: ({ context }) => context.errors.length > 3,
						actions: assign(addError(new Error("Failed to finalize deposit")))
					},
					{
						target: "PENDING_DEPOSIT",
						actions: assign(addError(new Error("Failed to finalize deposit")))
					}
				]
			}
		},
		SUBMIT_WITHDRAWAL: {
			invoke: {
				src: "submitWithdrawal",
				input: ({ context }) => ({ ...bridgeAndWallet(context), amount: context.amount }),
				onDone: [
					{
						target: "PAUSED",
						guard: "anotherOperationIsActive",
						actions: [
							sendTo(
								({ context }) => context.bridgeMachine,
								({ self }) => ({ type: "PauseOperation", id: self.id })
							),
							assign({ paused: true })
						]
					},
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
						guard: "currentNetworkIsDestination",
						actions: assign({
							returnTo: "FINALIZE_WITHDRAWAL",
							changeNetworkTo: ({ context }) => context.source
						})
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
				},
				onError: [
					{
						target: "FAILED",
						guard: ({ context }) => context.errors.length > 3,
						actions: assign(addError(new Error("Failed to finalize withdrawal")))
					},
					{
						target: "PENDING_WITHDRAWAL",
						actions: assign(addError(new Error("Failed to finalize withdrawal")))
					}
				]
			}
		},
		BRIDGE_OPERATION_DONE: {
			type: "final",
			entry: sendTo(
				({ context }) => context.bridgeMachine,
				({ self }) => ({ type: "CompleteOperation", id: self.id })
			)
		},
		BRIDGE_OPERATION_DONE_NOOP: { type: "final" },
		FAILED: { type: "final" }
	}
})
