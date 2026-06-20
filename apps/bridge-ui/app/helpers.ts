import { createToaster } from "@ark-ui/vue/toast"
import type { Entries } from "type-fest"
import type { bridgeOperationMachine } from "~~/machines/bridgeOperation"
import type { BridgeOperationProgress } from "~~/machines/operationProgress"

export const depositSteps = [
	"Submit Deposit",
	"Confirm Deposit",
	"Finalize Deposit",
	"Deposit Completed"
] as const

export const withdrawalSteps = [
	"Submit Withdrawal",
	"Confirm Withdrawal",
	"Finalize Withdrawal",
	"Withdrawal Completed"
] as const

export const steps = ["Send", "Confirming", "Claim", "Finalizing"] as const

type Direction = "deposit" | "withdrawal"
const SLOT_DURATION_SECONDS = 180
type QueueStatus = "started" | "paused" | "completed"
type RecoveryLane = "main" | "cancellation"

export const queueTitleForDirection = (direction: Direction) =>
	direction === "deposit" ? "Deposit Queue" : "Withdrawal Queue"

export const sortByQueueOrder = <T extends { order: number }>(items: T[]) =>
	[...items].sort((left, right) => left.order - right.order)

const userLocale = () => (typeof navigator === "undefined" ? undefined : navigator.language)

const supportedLocale = (locale?: string) => {
	if (!locale) return undefined

	try {
		return Intl.DateTimeFormat.supportedLocalesOf([locale])[0]
	} catch {
		return undefined
	}
}

export type BridgeQueueItem<T> = {
	id: string
	order: number
	status: QueueStatus
	lane: RecoveryLane
	direction: Direction
	operation: T
}

export const deriveBridgeQueues = <T>(items: BridgeQueueItem<T>[]) => {
	const completed = items.filter((item) => item.status === "completed")
	const mainPending = sortByQueueOrder(
		items.filter((item) => item.status !== "completed" && item.lane === "main")
	)
	const cancellationPending = sortByQueueOrder(
		items.filter((item) => item.status !== "completed" && item.lane === "cancellation")
	)
	const queuedMainOperations = mainPending.filter((item) => item.status !== "started")

	return {
		completed,
		currentMainOperation: mainPending.find((item) => item.status === "started")?.operation ?? null,
		depositQueue: queuedMainOperations
			.filter(({ direction }) => direction === "deposit")
			.map(({ operation }) => operation),
		withdrawalQueue: queuedMainOperations
			.filter(({ direction }) => direction === "withdrawal")
			.map(({ operation }) => operation),
		cancellableOperations: cancellationPending.map(({ operation }) => operation)
	}
}

type MachineStates = ReturnType<(typeof bridgeOperationMachine)["getInitialSnapshot"]>["value"]
type UiProgress = {
	steps: readonly string[]
	step: number
}

export const shouldShowCompletedOperationsLoading = ({
	bridgeReady,
	operationCount
}: {
	bridgeReady: boolean
	operationCount: number
}) => !bridgeReady && operationCount === 0

export const formatQueueMetadata = (
	{
		cancellable,
		direction,
		currentSlot,
		timeoutSlot,
		timeoutSlots,
		transaction
	}: {
		cancellable?: boolean
		direction: Direction
		currentSlot?: string
		timeoutSlot?: string
		timeoutSlots?: number
		transaction?: { date?: Date; timestampMs?: number | null }
	},
	options: {
		locale?: string
		timeZone?: string
	} = {}
) => {
	const metadata: string[] = []
	const formatRemainingTimeout = ({
		remainingSlots
	}: {
		remainingSlots: bigint
	}) => {
		if (remainingSlots <= 0n) return cancellable ? "Timed out" : null

		const totalMinutes = Number((remainingSlots * BigInt(SLOT_DURATION_SECONDS)) / 60n)
		const hours = Math.floor(totalMinutes / 60)
		const minutes = totalMinutes % 60

		if (hours === 0) return `Times out in ${totalMinutes} min`
		if (minutes === 0) return `Times out in ${hours} hr${hours === 1 ? "" : "s"}`
		return `Times out in ${hours} hr ${minutes} min`
	}

	const submittedAt =
		transaction?.timestampMs != null ? new Date(transaction.timestampMs) : transaction?.date

	if (submittedAt && !Number.isNaN(submittedAt.getTime())) {
		metadata.push(
			`Submitted ${new Intl.DateTimeFormat(supportedLocale(options.locale ?? userLocale()), {
				dateStyle: "medium",
				timeStyle: "short",
				...(options.timeZone ? { timeZone: options.timeZone } : {})
			}).format(submittedAt)}`
		)
	}

	if (direction === "deposit") {
		if (timeoutSlot && currentSlot) {
			const timeoutMetadata = formatRemainingTimeout({
				remainingSlots: BigInt(timeoutSlot) - BigInt(currentSlot)
			})
			if (timeoutMetadata) metadata.push(timeoutMetadata)
		} else if (typeof timeoutSlots === "number") {
			const timeoutMetadata = formatRemainingTimeout({
				remainingSlots: BigInt(timeoutSlots)
			})
			if (timeoutMetadata) metadata.push(timeoutMetadata)
		}
	}

	return metadata
}

