import type { DepositStatus, OperationSession, WithdrawalStatus } from "./types"

export const sortByIndex = <T extends { index: number }>(items: T[]): T[] =>
	[...items].sort((left, right) => left.index - right.index)

export const maxIndex = <T extends { index: number }>(items: T[]): number =>
	items.reduce((highest, item) => Math.max(highest, item.index), -1)

export const getSubmitHash = (session: OperationSession): string | undefined =>
	session.submittedTransactions.find((transaction) => transaction.action === "submit")?.hash

export const isDepositTerminal = (status: DepositStatus) => status.finalised || status.cancelled

export const isWithdrawalTerminal = (status: WithdrawalStatus) => status.finalised

export const resolveTargetIndex = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: Array<DepositStatus | WithdrawalStatus>
}): number | undefined => {
	const submitHash = getSubmitHash(session)
	if (submitHash !== undefined) {
		const matchedIndex = statuses.find((status) => status.hash === submitHash)?.index
		if (matchedIndex !== undefined) {
			return matchedIndex
		}

		if (
			session.targetIndex !== undefined &&
			(session.finalTransaction !== undefined ||
				session.pendingFinalizeIndex === session.targetIndex)
		) {
			return session.targetIndex
		}

		return undefined
	}

	if (session.targetIndex !== undefined) {
		return session.targetIndex
	}

	return statuses.length > 0 ? maxIndex(statuses) : undefined
}

export const findDepositTarget = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: DepositStatus[]
}): DepositStatus | undefined => {
	const targetIndex = resolveTargetIndex({ session, statuses })
	if (targetIndex !== undefined) {
		return statuses.find((status) => status.index === targetIndex)
	}

	const matchingRecipientStatuses = statuses.filter(
		(status) =>
			status.amount === session.amount &&
			status.recipient === (session.recipient ?? session.account)
	)

	if (matchingRecipientStatuses.length === 1) {
		return matchingRecipientStatuses[0]
	}

	if (getSubmitHash(session) !== undefined) {
		return undefined
	}

	return statuses.length === 1 ? statuses[0] : undefined
}

export const findWithdrawalTarget = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: WithdrawalStatus[]
}): WithdrawalStatus | undefined => {
	const targetIndex = resolveTargetIndex({ session, statuses })
	if (targetIndex !== undefined) {
		return statuses.find((status) => status.index === targetIndex)
	}

	const matchingRecipientStatuses = statuses.filter(
		(status) =>
			status.amount === session.amount &&
			status.recipient === (session.recipient ?? session.account)
	)

	if (matchingRecipientStatuses.length === 1) {
		return matchingRecipientStatuses[0]
	}

	if (getSubmitHash(session) !== undefined) {
		return undefined
	}

	return statuses.length === 1 ? statuses[0] : undefined
}

export const firstClaimableDepositIndex = (statuses: DepositStatus[]): number | undefined =>
	sortByIndex(statuses).find((status) => status.confirmed && !status.finalised && !status.cancelled)
		?.index

export const firstClaimableWithdrawalIndex = (statuses: WithdrawalStatus[]): number | undefined =>
	sortByIndex(statuses).find((status) => status.committed && !status.finalised)?.index

export type DepositQueueState = {
	target?: DepositStatus
	targetIndex?: number
	claimableIndex?: number
	pendingAhead: number
	shouldAdvanceQueuedClaims: boolean
}

export const analyzeDepositQueue = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: DepositStatus[]
}): DepositQueueState => {
	// Protocol note: cancellable deposits are skippable, but finalizable deposits must never be
	// skipped. Proper support needs both lastFinalizedDeposit (L2) and lastCancelledDeposit (L1)
	// semantics, so the CLI can only skip entries that are provably cancellable. That behavior is
	// not fully modeled here yet; current queue analysis only treats finalized/cancelled deposits
	// as terminal and otherwise preserves strict FIFO behavior.
	const target = findDepositTarget({ session, statuses })
	const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
	const claimableIndex = firstClaimableDepositIndex(statuses)
	const pendingAhead =
		targetIndex === undefined
			? 0
			: statuses.filter((status) => status.index < targetIndex && !isDepositTerminal(status)).length

	return {
		target,
		targetIndex,
		claimableIndex,
		pendingAhead,
		shouldAdvanceQueuedClaims:
			pendingAhead > 0 || (target === undefined && claimableIndex !== undefined)
	}
}

export type WithdrawalQueueState = {
	target?: WithdrawalStatus
	targetIndex?: number
	claimableIndex?: number
	pendingAhead: number
	shouldAdvanceQueuedClaims: boolean
}

export const analyzeWithdrawalQueue = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: WithdrawalStatus[]
}): WithdrawalQueueState => {
	const target = findWithdrawalTarget({ session, statuses })
	const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
	const claimableIndex = firstClaimableWithdrawalIndex(statuses)
	const pendingAhead =
		targetIndex === undefined
			? 0
			: statuses.filter((status) => status.index < targetIndex && !isWithdrawalTerminal(status))
					.length

	return {
		target,
		targetIndex,
		claimableIndex,
		pendingAhead,
		shouldAdvanceQueuedClaims:
			pendingAhead > 0 || (target === undefined && claimableIndex !== undefined)
	}
}
