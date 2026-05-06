import "reflect-metadata"
import type { ZkappCommand } from "@aurowallet/mina-provider"
import type { Networks } from "@lumina-dex/sdk"
import * as Sentry from "@sentry/nuxt"
import type { DepositWithState, WithdrawalWithState } from "@zeko-labs/bridge-sdk"
import { Bridge } from "@zeko-labs/bridge-sdk"
import * as Comlink from "comlink"
import {
	fetchTransactionStatus,
	PublicKey,
	Transaction,
	type Transaction as MinaTransaction,
	UInt32,
	UInt64
} from "o1js"
import { getBridgeConfig } from "./helpers"
import { normalizeOperationTimestamp } from "./operationTimestamps"

function validatePublicKey(address: string): PublicKey {
	try {
		return PublicKey.fromBase58(address)
	} catch (cause) {
		throw new Error(`Invalid Mina address: ${address}`, { cause })
	}
}

export type ActionState = {
	index: number
	id: string
	recipient: string
	amount: string
	cancelled: boolean
	cancellable?: boolean
	finalised: boolean
	transaction: {
		timestampMs: number | null
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
type SignSdkTransaction = (
	transaction: MinaTransaction<boolean, false>
) => Promise<MinaTransaction<boolean, true>>

export type SdkSignatureRequest = {
	requestId: string
	transaction: string
}

type PendingSdkSignature = {
	resolveSignedTransaction: (transaction: MinaTransaction<boolean, true>) => void
	rejectSignedTransaction: (error: Error) => void
	result: Promise<string>
}

const bridges = new Map<string, Bridge>()
const pendingSdkSignatures = new Map<string, PendingSdkSignature>()

const normalizeError = (error: unknown) =>
	error instanceof Error ? error : new Error(String(error))

const requestSdkSignature = (
	run: (signTransaction: SignSdkTransaction) => Promise<string>
): Promise<SdkSignatureRequest> => {
	const requestId = crypto.randomUUID()
	let signatureRequested = false
	let resolveRequest = (_request: SdkSignatureRequest) => {}
	let rejectRequest = (_error: Error) => {}
	const request = new Promise<SdkSignatureRequest>((resolve, reject) => {
		resolveRequest = resolve
		rejectRequest = reject
	})
	let resolveSignedTransaction = (_transaction: MinaTransaction<boolean, true>) => {}
	let rejectSignedTransaction = (_error: Error) => {}
	const signedTransaction = new Promise<MinaTransaction<boolean, true>>((resolve, reject) => {
		resolveSignedTransaction = resolve
		rejectSignedTransaction = reject
	})

	const result = run(async (transaction) => {
		signatureRequested = true
		resolveRequest({
			requestId,
			transaction: transaction.toJSON()
		})
		return signedTransaction
	})

	pendingSdkSignatures.set(requestId, {
		resolveSignedTransaction,
		rejectSignedTransaction,
		result
	})

	result.catch((error) => {
		if (!signatureRequested) rejectRequest(normalizeError(error))
		pendingSdkSignatures.delete(requestId)
	})

	return request
}

async function completeSdkSignature({
	requestId,
	signedTransaction
}: {
	requestId: string
	signedTransaction: ZkappCommand
}): Promise<string> {
	const pending = pendingSdkSignatures.get(requestId)
	if (!pending) throw new Error(`No SDK signature request found for ${requestId}`)

	try {
		pending.resolveSignedTransaction(
			Transaction.fromJSON(signedTransaction) as MinaTransaction<boolean, true>
		)
		return await pending.result
	} finally {
		pendingSdkSignatures.delete(requestId)
	}
}

async function rejectSdkSignature({
	requestId,
	message
}: {
	requestId: string
	message?: string
}): Promise<void> {
	const pending = pendingSdkSignatures.get(requestId)
	if (!pending) return

	pending.rejectSignedTransaction(new Error(message ?? "Transaction signing failed"))
	pendingSdkSignatures.delete(requestId)
	try {
		await pending.result
	} catch {
		// Rejection is intentionally surfaced through the UI signing state.
	}
}

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
	const recipient = validatePublicKey(account)
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
		cancelled,
		source,
		destination
	}: {
		transfer: DepositWithState | WithdrawalWithState
		cancelled: boolean
		source: Networks
		destination: Networks
	}) => ({
		index: transfer.index,
		id: transfer.afterActionState.toString(),
		recipient: transfer.recipient.toBase58(),
		amount: toAmount(transfer.amount.toBigInt()),
		cancelled,
		cancellable: "cancellable" in transfer ? transfer.cancellable : undefined,
		finalised: transfer.finalised,
		transaction: {
			timestampMs: normalizeOperationTimestamp(transfer.timestamp),
			hash: transfer.hash
		},
		source,
		destination
	})

	return {
		deposits: deposits.map((deposit) =>
			transferToString({
				transfer: deposit,
				cancelled: deposit.cancelled,
				source: l1,
				destination: l2
			})
		),
		withdrawals: withdrawals.map((withdrawal) =>
			transferToString({
				transfer: withdrawal,
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
}: L1L2 & {
	user: string
	amount: string
	timeoutSlots?: number
}): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	const feePayer = { sender: recipient, fee: 0.1 * 10e8 }
	const currentSlot = await bridge.fetchCurrentSlot()
	const timeout = timeoutSlots ? currentSlot.add(UInt32.from(timeoutSlots)) : UInt32.MAXINT()
	const submitDeposit = {
		recipient,
		amount: UInt64.from(Number(amount) * 10e8),
		timeout
	}
	console.log("Submit Deposit:", { timeoutSlots, submitDeposit })
	return requestSdkSignature((signTransaction) =>
		bridge.submitDeposit(feePayer, submitDeposit, signTransaction)
	)
}

async function submitWithdrawal({
	l1,
	l2,
	user,
	amount
}: L1L2 & { user: string; amount: string }): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	const feePayer = { sender: recipient, fee: 0.1 * 10e8 }
	const submitWithdrawal = {
		recipient,
		amount: UInt64.from(Number(amount) * 10e8)
	}
	return requestSdkSignature((signTransaction) =>
		bridge.submitWithdrawal(feePayer, submitWithdrawal, signTransaction)
	)
}

