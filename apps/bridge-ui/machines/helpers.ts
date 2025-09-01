import type { Networks, walletMachine } from "@lumina-dex/sdk"
import type { ActorRefFromLogic } from "xstate"

type Wallet = ActorRefFromLogic<typeof walletMachine>

const baseUrl = {
	"mina:devnet": "https://mxinascan.io/devnet",
	"mina:mainnet": "https://minascan.io/mainnet",
	"zeko:testnet": "https://zekoscan.io/testnet",
	"zeko:mainnet": "https://zekoscan.io/mainnet"
} as const

const urls = {
	l1: {
		mainnet: {
			l1Url: "https://api.minascan.io/node/mainnet/v1/graphql",
			l1ArchiveUrl: "https://api.minascan.io/archive/mainnet/v1/graphql"
		},
		testnet: {
			l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
			l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql"
		}
	},
	l2: {
		mainnet: {
			zekoUrl: "https://mainnet.zeko.io/graphql",
			zekoArchiveUrl: "https://archive.mainnet.zeko.io/graphql"
		},
		alphanet: {
			zekoUrl: "https://alphanet.zeko.io/graphql",
			zekoArchiveUrl: "https://archive.alphanet.zeko.io/graphql"
		},
		testnet: {
			zekoUrl: "https://testnet.zeko.io/graphql",
			zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql"
		}
	}
} as const

export const getBridgeConfig = ({ l1, l2 }: { l1: Networks; l2: Networks }) => {
	const l1Urls = l1.includes("mainnet") ? urls.l1.mainnet : urls.l1.testnet
	const l2Urls = l2.includes("mainnet") ? urls.l2.mainnet : urls.l2.testnet
	return {
		...l1Urls,
		...l2Urls,
		l1Network: l1.includes("mainnet") ? "mainnet" : "testnet",
		l2Network: l2.includes("mainnet") ? "mainnet" : "testnet"
	} as const
}

export const processHash = ({
	hash,
	wallet,
	transaction
}: { hash: string; wallet: Wallet; transaction: string }) => {
	const timestamp = Date.now()
	const { currentNetwork, account } = wallet.getSnapshot().context
	const storageKey = `zeko-bridge-tx-${timestamp}-${currentNetwork}-${account}-${hash}`
	const toStore = { timestamp, currentNetwork, account, hash, transaction }
	localStorage.setItem(storageKey, JSON.stringify(toStore))
	console.log("Transaction sent and saved to localStorage", { storageKey, ...toStore })
	return { hash, url: createExplorerUrl({ network: currentNetwork, hash }) }
}

export const createExplorerUrl = ({ network, hash }: { network: Networks; hash: string }) =>
	`${baseUrl[network]}/account/${hash}/zk-txs` as const
