import type { Networks } from "@lumina-dex/sdk"
import type { Bridge } from "@zeko-labs/bridge-sdk"

const POLL_TIMEOUT = 3_600_000

const urls = {
	l1: {
		mainnet: {
			l1Url: "https://api.minascan.io/node/mainnet/v1/graphql",
			l1ArchiveUrl: "https://api.minascan.io/archive/mainnet/v1/graphql"
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

export const getBridgeConfig = ({ l1, l2 }: { l1: Networks; l2: Networks }) => {
	const l1Urls = l1.includes("mainnet") ? urls.l1.mainnet : urls.l1.testnet
	const l2Urls = l2.includes("mainnet") ? urls.l2.mainnet : urls.l2.testnet
	const actionsApi = l2.includes("mainnet") ? urls.actions.mainnet : urls.actions.testnet
	return {
		...l1Urls,
		...l2Urls,
		actionsApi,
		l1Network: l1.includes("mainnet") ? "mainnet" : "testnet",
		l2Network: l2.includes("mainnet") ? "mainnet" : "testnet",
		pollTimeout: POLL_TIMEOUT
	} satisfies Parameters<typeof Bridge.init>[0]
}

const baseUrl = {
	"mina:devnet": "https://minascan.io/devnet",
	"mina:mainnet": "https://minascan.io/mainnet",
	"zeko:testnet": "https://zekoscan.io/testnet",
	"zeko:mainnet": "https://zekoscan.io/mainnet"
} as const

export const createExplorerUrl = ({ network, hash }: { network: Networks; hash: string }) =>
	`${baseUrl[network]}/tx/${hash}` as const