async function canFinalizeDeposit({
	l1,
	l2,
	user
}: L1L2 & { user: string }): Promise<{ available: boolean; reason: string | null }> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return bridge.canFinalizeDeposit(recipient)
}

async function canFinalizeWithdrawal({
	l1,
	l2,
	user
}: L1L2 & { user: string }): Promise<{ available: boolean; reason: string | null }> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return bridge.canFinalizeWithdrawal(recipient)
}

async function canCancelDeposit({
	l1,
	l2,
	user
}: L1L2 & { user: string }): Promise<{ available: boolean; reason: string | null }> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return bridge.canCancelDeposit(recipient)
}

async function cancelDeposit({
	l1,
	l2,
	user
}: L1L2 & { user: string }): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return requestSdkSignature((signTransaction) => bridge.cancelDeposit(recipient, signTransaction))
}

async function finalizeDeposit({
	l1,
	l2,
	user
}: L1L2 & { user: string }): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return requestSdkSignature((signTransaction) =>
		bridge.finalizeDeposit(recipient, signTransaction)
	)
}

async function finalizeWithdrawal({
	l1,
	l2,
	user
}: L1L2 & { user: string }): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return requestSdkSignature((signTransaction) =>
		bridge.finalizeWithdrawal(recipient, signTransaction)
	)
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
	completeSdkSignature,
	rejectSdkSignature,
	transactionStatus,
	sendZkAppCommand
}

console.info("Initializing Operation Worker: Sentry")
Sentry.registerWebWorker({ self })

console.info("Initializing Operation Worker: Comlink")
Comlink.expose(operations)

console.info("Operation Worker: Ready")

export type OperationsWorker = typeof operations
