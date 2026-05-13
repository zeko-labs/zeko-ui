import type {
	BridgeCapabilityDiagnostic,
	DepositStatus,
	OperationPhase,
	OperationSession,
	OperationStatus,
	WithdrawalStatus
} from "./types"

export const sortByIndex = <T extends { index: number }>(items: T[]): T[] =>
	[...items].sort((left, right) => left.index - right.index)

export const getSubmitHash = (session: OperationSession): string | undefined =>
	session.submittedTransactions.find((transaction) => transaction.action === "submit")?.hash

const resolveTargetIndex = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: Array<DepositStatus | WithdrawalStatus>
}): number | undefined => {
	const submitHash = getSubmitHash(session)
	if (submitHash) {
		const matchedIndex = statuses.find((status) => status.hash === submitHash)?.index
		if (matchedIndex !== undefined) return matchedIndex
		if (
			session.targetIndex !== undefined &&
			statuses.some((status) => status.index === session.targetIndex)
		) {
			return session.targetIndex
		}
		if (
			session.targetIndex !== undefined &&
			(session.finalTransaction || session.pendingFinalizeIndex === session.targetIndex)
		) {
			return session.targetIndex
		}
		return undefined
	}
	return (
		session.targetIndex ??
		(statuses.length > 0 ? Math.max(...statuses.map((status) => status.index)) : undefined)
	)
}

const findDepositTarget = (session: OperationSession, statuses: DepositStatus[]) => {
	const targetIndex = resolveTargetIndex({ session, statuses })
	if (targetIndex !== undefined) return statuses.find((status) => status.index === targetIndex)
	if (getSubmitHash(session)) return undefined
	const matches = statuses.filter(
		(status) =>
			status.amount === session.amount &&
			status.recipient === (session.recipient ?? session.account)
	)
	return matches.length === 1 ? matches[0] : statuses.length === 1 ? statuses[0] : undefined
}

const findWithdrawalTarget = (session: OperationSession, statuses: WithdrawalStatus[]) => {
	const targetIndex = resolveTargetIndex({ session, statuses })
	if (targetIndex !== undefined) return statuses.find((status) => status.index === targetIndex)
	if (getSubmitHash(session)) return undefined
	const matches = statuses.filter(
		(status) =>
			status.amount === session.amount &&
			status.recipient === (session.recipient ?? session.account)
	)
	return matches.length === 1 ? matches[0] : statuses.length === 1 ? statuses[0] : undefined
}

export type DepositQueueState = {
	target?: DepositStatus
	targetIndex?: number
	claimableIndex?: number
	pendingAhead: number
	blockingAhead: number
	skippableAhead: number
	shouldAdvanceQueuedClaims: boolean
}

export type WithdrawalQueueState = {
	target?: WithdrawalStatus
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
	const target = findDepositTarget(session, statuses)
	const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
	const claimableIndex = sortByIndex(statuses).find(
		(status) => status.confirmed && !status.finalised && !status.cancelled
	)?.index
	const pendingStatuses =
		targetIndex === undefined
			? []
			: statuses.filter(
					(status) => status.index < targetIndex && !status.finalised && !status.cancelled
				)
	const blockingAhead = pendingStatuses.filter((status) => status.cancellable !== true).length
	const skippableAhead = pendingStatuses.filter((status) => status.cancellable === true).length
	return {
		target,
		targetIndex,
		claimableIndex,
		pendingAhead: pendingStatuses.length,
		blockingAhead,
		skippableAhead,
		shouldAdvanceQueuedClaims:
			pendingStatuses.length > 0 || (target === undefined && claimableIndex !== undefined)
	}
}

export const analyzeWithdrawalQueue = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: WithdrawalStatus[]
}): WithdrawalQueueState => {
	const target = findWithdrawalTarget(session, statuses)
	const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
	const claimableIndex = sortByIndex(statuses).find(
		(status) => status.committed && !status.finalised
	)?.index
	const pendingAhead =
		targetIndex === undefined
			? 0
			: statuses.filter((status) => status.index < targetIndex && !status.finalised).length
	return {
		target,
		targetIndex,
		claimableIndex,
		pendingAhead,
		shouldAdvanceQueuedClaims:
			pendingAhead > 0 || (target === undefined && claimableIndex !== undefined)
	}
}

export const resolveEffectiveDepositClaimableIndex = ({
	claimableIndex,
	target,
	pendingAhead,
	canFinalize
}: {
	claimableIndex?: number
	target?: DepositStatus
	pendingAhead: number
	canFinalize: boolean
}): number | undefined =>
	claimableIndex ?? (canFinalize && pendingAhead === 0 && target ? target.index : undefined)

export type Decision =
	| { action: "submit"; analysis: DepositQueueState }
	| {
			action: "wait"
			event: TransitionEvent
			signature: string
			details: Record<string, unknown>
			analysis: DepositQueueState | WithdrawalQueueState
	  }
	| {
			action: "finalize"
			claimableIndex?: number
			analysis: DepositQueueState | WithdrawalQueueState
	  }
	| { action: "cancel"; cancelMarker?: string; analysis: DepositQueueState }
	| { action: "complete"; analysis: DepositQueueState | WithdrawalQueueState }
	| { action: "cancelled"; analysis: DepositQueueState }

