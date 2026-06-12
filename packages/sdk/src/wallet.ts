import type { AuroWalletNetwork } from "@zeko/networks"
import { enableMapSet, produce } from "immer"
import { Mina } from "o1js"
import {
	type ActorOptions,
	type ActorRefFromLogic,
	type AnyStateMachine,
	assertEvent,
	assign,
	type ConditionalRequired,
	createActor,
	type EventObject,
	emit,
	enqueueActions,
	fromCallback,
	fromPromise,
	type IsNotNever,
	type RequiredActorOptionsKeys,
	setup
} from "xstate"

import { type Balance, type CustomToken, emptyNetworkBalance, fetchBalance } from "./balance"
import type { WalletEmit, WalletEvent } from "./events"
import { logger } from "./logger"
import {
	AURO_NETWORK_LABELS,
	AURO_NETWORKS,
	minaNetwork,
	switchAuroNetwork,
	toAuroNetwork
} from "./networks"
import { getAuroProvider, isProviderError } from "./provider"

enableMapSet()

type MachineOptions<Machine extends AnyStateMachine> = ConditionalRequired<
	[options?: ActorOptions<Machine> & { [K in RequiredActorOptionsKeys<Machine>]: unknown }],
	IsNotNever<RequiredActorOptionsKeys<Machine>>
>

const createWalletMachineLogic = () =>
	setup({
		types: {
			context: {} as {
				account: string
				currentNetwork: AuroWalletNetwork
				balances: Balance
				lastUpdated: Map<string, number>
			},
			emitted: {} as WalletEmit,
			events: {} as WalletEvent
		},
		actors: {
			fetchBalance,
			listenToWalletChange: fromCallback<WalletEvent>(({ sendBack }) => {
				const provider = getAuroProvider()
				if (!provider) {
					sendBack({ type: "WalletExtensionNotDetected" })
					return () => {
						logger.error("No Auro Wallet detected")
					}
				}
				provider.on("chainChanged", (chainInfo) => {
					sendBack({
						type: "WalletExtensionChangedNetwork",
						network: toAuroNetwork(chainInfo.networkID)
					})
				})
				provider.on("accountsChanged", (accounts) => {
					if (accounts.length === 0) sendBack({ type: "Disconnect" })
					if (accounts.length > 0) sendBack({ type: "SetAccount", account: accounts[0] })
				})
				return () => {
					provider.removeAllListeners()
				}
			}),
			connectWallet: fromPromise<{
				currentNetwork: AuroWalletNetwork
				account: string
			}>(async () => {
				const provider = getAuroProvider()
				if (!provider) throw new Error("No Auro Wallet detected")
				const accounts = await provider.requestAccounts()
				if (isProviderError(accounts)) throw accounts
				const [account] = accounts
				if (!account) throw new Error("No Auro Wallet account selected")
				const network = await provider.requestNetwork()
				if (isProviderError(network)) throw network
				return { currentNetwork: toAuroNetwork(network.networkID), account }
			}),
			changeNetwork: fromPromise<
				{ currentNetwork: AuroWalletNetwork },
				{ switchTo: AuroWalletNetwork }
			>(async ({ input: { switchTo } }) => {
				const provider = getAuroProvider()
				if (!provider) throw new Error("No Auro Wallet detected")
				const { network } = await switchAuroNetwork(provider, switchTo)
				return { currentNetwork: network }
			})
		},
		actions: {
			setWalletNetwork: enqueueActions(
				({ enqueue }, { network }: { network: AuroWalletNetwork }) => {
					Mina.setActiveInstance(minaNetwork(network))
					logger.success("Auro Wallet network set to", AURO_NETWORK_LABELS[network])
					enqueue.assign({ currentNetwork: network })
					enqueue.emit({ type: "NetworkChanged", network })
				}
			),
			spawnBalanceUpdate: enqueueActions(
				(
					{ enqueue, context },
					{ tokens, network }: { tokens: CustomToken[]; network: AuroWalletNetwork }
				) => {
					if (!context.account) {
						logger.info("Skipping balance fetch: no connected account")
						return
					}

					const lastUpdated = context.lastUpdated.get(JSON.stringify({ network, tokens })) ?? 0
					if (Date.now() - lastUpdated < 1_000) return

					const id = crypto.randomUUID()
					const input = { id, address: context.account, tokens, network }

					enqueue.spawnChild("fetchBalance", { id, input })
					enqueue.assign(
						produce(context, (draft) => {
							draft.lastUpdated.set(JSON.stringify({ network, tokens }), Date.now())
						})
					)
				}
			)
		}
	}).createMachine({
		id: "wallet",
		context: {
			account: "",
			currentNetwork: AURO_NETWORKS.minaDevnet,
			balances: emptyNetworkBalance(),
			lastUpdated: new Map()
		},
		initial: "INIT",
		invoke: { src: "listenToWalletChange" },
		on: {
			WalletExtensionNotDetected: {
				target: ".UNSUPPORTED",
				actions: emit({ type: "NoMinaWalletDetected" })
			},
			WalletExtensionChangedNetwork: {
				guard: ({ context, event }) => context.currentNetwork !== event.network,
				actions: enqueueActions(({ enqueue, event }) => {
					enqueue({ type: "setWalletNetwork", params: { network: event.network } })
					enqueue({ type: "spawnBalanceUpdate", params: { network: event.network, tokens: [] } })
				})
			},
			SetAccount: {
				actions: enqueueActions(({ context, enqueue, event }) => {
					enqueue.assign({ account: event.account })
					enqueue.emit({ type: "AccountChanged", account: event.account })
					enqueue({
						type: "spawnBalanceUpdate",
						params: { network: context.currentNetwork, tokens: [] }
					})
				})
			},
			Disconnect: { target: ".INIT", actions: assign({ account: "" }) },
			FetchBalance: [
				{
					guard: ({ context }) => !!context.account,
					actions: enqueueActions(({ enqueue, event: { network, tokens } }) => {
						enqueue({ type: "spawnBalanceUpdate", params: { network, tokens } })
					})
				},
				{
					actions: () => {
						logger.info("Ignoring balance fetch: wallet not connected")
					}
				}
			],
			FetchBalanceSuccess: {
				actions: enqueueActions(({ enqueue, context, event }) => {
					enqueue.assign(
						produce(context, (draft) => {
							for (const [network, balances] of Object.entries(event.balances)) {
								Object.assign(draft.balances[network as AuroWalletNetwork], balances)
							}
						})
					)
					enqueue.stopChild(event.id)
				})
			},
			FetchBalanceFailure: {
				actions: enqueueActions(({ enqueue, event }) => {
					enqueue.stopChild(event.id)
				})
			}
		},
		states: {
			INIT: {
				on: { Connect: { target: "CONNECTING" } }
			},
			CONNECTING: {
				invoke: {
					src: "connectWallet",
					onDone: {
						target: "READY",
						actions: enqueueActions(({ enqueue, event }) => {
							enqueue({
								type: "setWalletNetwork",
								params: { network: event.output.currentNetwork }
							})
							enqueue.raise({ type: "SetAccount", account: event.output.account })
						})
					},
					onError: {
						target: "INIT",
						actions: () => {
							logger.error("Auro Wallet connection failed")
						}
					}
				}
			},
			READY: {
				on: {
					RequestNetworkChange: [
						{
							target: "SWITCHING_NETWORK",
							guard: ({ context, event }) => context.currentNetwork !== event.network
						},
						{
							guard: ({ context, event }) => context.currentNetwork === event.network,
							actions: emit(({ event }) => ({ type: "NetworkChanged", network: event.network }))
						}
					]
				}
			},
			SWITCHING_NETWORK: {
				invoke: {
					src: "changeNetwork",
					input: ({ event }) => {
						assertEvent(event, "RequestNetworkChange")
						return { switchTo: event.network }
					},
					onDone: {
						target: "READY",
						actions: enqueueActions(({ enqueue, event }) => {
							enqueue({
								type: "setWalletNetwork",
								params: { network: event.output.currentNetwork }
							})
							enqueue({
								type: "spawnBalanceUpdate",
								params: { network: event.output.currentNetwork, tokens: [] }
							})
						})
					},
					onError: {
						target: "READY",
						actions: () => {
							logger.error("Auro Wallet network switch failed")
						}
					}
				}
			},
			UNSUPPORTED: { type: "final" }
		}
	})

