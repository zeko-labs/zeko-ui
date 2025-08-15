import { Bridge } from "@zeko/bridge-sdk"
import type {
	InnerActionWithState,
	MaybeDeposit,
	MaybeWithdrawal,
	OuterActionWithState
} from "@zeko/bridge-sdk"
import * as Comlink from "comlink"
import { PublicKey } from "o1js"

export type Networks = "mina:devnet" | "zeko:testnet" | "mina:mainnet" | "zeko:mainnet"

type ActionState = {
	index: number
	id: string
	recipient: string
	amount: string
	finalised: boolean
	source: Networks
	destination: Networks
}

export type PendingOperations = {
	deposits: ActionState[]
	withdrawals: ActionState[]
}

type FindArgs = {
	account: string
	// in case we need to vary urls per env later
	l1: Networks
	l2: Networks
}

// Keep the worker logic free of any UI or xstate specifics
async function findPendingOperations({ account, l1, l2 }: FindArgs): Promise<PendingOperations> {
	// TODO: make these configurable via args in the future
	const bridge = await Bridge.init({
		l1Url: "https://api.minascan.io/node/devnet/v1/graphql",
		l1ArchiveUrl: "https://api.minascan.io/archive/devnet/v1/graphql",
		zekoUrl: "https://alphanet.zeko.io/graphql",
		l1Network: "testnet",
		l2Network: "testnet"
	})

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