export type TransitionEvent =
	| "MARK_SUBMITTED"
	| "MARK_WAITING_SUBMISSION"
	| "MARK_WAITING_PRIOR_CLAIMS"
	| "MARK_WAITING_FINALIZATION"
	| "MARK_RETRYING"
	| "MARK_FINALIZING"
	| "MARK_CANCELLING"
	| "MARK_COMPLETED"
	| "MARK_CANCELLED"
	| "MARK_FAILED"

export const OPERATION_STATE_BY_EVENT = {
	MARK_SUBMITTED: { phase: "submitted", status: "running" },
	MARK_WAITING_SUBMISSION: { phase: "waiting-submission", status: "running" },
	MARK_WAITING_PRIOR_CLAIMS: { phase: "waiting-prior-claims", status: "running" },
	MARK_WAITING_FINALIZATION: { phase: "waiting-finalization", status: "running" },
	MARK_RETRYING: { phase: "retrying", status: "running" },
	MARK_FINALIZING: { phase: "finalizing", status: "running" },
	MARK_CANCELLING: { phase: "canceling", status: "running" },
	MARK_COMPLETED: { phase: "completed", status: "completed" },
	MARK_CANCELLED: { phase: "cancelled", status: "cancelled" },
	MARK_FAILED: { phase: "failed", status: "failed" }
} satisfies Record<TransitionEvent, { phase: OperationPhase; status: OperationStatus }>

const toPendingCancelMarker = ({
	currentTargetIndex,
	claimableIndex,
	pendingAhead,
	isCurrentTarget
}: {
	currentTargetIndex?: number
	claimableIndex?: number
	pendingAhead: number
	isCurrentTarget: boolean
}): string =>
	isCurrentTarget
		? `current:${currentTargetIndex ?? "none"}`
		: `prior:${claimableIndex ?? "none"}:${pendingAhead}`

export const capabilityDiagnostic = (
	value: boolean | BridgeCapabilityDiagnostic
): BridgeCapabilityDiagnostic =>
	typeof value === "boolean" ? { available: value, reason: null } : value

const capabilityAppliesToIndex = (
	diagnostic: BridgeCapabilityDiagnostic,
	index: number | undefined
): boolean => index !== undefined && (diagnostic.index === undefined || diagnostic.index === index)

const isAlreadyFinalisedWithdrawal = (diagnostic: BridgeCapabilityDiagnostic): boolean =>
	diagnostic.status === "alreadyFinalised" || diagnostic.reason === "Withdrawal already finalised"

const pendingFinalizeState = ({
	session,
	claimableIndex,
	now
}: {
	session: OperationSession
	claimableIndex?: number
	now: () => string
}) => {
	if (claimableIndex === undefined || session.pendingFinalizeIndex !== claimableIndex) {
		return { isPending: false, isStale: false }
	}
	if (!session.pendingFinalizeSubmittedAt) return { isPending: true, isStale: true }
	const submittedAt = Date.parse(session.pendingFinalizeSubmittedAt)
	const current = Date.parse(now())
	return {
		isPending: true,
		isStale: Number.isNaN(submittedAt) || Number.isNaN(current) || current - submittedAt >= 180_000
	}
}

