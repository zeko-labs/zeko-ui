import type { ProviderError } from "@aurowallet/mina-provider"
import {
	AURO_NETWORK_LABELS,
	AURO_NETWORKS,
	type AuroWalletNetwork,
	type BridgeUiNetwork,
	bridgeNetworkToWalletNetwork
} from "@zeko/networks"
import { Mina } from "o1js"

import { logger } from "./logger"
import type { AuroProvider } from "./provider"
import { isProviderError } from "./provider"

export { AURO_NETWORK_LABELS, AURO_NETWORKS } from "@zeko/networks"

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

export const isAuroWalletNetwork = (networkId: string): networkId is AuroWalletNetwork =>
	Object.values(AURO_NETWORKS).includes(networkId as AuroWalletNetwork)

export const toAuroNetwork = (networkId: string): AuroWalletNetwork => {
	if (isAuroWalletNetwork(networkId)) return networkId
	logger.info("Unknown Auro network, falling back to Mina Devnet", networkId)
	return AURO_NETWORKS.minaDevnet
}

export const minaNetwork = (network: AuroWalletNetwork) =>
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
		.catch((error: unknown) => error as { networkID: string } | ProviderError)

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
