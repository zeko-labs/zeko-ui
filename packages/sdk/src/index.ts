import type { ProviderError } from "@aurowallet/mina-provider"
import {
	AURO_ZEKO_NETWORKS,
	type AuroWalletNetwork,
	type BridgeUiNetwork,
	bridgeNetworkToWalletNetwork,
	MINA_NETWORKS
} from "@zeko/networks"
import { createConsola } from "consola"
import { enableMapSet, produce } from "immer"
import { Mina, PublicKey, TokenId } from "o1js"
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

enableMapSet()

export const AURO_NETWORKS = {
	minaDevnet: MINA_NETWORKS.devnet,
	minaMainnet: MINA_NETWORKS.mainnet,
	zekoTestnet: AURO_ZEKO_NETWORKS.testnet,
	zekoMainnet: AURO_ZEKO_NETWORKS.mainnet
} as const satisfies Record<string, AuroWalletNetwork>

export const AURO_NETWORK_LABELS = {
	[AURO_NETWORKS.minaDevnet]: "Mina Devnet",
	[AURO_NETWORKS.minaMainnet]: "Mina Mainnet",
	[AURO_NETWORKS.zekoTestnet]: "Zeko Testnet",
	[AURO_NETWORKS.zekoMainnet]: "Zeko Mainnet"
} as const satisfies Record<AuroWalletNetwork, string>

export const AURO_NETWORK_URLS = {
	[AURO_NETWORKS.minaDevnet]: "https://gateway.mina.devnet.zeko.io",
	[AURO_NETWORKS.minaMainnet]: "https://gateway.mina.mainnet.zeko.io",
	[AURO_NETWORKS.zekoTestnet]: "https://testnet.zeko.io/graphql",
	[AURO_NETWORKS.zekoMainnet]: "https://mainnet.zeko.io/graphql"
} as const satisfies Record<AuroWalletNetwork, string>

export const AURO_NETWORK_ARCHIVE_URLS = {
	[AURO_NETWORKS.minaDevnet]: "https://gateway.mina.archive.devnet.zeko.io",
	[AURO_NETWORKS.minaMainnet]: "https://gateway.mina.archive.mainnet.zeko.io",
	[AURO_NETWORKS.zekoTestnet]: "https://archive.testnet.zeko.io/graphql",
	[AURO_NETWORKS.zekoMainnet]: "https://archive.mainnet.zeko.io/graphql"
} as const satisfies Record<AuroWalletNetwork, string>

export const AURO_ADD_CHAIN_BY_NETWORK = {
	[AURO_NETWORKS.minaDevnet]: {
		name: AURO_NETWORK_LABELS[AURO_NETWORKS.minaDevnet],
		url: AURO_NETWORK_URLS[AURO_NETWORKS.minaDevnet]
	},
	[AURO_NETWORKS.minaMainnet]: {
		name: AURO_NETWORK_LABELS[AURO_NETWORKS.minaMainnet],
		url: AURO_NETWORK_URLS[AURO_NETWORKS.minaMainnet]
	},
	[AURO_NETWORKS.zekoTestnet]: {
		name: AURO_NETWORK_LABELS[AURO_NETWORKS.zekoTestnet],
		url: AURO_NETWORK_URLS[AURO_NETWORKS.zekoTestnet]
	},
	[AURO_NETWORKS.zekoMainnet]: {
		name: AURO_NETWORK_LABELS[AURO_NETWORKS.zekoMainnet],
		url: AURO_NETWORK_URLS[AURO_NETWORKS.zekoMainnet]
	}
} as const satisfies Record<AuroWalletNetwork, { name: string; url: string }>

export type AuroProvider = {
	requestAccounts: () => Promise<string[] | ProviderError>
	requestNetwork: () => Promise<{ networkID: string } | ProviderError>
	switchChain: (args: { networkID: string }) => Promise<{ networkID: string } | ProviderError>
	addChain: (args: { url: string; name: string }) => Promise<{ networkID: string } | ProviderError>
	on: {
		(event: "chainChanged", listener: (chainInfo: { networkID: string }) => void): void
		(event: "accountsChanged", listener: (accounts: string[]) => void): void
	}
	removeAllListeners: () => void
}

type MachineOptions<Machine extends AnyStateMachine> = ConditionalRequired<
	[options?: ActorOptions<Machine> & { [K in RequiredActorOptionsKeys<Machine>]: unknown }],
	IsNotNever<RequiredActorOptionsKeys<Machine>>
>

const logger = createConsola({ level: 5 }).withTag("Zeko SDK")

const isProviderError = (value: unknown): value is ProviderError =>
	typeof value === "object" &&
	value !== null &&
	"code" in value &&
	typeof (value as { code: unknown }).code === "number"

const isAuroWalletNetwork = (networkId: string): networkId is AuroWalletNetwork =>
	Object.values(AURO_NETWORKS).includes(networkId as AuroWalletNetwork)

const toAuroNetwork = (networkId: string): AuroWalletNetwork => {
	if (isAuroWalletNetwork(networkId)) return networkId
	logger.info("Unknown Auro network, falling back to Mina Devnet", networkId)
	return AURO_NETWORKS.minaDevnet
}

const getAuroProvider = () => (globalThis as { window?: { mina?: AuroProvider } }).window?.mina

const minaNetwork = (network: AuroWalletNetwork) =>
	Mina.Network({
		networkId:
			network === AURO_NETWORKS.minaMainnet || network === AURO_NETWORKS.zekoMainnet
				? "mainnet"
				: "testnet",
		mina: AURO_NETWORK_URLS[network],
		archive: AURO_NETWORK_ARCHIVE_URLS[network],
		bypassTransactionLimits:
			network === AURO_NETWORKS.zekoTestnet || network === AURO_NETWORKS.zekoMainnet
	})