const deposit = (kind: "pending" | "complete") => (step: number) => ({
	text: depositSteps[step] as (typeof depositSteps)[number],
	kind
})
const withdrawal = (kind: "pending" | "complete") => (step: number) => ({
	text: withdrawalSteps[step] as (typeof withdrawalSteps)[number],
	kind
})
const pendingDeposit = deposit("pending")
const pendingWithdrawal = withdrawal("pending")

export const statePath = (state: MachineStates) => {
	if (typeof state === "string") return `bridgeOperation.${state}` as const
	const [path] = (Object.entries(state) as Entries<typeof state>).map(
		([k, v]) => `bridgeOperation.${k}.${v}` as const
	)
	if (!path) throw new Error(`Invalid state path for state: ${JSON.stringify(state)}`)
	return path
}

export const statusFromState = (
	state: MachineStates,
	direction: Direction,
	options?: { canCancel?: boolean }
): { text: string; kind: "pending" | "complete" | "cancelled" | "error" } => {
	const isDeposit = direction === "deposit"
	if (typeof state === "string") {
		if (
			state === "BRIDGE_OPERATION_CANCELLED_DONE" ||
			state === "BRIDGE_OPERATION_CANCELLED_DONE_NOOP" ||
			state === "DEPOSIT_CANCELLED"
		)
			return { text: "Cancelled", kind: "cancelled" }
		if (state.includes("DONE") || state === "BRIDGE_OPERATION_COMPLETED")
			return isDeposit ? deposit("complete")(3) : withdrawal("complete")(3)
		if (state === "PENDING_DEPOSIT") return pendingDeposit(1)
		if (state === "PENDING_WITHDRAWAL") return pendingWithdrawal(1)
		if (state === "TO_FINALIZE") return isDeposit ? pendingDeposit(2) : pendingWithdrawal(2)
		if (state === "CAN_CANCEL") return { text: "Ready to cancel", kind: "pending" }
		if (state === "PAUSED" && options?.canCancel)
			return { text: "Ready to cancel", kind: "pending" }
		if (state === "PAUSED") return { text: "Paused", kind: "pending" }
		if (state === "IDLE") return { text: "Idle", kind: "pending" }
		if (state === "FAILED") return { text: "Failed", kind: "error" }
		if (state === "WAITING_FOR_NETWORK") return { text: "Waiting for network", kind: "pending" }
	}
	if (typeof state === "object") {
		if ("SUBMIT_DEPOSIT" in state) return pendingDeposit(0)
		if ("SUBMIT_WITHDRAWAL" in state) return pendingWithdrawal(0)
		if ("FINALIZE_DEPOSIT" in state) return pendingDeposit(2)
		if ("FINALIZE_WITHDRAWAL" in state) return pendingWithdrawal(2)
		if ("CANCEL_DEPOSIT" in state) return { text: "Cancelling", kind: "pending" }
	}
	return isDeposit ? pendingDeposit(1) : pendingWithdrawal(1)
}

export const progressFromState = ({
	step
}: {
	step: number
}): UiProgress => ({ steps, step })

export const operationProgressLabel = (progress?: BridgeOperationProgress | null) => {
	if (!progress || progress.confirmationsRemaining <= 0) return null
	const confirmation = progress.confirmationsRemaining === 1 ? "confirmation" : "confirmations"
	return `${progress.confirmationsRemaining} ${confirmation} remaining`
}

export const errorToaster = createToaster({
	placement: "top-end",
	overlap: true,
	gap: 24
})

const submit = "Zeko Bridge is generating a transaction to sign with your wallet."
export const bridgeMessages = {
	submit,
	submitDeposit: "Waiting for the transaction to be confirmed.",
	submitWithdrawal: submit,
	pending:
		"Your Send Transaction is awaiting on-chain Confirmation. This can take 1 hour or more, to ensure Mina L1 finality. You can leave this page and return later to Claim your bridge transaction.",
	initBridgeOperation:
		"Please wait… the Zeko Bridge is loading your wallet's latest transaction history and status.",
	toFinalize:
		"Claim generates a zero-knowledge proof to sign with your wallet on the destination chain.",
	finalizeTransaction: "Zeko Bridge is generating a sequencer proof to sign with your wallet.",
	finalizeDeposit:
		"Your Bridge Transaction is Claimed. The status is still Pending until it's finalized on Zeko. This typically takes a few seconds. Completed Transactions appear below.",
	finalizeWithdrawal:
		"Your Bridge Transaction is Claimed. The status is still Pending until it's finalized on Mina. This can take up to 1 hour, to ensure Mina L1 finality. Completed Transactions appear below.",
	canCancel:
		"Your Send Transaction took longer than the Bridge Timeout setting, <b>please Cancel to reclaim your funds</b> on Mina L1, and try Bridging again.",
	cancelDeposit: "Waiting for the cancellation transaction to be confirmed.",
	cancellingDeposit:
		"Zeko Bridge is generating a cancellation transaction to sign with your wallet.",
	depositCancelled:
		"Your deposit has been cancelled. Your funds have been returned to your wallet on Mina L1."
} as const
