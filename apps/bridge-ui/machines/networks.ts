export type {
	BridgeUiNetwork as BridgeNetwork,
	AuroWalletNetwork as WalletNetwork
} from "@zeko/networks"
export {
	BRIDGE_UI_NETWORKS as supportedNetworks,
	bridgeNetworkToWalletNetwork,
	isMainnetBridgeNetwork,
	isMinaBridgeNetwork,
	isZekoBridgeNetwork,
	walletNetworkToBridgeNetwork
} from "@zeko/networks"