export const bridgeNetworkToAuroNetwork = (network: BridgeUiNetwork): AuroWalletNetwork =>
	bridgeNetworkToWalletNetwork(network)

export const switchAuroNetwork = async (
	provider: Pick<AuroProvider, "switchChain" | "addChain">,
	network: BridgeUiNetwork | AuroWalletNetwork
): Promise<{ network: AuroWalletNetwork }> => {
	const targetNetwork = isAuroWalletNetwork(network)
		? network
		: bridgeNetworkToAuroNetwork(network as BridgeUiNetwork)
	const switchResult = await provider
		.switchChain({ networkID: targetNetwork })
		.catch((error: unknown) => error as ProviderError)

	if (!isProviderError(switchResult) && switchResult.networkID === targetNetwork) {
		return { network: targetNetwork }
	}

	await provider.addChain(AURO_ADD_CHAIN_BY_NETWORK[targetNetwork])
	const retryResult = await provider.switchChain({ networkID: targetNetwork })
	if (isProviderError(retryResult)) throw retryResult
	if (retryResult.networkID !== targetNetwork) {
		throw new Error(`Auro Wallet did not switch to ${AURO_NETWORK_LABELS[targetNetwork]}.`)
	}

	return { network: targetNetwork }
}

type TokenIdentifier = string

interface TokenInfo {
	symbol: string
	balance: number
}

export type Balance = Record<AuroWalletNetwork, Record<TokenIdentifier, TokenInfo>>

export type CustomToken = SimpleToken | PoolToken

export interface SimpleToken {
	address: string
	symbol: string
	decimal: number
	tokenId: string
}

export interface PoolToken {
	poolAddress: string
	decimal: number
	symbol: string
}

export interface FetchBalanceInput {
	address: string
	tokens: CustomToken[]
	network: AuroWalletNetwork
}

export type WalletEvent =
	| { type: "RequestNetworkChange"; network: AuroWalletNetwork }
	| { type: "WalletExtensionChangedNetwork"; network: AuroWalletNetwork }
	| { type: "Connect" }
	| { type: "Disconnect" }
	| { type: "SetAccount"; account: string }
	| { type: "FetchBalance"; network: AuroWalletNetwork; tokens: CustomToken[] }
	| { type: "FetchBalanceSuccess"; balances: Partial<Balance>; id: string }
	| { type: "FetchBalanceFailure"; id: string }
	| { type: "WalletExtensionNotDetected" }

export type WalletEmit =
	| { type: "NetworkChanged"; network: AuroWalletNetwork }
	| { type: "AccountChanged"; account: string }
	| { type: "NoMinaWalletDetected" }

const emptyNetworkBalance = (): Balance => ({
	[AURO_NETWORKS.minaMainnet]: { MINA: { symbol: "MINA", balance: 0 } },
	[AURO_NETWORKS.minaDevnet]: { MINA: { symbol: "MINA", balance: 0 } },
	[AURO_NETWORKS.zekoTestnet]: { MINA: { symbol: "MINA", balance: 0 } },
	[AURO_NETWORKS.zekoMainnet]: { MINA: { symbol: "MINA", balance: 0 } }
})

const toNumber = (value: unknown) => {
	if (typeof value === "number") return value
	if (typeof value !== "string") return 0
	const parsed = Number.parseFloat(value)
	return Number.isNaN(parsed) ? 0 : parsed
}

const fetchAccountBalance = async ({
	address,
	network,
	tokenId
}: {
	address: string
	network: AuroWalletNetwork
	tokenId?: string
}) => {
	const response = await fetch(AURO_NETWORK_URLS[network], {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			query: `query AccountBalance($publicKey: PublicKey!, $tokenId: Field) {
				account(publicKey: $publicKey, tokenId: $tokenId) {
					balance { total }
				}
			}`,
			variables: { publicKey: address, tokenId: tokenId ?? null }
		})
	})
	if (!response.ok)
		throw new Error(`Unable to fetch account balance from ${AURO_NETWORK_LABELS[network]}.`)
	const data = (await response.json()) as {
		data?: { account?: { balance?: { total?: string | number } } }
	}
	return toNumber(data.data?.account?.balance?.total)
}

const fetchBalanceLogic = async ({
	address,
	tokens,
	network
}: FetchBalanceInput): Promise<Partial<Balance>> => {
	const mina = { symbol: "MINA", decimal: 1e9, tokenId: undefined }
	const allTokens = [
		mina,
		...tokens
			.filter((token) => token.symbol !== "MINA")
			.map((token) => ({
				symbol: token.symbol,
				decimal: token.decimal,
				tokenId:
					"poolAddress" in token
						? TokenId.toBase58(TokenId.derive(PublicKey.fromBase58(token.poolAddress)))
						: token.tokenId
			}))
	]

	const entries = await Promise.all(
		allTokens.map(async (token) => {
			const total = await fetchAccountBalance({ address, network, tokenId: token.tokenId })
			return [
				token.tokenId ?? "MINA",
				{ balance: total / token.decimal, symbol: token.symbol }
			] as const
		})
	)

	return { [network]: Object.fromEntries(entries) }
}

export const fetchBalance = fromCallback<
	WalletEvent,
	FetchBalanceInput & { id: string },
	WalletEmit
>(({ sendBack, input }) => {
	const { id, ...params } = input
	const fetchBalance = async () => {
		try {
			sendBack({ type: "FetchBalanceSuccess", id, balances: await fetchBalanceLogic(params) })
		} catch (error) {
			logger.error("fetchBalance error:", error)
			sendBack({ type: "FetchBalanceFailure", id })
		}
	}
	fetchBalance()
	return () => {}
})

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

export type { AuroWalletNetwork as Networks }
