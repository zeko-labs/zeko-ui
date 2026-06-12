import type { Networks as WalletNetwork } from "@lumina-dex/sdk"

export type BridgeNetwork = "mina:devnet" | "mina:mainnet" | "zeko-m-devnet" | "zeko-m-mainnet"

export const supportedNetworks = [
	"mina:devnet",
	"zeko-m-devnet",
	"mina:mainnet",
	"zeko-m-mainnet"
] as const satisfies readonly BridgeNetwork[]

export const isMainnetBridgeNetwork = (network: BridgeNetwork) => network.includes("mainnet")
export const isMinaBridgeNetwork = (network: BridgeNetwork) => network.startsWith("mina:")
export const isZekoBridgeNetwork = (network: BridgeNetwork) => network.startsWith("zeko-")

export const walletNetworkToBridgeNetwork = (network: WalletNetwork): BridgeNetwork => {
	switch (network) {
		case "mina:devnet":
		case "mina:mainnet":
			return network
		case "zeko:testnet":
			return "zeko-m-devnet"
		case "zeko:mainnet":
			return "zeko-m-mainnet"
	}
}

export const bridgeNetworkToWalletNetwork = (network: BridgeNetwork): WalletNetwork => {
	switch (network) {
		case "mina:devnet":
		case "mina:mainnet":
			return network
		case "zeko-m-devnet":
			return "zeko:testnet"
		case "zeko-m-mainnet":
			return "zeko:mainnet"
	}
}
