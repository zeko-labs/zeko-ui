import type { Bridge } from "@zeko-labs/bridge-sdk"
import type { BridgeNetwork } from "./networks"
import { isMainnetBridgeNetwork } from "./networks"

const POLL_TIMEOUT = 3_600_000

const urls = {
	l1: {
		mainnet: {
			l1Url: "https://gateway.mina.mainnet.zeko.io",
			l1ArchiveUrl: "https://gateway.mina.archive.mainnet.zeko.io"
		},
		testnet: {
			l1Url: "https://gateway.mina.devnet.zeko.io",
			l1ArchiveUrl: "https://gateway.mina.archive.devnet.zeko.io"
		}
	},
	l2: {
		mainnet: {
			zekoUrl: "https://mainnet.zeko.io/graphql",
			zekoArchiveUrl: "https://archive.mainnet.zeko.io/graphql"
		},
		testnet: {
			zekoUrl: "https://testnet.zeko.io/graphql",
			zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql"
			// zekoUrl: "https://alphanet.zeko.io/graphql",
			// zekoArchiveUrl: "https://archive.alphanet.zeko.io/graphql"
		}
	},
	actions: {
		mainnet: "https://api.actions.zeko.io/graphql",
		testnet: "https://testnet.api.actions.zeko.io/graphql"
		// testnet: "http://localhost:9100/graphql"
	}
} as const

export const getBridgeConfig = ({ l1, l2 }: { l1: BridgeNetwork; l2: BridgeNetwork }) => {
	const l1Urls = isMainnetBridgeNetwork(l1) ? urls.l1.mainnet : urls.l1.testnet
	const l2Urls = isMainnetBridgeNetwork(l2) ? urls.l2.mainnet : urls.l2.testnet
	const actionsApi = isMainnetBridgeNetwork(l2) ? urls.actions.mainnet : urls.actions.testnet
	return {
		...l1Urls,
		...l2Urls,
		actionsApi,
		l1Network: isMainnetBridgeNetwork(l1) ? "mainnet" : "testnet",
		l2Network: isMainnetBridgeNetwork(l2) ? { custom: "zeko-mainnet" } : "testnet",
		pollTimeout: POLL_TIMEOUT
	} satisfies Parameters<typeof Bridge.init>[0]
}

const baseUrl = {
	"mina:devnet": "https://minascan.io/devnet",
	"mina:mainnet": "https://minascan.io/mainnet",
	"zeko-m-devnet": "https://zekoscan.io/testnet",
	"zeko-m-mainnet": "https://zekoscan.io/mainnet"
} as const satisfies Record<BridgeNetwork, string>

export const createExplorerUrl = ({ network, hash }: { network: BridgeNetwork; hash: string }) =>
	`${baseUrl[network]}/tx/${hash}` as const
