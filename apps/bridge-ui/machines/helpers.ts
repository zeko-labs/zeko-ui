import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { Networks } from "@lumina-dex/sdk"
import type { Bridge } from "@zeko-labs/bridge-sdk"
import { type DBSchema, openDB } from "idb"
import { hash } from "ohash"

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
		alphanet: {
			zekoUrl: "https://alphanet.zeko.io/graphql",
			zekoArchiveUrl: "https://archive.alphanet.zeko.io/graphql"
		},
		testnet: {
			zekoUrl: "https://testnet.zeko.io/graphql",
			zekoArchiveUrl: "https://archive.testnet.zeko.io/graphql"
		}
	},
	actions: {
		//TODO: Configure for mainnet
		mainnet: "https://api.actions.zeko.io/graphql",
		testnet: "https://api.actions.zeko.io/graphql"
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

export interface SavedTransaction {
	timestamp: number
	confirmed: boolean
	network: Networks
	account: string
	transaction: string
	zkappCommand: ZkappCommand
	hash: string
	zkAppId: string
	id: string
}

interface ZekoBridgeDB extends DBSchema {
	transactions: {
		value: SavedTransaction
		key: string
		indexes: { "by-id": string }
	}
}

export type HashDb = ReturnType<typeof hashDb>

const baseUrl = {
	"mina:devnet": "https://minascan.io/devnet",
	"mina:mainnet": "https://minascan.io/mainnet",
	"zeko:testnet": "https://zekoscan.io/testnet",
	"zeko:mainnet": "https://zekoscan.io/mainnet"
} as const

export const createDb = () =>
	openDB<ZekoBridgeDB>("Zeko-Bridge", 1, {
		upgrade(db) {
			const store = db.createObjectStore("transactions", { keyPath: "id" })
			store.createIndex("by-id", "id")
		}
	})

export const hashDb = ({
	network,
	account,
	transaction,
	db = createDb()
}: {
	db?: ReturnType<typeof createDb>
	network: Networks
	account: string
	transaction: string
}) => {
	const id = hash(transaction)
	const findUnconfirmed = async () => {
		const transactions = await (await db).getAllFromIndex("transactions", "by-id", id)
		return transactions.find((t) => t.confirmed === false)
	}

	const saveSigned = async ({
		hash,
		confirmed,
		zkAppId,
		zkappCommand
	}: { hash: string; confirmed: boolean; zkAppId: string; zkappCommand: ZkappCommand }) => {
		const toStore = {
			id,
			timestamp: Date.now(),
			network,
			account,
			hash,
			zkAppId,
			zkappCommand,
			transaction
		}
		await (await db).put("transactions", { ...toStore, confirmed })
		console.log(`Transaction confirmed:${confirmed} saved.`, toStore)
	}

	const confirmTransaction = async () => {
		const DB = await db
		const tx = await DB.get("transactions", id)
		if (!tx) throw new Error("Transaction not found")
		tx.confirmed = true
		await DB.put("transactions", tx)
	}

	const createResult = ({ hash }: { hash: string }) => {
		return { hash, url: createExplorerUrl({ network, hash }) }
	}
	return { saveSigned, confirmTransaction, findUnconfirmed, createResult }
}

export const createExplorerUrl = ({ network, hash }: { network: Networks; hash: string }) =>
	`${baseUrl[network]}/tx/${hash}` as const
