import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { Networks } from "@lumina-dex/sdk"
import * as Sentry from "@sentry/nuxt"
import type { DepositWithState, WithdrawalWithState } from "@zeko-labs/bridge-sdk"
import { Bridge } from "@zeko-labs/bridge-sdk"
import * as Comlink from "comlink"
import { fetchTransactionStatus, PublicKey, Transaction, UInt32, UInt64 } from "o1js"
import { getBridgeConfig } from "./helpers"

export type ActionState = {
	index: number
	id: string
	recipient: string
	amount: string
	cancelled: boolean
	finalised: boolean
	transaction: {
		date: Date
		hash: string
	}
	source: Networks
	destination: Networks
}

export type PendingOperations = {
	deposits: ActionState[]
	withdrawals: ActionState[]
}
type L1L2 = { l1: Networks; l2: Networks }

const bridges = new Map<string, Bridge>()

async function initBridge({ l1, l2 }: L1L2) {
	let bridge = bridges.get(`${l1}_${l2}`)
	if (!bridge) {
		const config = getBridgeConfig({ l1, l2 })
		bridge = await Bridge.init(config)
		bridges.set(`${l1}_${l2}`, bridge)
	}
	return bridge
}

async function findPendingOperations({
	account,
	l1,
	l2
}: { account: string } & L1L2): Promise<PendingOperations> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(account)
	const [{ deposits, ...depositIndices }, { withdrawals, ...withdrawalIndices }] =
		(await Promise.all([
			bridge.fetchDepositsWithStates(recipient),
			bridge.fetchWithdrawalsWithStates(recipient)
		])) satisfies [
			{
				deposits: DepositWithState[]
				syncedIndex: number
				acceptedIndex: number
				confirmedIndex: number
				finalisedIndex: number
				cancelledIndex: number
			},
			{
				withdrawals: WithdrawalWithState[]
				committedIndex: number
				finalisedIndex: number
			}
		]

	const toAmount = (n: bigint) => Number(Number(n / BigInt(10e8)).toFixed(2)).toString()

	const transferToString = ({
		transfer,
		index,
		cancelled,
		source,
		destination
	}: {
		transfer: DepositWithState | WithdrawalWithState
		index: number
		cancelled: boolean
		source: Networks
		destination: Networks
	}) => ({
		index,
		id: transfer.afterActionState.toString(),
		recipient: transfer.recipient.toBase58(),
		amount: toAmount(transfer.amount.toBigInt()),
		cancelled,
		finalised: transfer.finalised,
		transaction: {
			date: new Date(transfer.timestamp),
			hash: transfer.hash
		},
		source,
		destination
	})

	return {
		deposits: deposits.map((deposit, index) =>
			transferToString({
				transfer: deposit,
				index,
				cancelled: deposit.cancelled,
				source: l1,
				destination: l2
			})
		),
		withdrawals: withdrawals.map((withdrawal, index) =>
			transferToString({
				transfer: withdrawal,
				index,
				cancelled: false,
				source: l2,
				destination: l1
			})
		)
	}
}

async function submitDeposit({
	l1,
	l2,
	user,
	amount,
	timeoutSlots
}: L1L2 & { user: string; amount: string; timeoutSlots?: number }): Promise<string> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	const feePayer = { sender: recipient, fee: 0.1 * 10e8 }
	const currentSlot = await bridge.fetchCurrentSlot()
	const timeout = timeoutSlots ? currentSlot.add(UInt32.from(timeoutSlots)) : UInt32.MAXINT()
	const submitDeposit = {
		recipient,
		amount: UInt64.from(Number(amount) * 10e8),
		timeout
	}
	console.log("Submit Deposit:", { timeoutSlots, submitDeposit })
	const transaction = await bridge.submitDeposit(feePayer, submitDeposit)
	return transaction.toJSON()
}

async function submitWithdrawal({
	l1,
	l2,
	user,
	amount
}: L1L2 & { user: string; amount: string }): Promise<string> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	const feePayer = { sender: recipient, fee: 0.1 * 10e8 }
	const submitWithdrawal = {
		recipient,
		amount: UInt64.from(Number(amount) * 10e8)
	}
	const transaction = await bridge.submitWithdrawal(feePayer, submitWithdrawal)
	return transaction.toJSON()
}

async function canFinalizeDeposit({ l1, l2, user }: L1L2 & { user: string }): Promise<boolean> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	return bridge.canFinalizeDeposit(recipient)
}

async function canFinalizeWithdrawal({ l1, l2, user }: L1L2 & { user: string }): Promise<boolean> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	return bridge.canFinalizeWithdrawal(recipient)
}

async function canCancelDeposit({ l1, l2, user }: L1L2 & { user: string }): Promise<boolean> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	return bridge.canCancelDeposit(recipient)
}

async function cancelDeposit({ l1, l2, user }: L1L2 & { user: string }): Promise<string> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	const feePayer = { sender: recipient, fee: 0.1 * 10e8 }
	const transaction = await bridge.cancelDeposit(recipient, feePayer)
	return transaction.toJSON()
}

async function finalizeDeposit({ l1, l2, user }: L1L2 & { user: string }): Promise<string> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	const transaction = await bridge.finalizeDeposit(recipient)
	return transaction.toJSON()
}

async function finalizeWithdrawal({ l1, l2, user }: L1L2 & { user: string }): Promise<string> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = PublicKey.fromBase58(user)
	const feePayer = { sender: recipient, fee: 0.1 * 10e8 }
	const transaction = await bridge.finalizeWithdrawal(recipient, feePayer)
	return transaction.toJSON()
}

async function transactionStatus({ zkAppId, url }: { zkAppId: string; url?: string }) {
	const result = await fetchTransactionStatus(zkAppId, url)
	return result
}

async function sendZkAppCommand(zkappCommand: ZkappCommand) {
	const sentTransaction = await Transaction.fromJSON(zkappCommand).send()
	if (!sentTransaction.data)
		throw new Error(
			JSON.stringify({ message: "Transaction failed", errors: sentTransaction.errors })
		)
	return { hash: sentTransaction.hash, zkAppId: sentTransaction.data.sendZkapp.zkapp.id }
}

export const operations = {
	findPendingOperations,
	submitDeposit,
	canFinalizeDeposit,
	finalizeDeposit,
	canCancelDeposit,
	cancelDeposit,
	submitWithdrawal,
	canFinalizeWithdrawal,
	finalizeWithdrawal,
	transactionStatus,
	sendZkAppCommand
}

console.info("Initializing Operation Worker: Sentry")
Sentry.registerWebWorker({ self })

console.info("Initializing Operation Worker: Comlink")
Comlink.expose(operations)

console.info("Operation Worker: Ready")

export type OperationsWorker = typeof operations
