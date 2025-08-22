import type { Networks } from "@lumina-dex/sdk"
import { Bridge } from "@zeko/bridge-sdk"
import type {
	InnerActionWithState,
	MaybeDeposit,
	MaybeWithdrawal,
	OuterActionWithState
} from "@zeko/bridge-sdk"
import * as Comlink from "comlink"
import { PublicKey } from "o1js"

export type ActionState = {
	index: number
	id: string
	recipient: string
	amount: string
	finalised: boolean
	transaction: {
		date: Date
		status: string
		hash: string
	}
	source: Networks
	destination: Networks
}

export type PendingOperations = {
	deposits: ActionState[]
	withdrawals: ActionState[]
}

type FindArgs = {
	account: string
	l1: Networks
	l2: Networks
}

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

const getConfig = ({ l1, l2 }: { l1: Networks; l2: Networks }) => {
	const l1Urls = l1.includes("mainnet") ? urls.l1.mainnet : urls.l1.testnet
	const l2Urls = l2.includes("mainnet") ? urls.l2.mainnet : urls.l2.alphanet //TODO: change to testnet
	return {
		...l1Urls,
		...l2Urls,
		l1Network: l1.includes("mainnet") ? "mainnet" : "testnet",
		l2Network: l2.includes("mainnet") ? "mainnet" : "testnet"
	} as const
}

const bridges = new Map<string, Bridge>()

async function findPendingOperations({ account, l1, l2 }: FindArgs): Promise<PendingOperations> {
	let bridge = bridges.get(`${l1}_${l2}`)
	if (!bridge) {
		const config = getConfig({ l1, l2 })
		bridge = await Bridge.init(config)
		bridges.set(`${l1}_${l2}`, bridge)
	}

	const recipient = PublicKey.fromBase58(account)
	const [outerActions, innerActions] = (await Promise.all([
		bridge.fetchOuterActionsWithStates(recipient),
		bridge.fetchInnerActionsWithStates(recipient)
	])) as [OuterActionWithState[], InnerActionWithState[]]

	const toAmount = (n: bigint) => (n / BigInt(10e8)).toString()

	const deposits = outerActions
		.map((action, index) => {
			const maybe = action as MaybeDeposit
			if (maybe.type === "witness" && maybe.deposit) {
				return {
					index,
					id: maybe.action.afterActionState.toString(),
					recipient: maybe.deposit.recipient.toBase58(),
					amount: toAmount(maybe.deposit.amount.toBigInt()),
					finalised: maybe.deposit.finalised,
					transaction: {
						date: new Date(Number(maybe.action.timestamp)),
						status: maybe.action.status,
						hash: maybe.action.hash
					},
					source: l1,
					destination: l2
				} as const
			}
		})
		.filter(Boolean) as ActionState[]

	const withdrawals = innerActions
		.map((action, index) => {
			const maybe = action as MaybeWithdrawal
			if (maybe.withdrawal) {
				return {
					index,
					id: maybe.action.afterActionState.toString(),
					recipient: maybe.withdrawal.recipient.toBase58(),
					amount: toAmount(maybe.withdrawal.amount.toBigInt()),
					finalised: maybe.withdrawal.finalised,
					transaction: {
						date: new Date(Number(maybe.action.timestamp)),
						status: maybe.action.status,
						hash: maybe.action.hash
					},
					source: l2,
					destination: l1
				} as const
			}
		})
		.filter(Boolean) as ActionState[]

	return { deposits, withdrawals }
}

export const operations = { findPendingOperations }

// Worker
console.info("Initializing Operation Worker")
Comlink.expose(operations)

export type OperationsWorker = typeof operations