export const createWalletMachine = (): AnyStateMachine => createWalletMachineLogic()

export const walletMachine: AnyStateMachine = createWalletMachineLogic()
export type WalletMachine = typeof walletMachine
export type WalletActorRef = ActorRefFromLogic<WalletMachine>
export type WalletActor = ReturnType<typeof createActor<WalletMachine>>

export const createWallet = (...[options]: MachineOptions<WalletMachine>): WalletActor =>
	createActor(walletMachine, options).start()

export const detectWalletChange = fromCallback<EventObject, { wallet: WalletActorRef }, WalletEmit>(
	({ sendBack, input: { wallet } }) => {
		if (wallet.getSnapshot().matches("UNSUPPORTED")) {
			sendBack({ type: "NoMinaWalletDetected" })
		}

		const networkSubscription = wallet.on(
			"NetworkChanged",
			(emitted: Extract<WalletEmit, { type: "NetworkChanged" }>) => {
				sendBack({ type: "NetworkChanged", network: emitted.network })
			}
		)
		const accountSubscription = wallet.on(
			"AccountChanged",
			(emitted: Extract<WalletEmit, { type: "AccountChanged" }>) => {
				sendBack({ type: "AccountChanged", account: emitted.account })
			}
		)

		return () => {
			networkSubscription.unsubscribe()
			accountSubscription.unsubscribe()
		}
	}
)
