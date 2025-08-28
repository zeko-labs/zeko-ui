import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { Networks, walletMachine } from "@lumina-dex/sdk"
import { type Mina, Transaction } from "o1js"
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

export const createExplorerUrl = ({ network, hash }: { network: Networks; hash: string }) =>
	`${baseUrl[network]}/account/${hash}/zk-txs` as const

export const sendTransaction = async ({
	tx,
	wallet,
	onlySign = false
}: { tx: Mina.Transaction<false, false> | string; wallet: Wallet; onlySign?: boolean }) => {
	const transaction = typeof tx === "string" ? tx : tx.toJSON()
	const result = await window.mina.sendTransaction({ onlySign, transaction })

	if (result instanceof Error) {
		console.error("Transaction failed", result)
		throw result
	}

	const processHash = (hash: string) => {
		const timestamp = Date.now()
		const { currentNetwork, account } = wallet.getSnapshot().context
		const storageKey = `zeko-bridge-tx-${timestamp}-${currentNetwork}-${account}-${hash}`
		localStorage.setItem(
			storageKey,
			JSON.stringify({ timestamp, currentNetwork, account, hash, transaction })
		)
		console.log("Transaction sent and saved to localStorage", result)

		return { hash, url: createExplorerUrl({ network: currentNetwork, hash }) }
	}

	if ("hash" in result) return processHash(result.hash)

	// Transactions paid by another sender are signed, then sent with o1js
	if (onlySign && "signedData" in result) {
		console.log({ result })
		console.log(JSON.parse(result.signedData))
		const transaction = Transaction.fromJSON(JSON.parse(result.signedData) as ZkappCommand)
		const result2 = await transaction.send()
		return processHash(result2.hash)
	}

	console.log("An unexpected transaction result was received", result)
	throw new Error("Unexpected transaction result")
}
