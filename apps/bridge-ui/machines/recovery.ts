import type { ActionState, PendingOperations } from "./operations.worker"

export type PendingRecoveryCommand = "resumeDeposit" | "resumeWithdrawal"
export type RecoveryLane = "main" | "cancellation"

export type PendingRecoveryOperation = {
	actionState: ActionState
	command: PendingRecoveryCommand
	lane: RecoveryLane
}

export type RecoveredOperations = {
	mainPending: PendingRecoveryOperation[]
	cancellableDeposits: PendingRecoveryOperation[]
	completedDeposits: ActionState[]
	completedWithdrawals: ActionState[]
	cancelledDeposits: ActionState[]
}

const compareByRecoveryOrder = (a: ActionState, b: ActionState) => {
	const timestampDiff = a.transaction.date.getTime() - b.transaction.date.getTime()
	if (timestampDiff !== 0) return timestampDiff
	return a.index - b.index
}

export const classifyRecoveredOperations = ({
	deposits,
	withdrawals
}: PendingOperations): RecoveredOperations => {
	const completedDeposits = deposits.filter((deposit) => deposit.finalised === true)
	const cancelledDeposits = deposits.filter(
		(deposit) => deposit.cancelled === true && deposit.finalised === false
	)
	const completedWithdrawals = withdrawals.filter((withdrawal) => withdrawal.finalised === true)

	const cancellableDeposits = deposits
		.filter(
			(deposit) =>
				deposit.finalised === false && deposit.cancelled === false && deposit.cancellable === true
		)
		.toSorted(compareByRecoveryOrder)
		.map((actionState) => ({
			actionState,
			command: "resumeDeposit" as const,
			lane: "cancellation" as const
		}))

	const mainPendingDeposits = deposits
		.filter(
			(deposit) =>
				deposit.finalised === false && deposit.cancelled === false && deposit.cancellable !== true
		)
		.map((actionState) => ({
			actionState,
			command: "resumeDeposit" as const,
			lane: "main" as const
		}))

	const mainPendingWithdrawals = withdrawals
		.filter((withdrawal) => withdrawal.finalised === false)
		.map((actionState) => ({
			actionState,
			command: "resumeWithdrawal" as const,
			lane: "main" as const
		}))

	const mainPending: PendingRecoveryOperation[] = [
		...mainPendingDeposits,
		...mainPendingWithdrawals
	].toSorted((a, b) => compareByRecoveryOrder(a.actionState, b.actionState))

	return {
		mainPending,
		cancellableDeposits,
		completedDeposits,
		completedWithdrawals,
		cancelledDeposits
	}
}