export const decideDepositStep = ({
	session,
	statuses,
	canFinalize,
	canCancel,
	now = () => new Date().toISOString()
}: {
	session: OperationSession
	statuses: DepositStatus[]
	canFinalize: BridgeCapabilityDiagnostic
	canCancel: BridgeCapabilityDiagnostic
	now?: () => string
}): Decision => {
	const sorted = sortByIndex(statuses)
	const hasSubmittedDeposit = getSubmitHash(session) !== undefined
	const unresolved = sorted.filter((status) => !status.finalised && !status.cancelled)
	const analysis = analyzeDepositQueue({
		session: hasSubmittedDeposit ? session : { ...session, targetIndex: undefined },
		statuses: sorted
	})
	const { target, targetIndex, claimableIndex, pendingAhead, blockingAhead, skippableAhead } =
		analysis
	if (!hasSubmittedDeposit && unresolved.length === 0) return { action: "submit", analysis }
	if (hasSubmittedDeposit && target?.cancelled) return { action: "cancelled", analysis }
	if (hasSubmittedDeposit && target?.finalised) return { action: "complete", analysis }

	const effectiveClaimableIndex = resolveEffectiveDepositClaimableIndex({
		claimableIndex: canFinalize.index ?? claimableIndex,
		target,
		pendingAhead,
		canFinalize: canFinalize.available
	})
	const retry = pendingFinalizeState({
		session,
		claimableIndex: effectiveClaimableIndex ?? targetIndex,
		now
	})
	const currentCancelMarker = toPendingCancelMarker({
		currentTargetIndex: target?.index,
		claimableIndex,
		pendingAhead,
		isCurrentTarget: true
	})
	const priorCancelMarker = toPendingCancelMarker({
		currentTargetIndex: target?.index,
		claimableIndex,
		pendingAhead,
		isCurrentTarget: false
	})
	const shouldCancelCurrent =
		hasSubmittedDeposit &&
		target !== undefined &&
		pendingAhead === 0 &&
		!canFinalize.available &&
		canCancel.available &&
		session.pendingCancelMarker !== currentCancelMarker
	const shouldCancelPrior =
		canCancel.available &&
		(skippableAhead > 0 || (!hasSubmittedDeposit && target !== undefined && pendingAhead === 0)) &&
		session.pendingCancelMarker !== priorCancelMarker
	const shouldFinalize =
		canFinalize.available &&
		capabilityAppliesToIndex(canFinalize, effectiveClaimableIndex) &&
		(!retry.isPending || retry.isStale) &&
		skippableAhead === 0 &&
		!shouldCancelCurrent

	if (shouldFinalize)
		return { action: "finalize", analysis, claimableIndex: effectiveClaimableIndex }
	if (shouldCancelCurrent || shouldCancelPrior) {
		return {
			action: "cancel",
			analysis,
			cancelMarker: shouldCancelCurrent ? currentCancelMarker : priorCancelMarker
		}
	}
	if (analysis.shouldAdvanceQueuedClaims) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_PRIOR_CLAIMS",
			signature: `prior:${targetIndex ?? "unknown"}:${claimableIndex ?? "none"}:${pendingAhead}:${blockingAhead}:${skippableAhead}`,
			details: {
				waiting: "prior-claims",
				targetIndex,
				pendingAhead,
				blockingAhead,
				skippableAhead,
				claimIndex: effectiveClaimableIndex ?? claimableIndex
			}
		}
	}
	if (!target) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_SUBMISSION",
			signature: "submission:pending",
			details: { waiting: "submission", submitHash: getSubmitHash(session) }
		}
	}
	return {
		action: "wait",
		analysis,
		event: "MARK_WAITING_FINALIZATION",
		signature: `finalization:${target.index}:${claimableIndex ?? "none"}`,
		details: {
			waiting: "finalization",
			targetIndex: target.index,
			claimIndex: effectiveClaimableIndex ?? claimableIndex
		}
	}
}

export const decideWithdrawalStep = ({
	session,
	statuses,
	canFinalize,
	now = () => new Date().toISOString()
}: {
	session: OperationSession
	statuses: WithdrawalStatus[]
	canFinalize: BridgeCapabilityDiagnostic
	now?: () => string
}): Decision => {
	const analysis = analyzeWithdrawalQueue({ session, statuses: sortByIndex(statuses) })
	const { target, targetIndex, claimableIndex, pendingAhead, shouldAdvanceQueuedClaims } = analysis
	if (target?.finalised) return { action: "complete", analysis }
	if (
		target?.committed &&
		pendingAhead === 0 &&
		isAlreadyFinalisedWithdrawal(canFinalize) &&
		canFinalize.index === target.index
	) {
		return { action: "complete", analysis }
	}
	const retry = pendingFinalizeState({ session, claimableIndex, now })
	if (
		canFinalize.available &&
		claimableIndex !== undefined &&
		capabilityAppliesToIndex(canFinalize, claimableIndex) &&
		(!retry.isPending || retry.isStale) &&
		(shouldAdvanceQueuedClaims || claimableIndex === target?.index)
	) {
		return { action: "finalize", analysis, claimableIndex }
	}
	if (target && !target.committed && !shouldAdvanceQueuedClaims) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_SUBMISSION",
			signature: `submission:commit:${target.index}`,
			details: {
				waiting: "submission",
				targetIndex: target.index,
				submitHash: getSubmitHash(session)
			}
		}
	}
	if (shouldAdvanceQueuedClaims) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_PRIOR_CLAIMS",
			signature: `prior:${targetIndex ?? "unknown"}:${claimableIndex ?? "none"}:${pendingAhead}`,
			details: {
				waiting: "prior-claims",
				targetIndex,
				pendingAhead,
				claimIndex: claimableIndex,
				finalizeAvailable: canFinalize.available,
				finalizeReason: canFinalize.reason
			}
		}
	}
	if (!target || !target.committed) {
		return {
			action: "wait",
			analysis,
			event: "MARK_WAITING_SUBMISSION",
			signature: target ? `submission:commit:${target.index}` : "submission:pending",
			details: {
				waiting: "submission",
				targetIndex: target?.index,
				submitHash: getSubmitHash(session)
			}
		}
	}
	return {
		action: "wait",
		analysis,
		event: "MARK_WAITING_FINALIZATION",
		signature: `finalization:${target.index}:${claimableIndex ?? "none"}`,
		details: {
			waiting: "finalization",
			targetIndex: target.index,
			claimIndex: claimableIndex,
			finalizeAvailable: canFinalize.available,
			finalizeReason: canFinalize.reason
		}
	}
}
