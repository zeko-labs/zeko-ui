import type {
	BridgeCapabilityDiagnostic,
	BridgeSdkCallTrace,
	BridgeSdkMethodStat,
	BridgeSdkOperation,
	OperationPhase,
	OperationSession
} from "../types"

const buildSdkMethodStats = (
	calls: BridgeSdkCallTrace[]
): Partial<Record<BridgeSdkOperation, BridgeSdkMethodStat>> => {
	const stats: Partial<Record<BridgeSdkOperation, BridgeSdkMethodStat>> = {}

	for (const trace of calls) {
		const previous = stats[trace.operation]
		stats[trace.operation] = {
			count: (previous?.count ?? 0) + 1,
			successCount: (previous?.successCount ?? 0) + (trace.success ? 1 : 0),
			errorCount: (previous?.errorCount ?? 0) + (trace.success ? 0 : 1),
			totalDurationMs: (previous?.totalDurationMs ?? 0) + trace.durationMs,
			lastStartedAt: trace.startedAt,
			lastEndedAt: trace.endedAt,
			lastDurationMs: trace.durationMs,
			lastMessage: trace.message,
			lastResult: trace.result
		}
	}

	return stats
}

export const createVerboseDiagnostics = (
	startedAt: string,
	phase: OperationPhase
): NonNullable<OperationSession["verboseDiagnostics"]> => ({
	sdkCalls: [],
	sdkMethodStats: {},
	phaseTimings: [{ phase, startedAt, durationMs: 0 }],
	waitReasons: {}
})

export const withPhaseTiming = ({
	diagnostics,
	now,
	nextPhase
}: {
	diagnostics: NonNullable<OperationSession["verboseDiagnostics"]>
	now: string
	nextPhase: OperationPhase
}): NonNullable<OperationSession["verboseDiagnostics"]> => {
	const phaseTimings = [...diagnostics.phaseTimings]
	const current = phaseTimings.at(-1)

	if (!current) {
		return {
			...diagnostics,
			phaseTimings: [{ phase: nextPhase, startedAt: now, durationMs: 0 }]
		}
	}

	const elapsed = Math.max(0, Date.parse(now) - Date.parse(current.startedAt))
	const currentWithElapsed = {
		...current,
		endedAt: now,
		durationMs: Number.isNaN(elapsed) ? current.durationMs : elapsed
	}

	if (current.phase === nextPhase) {
		phaseTimings[phaseTimings.length - 1] = {
			...currentWithElapsed,
			endedAt: undefined
		}
		return { ...diagnostics, phaseTimings }
	}

	phaseTimings[phaseTimings.length - 1] = currentWithElapsed
	phaseTimings.push({ phase: nextPhase, startedAt: now, durationMs: 0 })
	return { ...diagnostics, phaseTimings }
}

export const withRecordedSdkCall = ({
	session,
	trace
}: {
	session: OperationSession
	trace: BridgeSdkCallTrace
}): OperationSession => {
	if (!session.verboseDiagnostics) return session

	const sdkCalls = [...session.verboseDiagnostics.sdkCalls, trace]
	return {
		...session,
		verboseDiagnostics: {
			...session.verboseDiagnostics,
			sdkCalls,
			sdkMethodStats: buildSdkMethodStats(sdkCalls)
		}
	}
}

export const withCapabilityWaitReason = ({
	session,
	key,
	diagnostic
}: {
	session: OperationSession
	key: "canFinalizeDeposit" | "canCancelDeposit" | "canFinalizeWithdrawal"
	diagnostic: BridgeCapabilityDiagnostic
}): OperationSession => {
	if (!session.verboseDiagnostics) return session

	return {
		...session,
		verboseDiagnostics: {
			...session.verboseDiagnostics,
			waitReasons: {
				...session.verboseDiagnostics.waitReasons,
				[key]: diagnostic
			}
		}
	}
}

export const mergeVerboseDiagnosticsFromSessions = ({
	session,
	sources
}: {
	session: OperationSession
	sources: OperationSession[]
}): OperationSession => {
	if (!session.verboseDiagnostics) return sources.at(-1) ?? session

	const baseCallCount = session.verboseDiagnostics.sdkCalls.length
	const sdkCalls = [...session.verboseDiagnostics.sdkCalls]
	const waitReasons = { ...(session.verboseDiagnostics.waitReasons ?? {}) }

	for (const source of sources) {
		if (!source.verboseDiagnostics) continue
		sdkCalls.push(...source.verboseDiagnostics.sdkCalls.slice(baseCallCount))
		Object.assign(waitReasons, source.verboseDiagnostics.waitReasons ?? {})
	}

	return {
		...session,
		verboseDiagnostics: {
			...session.verboseDiagnostics,
			sdkCalls,
			sdkMethodStats: buildSdkMethodStats(sdkCalls),
			waitReasons
		}
	}
}
