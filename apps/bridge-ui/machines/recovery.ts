import type { ActionState, PendingOperations } from "./operations.worker"

export type PendingRecoveryCommand = "resumeDeposit" | "resumeWithdrawal"
export type RecoveryLane = "main" | "cancellation"

export type PendingRecoveryOperation = {
	actionState: ActionState
	command: PendingRecoveryCommand
}

export type RecoveredOperations = {
	mainPending: PendingRecoveryOperation[]
	cancellableDeposits: PendingRecoveryOperation[]
	completedDeposits: ActionState[]
	completedWithdrawals: ActionState[]
	cancelledDeposits: ActionState[]
}

export type RecoverySyncStatus = "started" | "paused" | "completed"

export type RecoverySyncOperation = {
	id: string
	lane: RecoveryLane
	order: number
	status: "started" | "paused"
	cancellable: boolean
	timeoutSlot?: string
}

export type RecoverySyncState = {
	pendingOperations: RecoverySyncOperation[]
	activeOperation: string | null
	activeCancellationOperation: string | null
}

export type RecoverySyncCandidate = {
	id: string
	status: RecoverySyncStatus
	transactionHash?: string
}

const compareBySubmissionOrder = (a: ActionState, b: ActionState) => a.index - b.index

export const classifyRecoveredOperations = ({
	deposits,
	withdrawals
}: PendingOperations): RecoveredOperations => {
	const recovered: RecoveredOperations = {
		mainPending: [],
		cancellableDeposits: [],
		completedDeposits: [],
		completedWithdrawals: [],
		cancelledDeposits: []
	}
	const pendingDeposits: PendingRecoveryOperation[] = []
	const pendingWithdrawals: PendingRecoveryOperation[] = []

	for (const deposit of deposits) {
		if (deposit.finalised === true) {
			recovered.completedDeposits.push(deposit)
			continue
		}

		if (deposit.cancelled === true) {
			recovered.cancelledDeposits.push(deposit)
			continue
		}

		if (deposit.cancellable === true) {
			recovered.cancellableDeposits.push({
				actionState: deposit,
				command: "resumeDeposit"
			})
			continue
		}

		pendingDeposits.push({
			actionState: deposit,
			command: "resumeDeposit"
		})
	}

	for (const withdrawal of withdrawals) {
		if (withdrawal.finalised === true) {
			recovered.completedWithdrawals.push(withdrawal)
			continue
		}

		pendingWithdrawals.push({
			actionState: withdrawal,
			command: "resumeWithdrawal"
		})
	}

	pendingDeposits.sort((a, b) => compareBySubmissionOrder(a.actionState, b.actionState))
	pendingWithdrawals.sort((a, b) => compareBySubmissionOrder(a.actionState, b.actionState))
	recovered.mainPending = [...pendingDeposits, ...pendingWithdrawals]
	recovered.cancellableDeposits.sort((a, b) =>
		compareBySubmissionOrder(a.actionState, b.actionState)
	)

	return recovered
}

export const buildRecoverySyncState = ({
	recovered,
	entryStateById
}: {
	recovered: RecoveredOperations
	entryStateById: ReadonlyMap<string, { status: RecoverySyncStatus; lane: RecoveryLane }>
}): RecoverySyncState => {
	const pendingOperations = [
		...recovered.mainPending.map(({ actionState }, order) => ({
			id: actionState.id,
			lane: "main" as const,
			order,
			status: order === 0 ? ("started" as const) : ("paused" as const),
			cancellable: actionState.cancellable === true,
			timeoutSlot: actionState.timeoutSlot
		})),
		...recovered.cancellableDeposits.map(({ actionState }, order) => {
			const entryState = entryStateById.get(actionState.id)
			const status =
				entryState?.lane === "cancellation" && entryState.status === "started"
					? ("started" as const)
					: ("paused" as const)

			return {
				id: actionState.id,
				lane: "cancellation" as const,
				order,
				status,
				cancellable: actionState.cancellable === true,
				timeoutSlot: actionState.timeoutSlot
			}
		})
	].filter(({ id }) => entryStateById.has(id))

	const mainPendingIds = pendingOperations.filter(({ lane }) => lane === "main").map(({ id }) => id)
	const activeCancellationOperation =
		pendingOperations.find(({ lane, status }) => lane === "cancellation" && status === "started")
			?.id ?? null

	return {
		pendingOperations,
		activeOperation: mainPendingIds[0] ?? null,
		activeCancellationOperation
	}
}

export const matchRecoveryOperationIds = ({
	actionStates,
	candidates
}: {
	actionStates: ActionState[]
	candidates: RecoverySyncCandidate[]
}) => {
	const matches = new Map<string, string>()
	const candidateIds = new Set(candidates.map(({ id }) => id))
	const candidateIdsByHash = new Map(
		candidates
			.filter(
				({ transactionHash }) => typeof transactionHash === "string" && transactionHash.length > 0
			)
			.map(({ id, transactionHash }) => [transactionHash as string, id] as const)
	)

	for (const actionState of actionStates) {
		if (candidateIds.has(actionState.id)) {
			matches.set(actionState.id, actionState.id)
			continue
		}

		const matchedId = candidateIdsByHash.get(actionState.transaction.hash)
		if (matchedId) matches.set(actionState.id, matchedId)
	}

	return matches
}
