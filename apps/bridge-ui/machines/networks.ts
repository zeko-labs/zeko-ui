import type { Networks as WalletNetwork } from "@lumina-dex/sdk"
import {
	BRIDGE_NETWORK_TO_WALLET_ZEKO_NETWORK,
	BRIDGE_UI_NETWORKS,
	MINA_NETWORKS,
	type BridgeUiNetwork,
	WALLET_ZEKO_NETWORK_TO_BRIDGE_NETWORK,
	ZEKO_M_NETWORKS
} from "@zeko/networks"

export type BridgeNetwork = BridgeUiNetwork

export const supportedNetworks = BRIDGE_UI_NETWORKS

export const isMainnetBridgeNetwork = (network: BridgeNetwork) =>
	network === MINA_NETWORKS.mainnet || network === ZEKO_M_NETWORKS.mainnet
export const isMinaBridgeNetwork = (network: BridgeNetwork) =>
	network === MINA_NETWORKS.devnet || network === MINA_NETWORKS.mainnet
export const isZekoBridgeNetwork = (network: BridgeNetwork) =>
	network === ZEKO_M_NETWORKS.testnet || network === ZEKO_M_NETWORKS.mainnet

export const walletNetworkToBridgeNetwork = (network: WalletNetwork): BridgeNetwork => {
	switch (network) {
		case MINA_NETWORKS.devnet:
		case MINA_NETWORKS.mainnet:
			return network
		case "zeko:testnet":
			return WALLET_ZEKO_NETWORK_TO_BRIDGE_NETWORK[network]
		case "zeko:mainnet":
			return WALLET_ZEKO_NETWORK_TO_BRIDGE_NETWORK[network]
	}
}

export const bridgeNetworkToWalletNetwork = (network: BridgeNetwork): WalletNetwork => {
	switch (network) {
		case MINA_NETWORKS.devnet:
		case MINA_NETWORKS.mainnet:
			return network
		case ZEKO_M_NETWORKS.testnet:
			return BRIDGE_NETWORK_TO_WALLET_ZEKO_NETWORK[network]
		case ZEKO_M_NETWORKS.mainnet:
			return BRIDGE_NETWORK_TO_WALLET_ZEKO_NETWORK[network]
	}
}
