import type { ChainRef } from "./routes"

const EXPLORER_BASE_URLS: Record<ChainRef, string> = {
	"mina:testnet": "https://minascan.io/devnet",
	"mina:mainnet": "https://minascan.io/mainnet",
	"zeko-m-devnet": "https://zekoscan.io/testnet",
	"zeko-m-mainnet": "https://zekoscan.io/mainnet",
	"zeko-e-testnet": "https://zekoscan.io/testnet",
	"zeko-e-mainnet": "https://zekoscan.io/mainnet",
	"eth:testnet": "https://sepolia.etherscan.io",
	"eth:mainnet": "https://etherscan.io"
}

export const createExplorerUrl = (network: ChainRef, hash: string): string => {
	const baseUrl = EXPLORER_BASE_URLS[network]
	return `${baseUrl}/tx/${hash}`
}
