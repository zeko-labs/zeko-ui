import "reflect-metadata"
import type { ZkappCommand } from "@aurowallet/mina-provider"
import * as Sentry from "@sentry/nuxt"
import type {
	BridgeVersion,
	DepositWithState,
	WithdrawalFinalizationResult,
	WithdrawalWithState
} from "@zeko-labs/bridge-sdk"
import { Bridge } from "@zeko-labs/bridge-sdk"
import * as Comlink from "comlink"
import { PublicKey, Transaction, type Transaction as MinaTransaction, UInt32, UInt64 } from "o1js"
import { filterBridgeVersionOperations } from "./bridgeVersions"
import { createLogger } from "./debug"
import { getBridgeConfig } from "./helpers"
import type { BridgeNetwork } from "./networks"
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
	timeoutSlot?: string
	finalised: boolean
	bridgeVersion: BridgeVersion
	transaction: {
		date?: Date
		timestampMs?: number | null
		hash: string
	}
	source: BridgeNetwork
	destination: BridgeNetwork
}

export type PendingOperations = {
	deposits: ActionState[]
	withdrawals: ActionState[]
	currentSlot: string
}
type L1L2 = { l1: BridgeNetwork; l2: BridgeNetwork }
type FeeInput = { feeNanomina?: number }
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
const { logger } = createLogger("[OPERATIONS WORKER]")

const normalizeError = (error: unknown) =>
	error instanceof Error ? error : new Error(String(error))

const deferred = <T>() => {
	let resolve = (_value: T) => {}
	let reject = (_error: Error) => {}
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

const requestSdkSignature = (
	run: (signTransaction: SignSdkTransaction) => Promise<string>
): Promise<SdkSignatureRequest> => {
	const requestId = crypto.randomUUID()
	const request = deferred<SdkSignatureRequest>()
	const signedTransaction = deferred<MinaTransaction<boolean, true>>()

	const result = Promise.resolve().then(() =>
		run(async (transaction) => {
			request.resolve({
				requestId,
				transaction: transaction.toJSON()
			})
			return signedTransaction.promise
		})
	)

	pendingSdkSignatures.set(requestId, {
		resolveSignedTransaction: signedTransaction.resolve,
		rejectSignedTransaction: signedTransaction.reject,
		result
	})

	void result
		.catch((error) => {
			request.reject(normalizeError(error))
		})
		.finally(() => {
			pendingSdkSignatures.delete(requestId)
		})

	return request.promise
}

const signedTransactionFromJson = (signedTransaction: ZkappCommand) =>
	Transaction.fromJSON(signedTransaction) as MinaTransaction<boolean, true>

async function completeSdkSignature({
	requestId,
	signedTransaction
}: {
	requestId: string
	signedTransaction: ZkappCommand
}): Promise<string> {
	const pending = pendingSdkSignatures.get(requestId)
	if (!pending) throw new Error(`No SDK signature request found for ${requestId}`)

	pending.resolveSignedTransaction(signedTransactionFromJson(signedTransaction))
	return await pending.result
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

	const rejectionMessage = message ?? "Transaction signing failed"
	pending.rejectSignedTransaction(new Error(rejectionMessage))
	try {
		await pending.result
	} catch (error) {
		// Rejection is intentionally surfaced through the UI signing state.
		const normalizedError = normalizeError(error)
		if (normalizedError.message !== rejectionMessage) {
			Sentry.captureException(normalizedError)
		}
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
	const [{ deposits, ...depositIndices }, { withdrawals, ...withdrawalIndices }, currentSlot] =
		(await Promise.all([
			bridge.fetchDepositsWithStates(recipient),
			bridge.fetchWithdrawalsWithStates(recipient),
			bridge.fetchCurrentSlot()
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
			},
			UInt32
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
		source: BridgeNetwork
		destination: BridgeNetwork
	}) => ({
		index: transfer.index,
		id: transfer.afterActionState.toString(),
		recipient: transfer.recipient.toBase58(),
		amount: toAmount(transfer.amount.toBigInt()),
		cancelled,
		cancellable: "cancellable" in transfer ? transfer.cancellable : undefined,
		timeoutSlot: "timeout" in transfer ? transfer.timeout.toString() : undefined,
		finalised: transfer.finalised,
		bridgeVersion: transfer.bridgeVersion,
		transaction: {
			timestampMs: normalizeOperationTimestamp(transfer.timestamp),
			hash: transfer.hash
		},
		source,
		destination
	})

	return {
		deposits: filterBridgeVersionOperations(deposits).map((deposit) =>
			transferToString({
				transfer: deposit,
				cancelled: deposit.cancelled,
				source: l1,
				destination: l2
			})
		),
		withdrawals: filterBridgeVersionOperations(withdrawals).map((withdrawal) =>
			transferToString({
				transfer: withdrawal,
				cancelled: false,
				source: l2,
				destination: l1
			})
		),
		currentSlot: currentSlot.toString()
	}
}

async function submitDeposit({
	l1,
	l2,
	user,
	amount,
	timeoutSlots,
	feeNanomina
}: L1L2 & {
	user: string
	amount: string
	timeoutSlots?: number
	feeNanomina?: number
}): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	const feePayer = { sender: recipient, fee: feeNanomina ?? 0.1 * 10e8 }
	const currentSlot = await bridge.fetchCurrentSlot()
	const timeout = timeoutSlots ? currentSlot.add(UInt32.from(timeoutSlots)) : UInt32.MAXINT()
	const submitDeposit = {
		recipient,
		amount: UInt64.from(Number(amount) * 10e8),
		timeout
	}
	logger.debug("Submit Deposit:", { timeoutSlots, submitDeposit })
	return requestSdkSignature((signTransaction) =>
		bridge.submitDeposit(feePayer, submitDeposit, signTransaction)
	)
}

async function submitWithdrawal({
	l1,
	l2,
	user,
	amount,
	feeNanomina
}: L1L2 & { user: string; amount: string } & FeeInput): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	const feePayer = { sender: recipient, fee: feeNanomina ?? 0.1 * 10e8 }
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
}: L1L2 & { user: string }): Promise<WithdrawalFinalizationResult> {
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
	user,
	feeNanomina
}: L1L2 & { user: string } & FeeInput): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return requestSdkSignature((signTransaction) =>
		bridge.cancelDeposit(recipient, signTransaction, undefined, { feeNanomina })
	)
}

async function finalizeDeposit({
	l1,
	l2,
	user,
	feeNanomina
}: L1L2 & { user: string } & FeeInput): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return requestSdkSignature((signTransaction) =>
		bridge.finalizeDeposit(recipient, signTransaction, { feeNanomina })
	)
}

async function finalizeWithdrawal({
	l1,
	l2,
	user,
	feeNanomina
}: L1L2 & { user: string } & FeeInput): Promise<SdkSignatureRequest> {
	const bridge = await initBridge({ l1, l2 })
	const recipient = validatePublicKey(user)
	return requestSdkSignature((signTransaction) =>
		bridge.finalizeWithdrawal(recipient, signTransaction, undefined, { feeNanomina })
	)
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
	rejectSdkSignature
}

console.info("Initializing Operation Worker: Sentry")
Sentry.registerWebWorker({ self })

console.info("Initializing Operation Worker: Comlink")
Comlink.expose(operations)

console.info("Operation Worker: Ready")

export type OperationsWorker = typeof operations
