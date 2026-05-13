import { randomUUID } from "node:crypto"
import path from "node:path"
import { isInsufficientFirstWithdrawalAmountError } from "@zeko-labs/bridge-sdk"
import { defineCommand, type CommandDef } from "citty"
import { readAliasedNumber, readAliasedString, readBoolean, readRequired, readString } from "./args"
import {
	OPERATION_STATE_BY_EVENT,
	capabilityDiagnostic,
	decideDepositStep,
	decideWithdrawalStep,
	getSubmitHash,
	resolveEffectiveDepositClaimableIndex,
	sortByIndex,
	type DepositQueueState,
	type Decision,
	type TransitionEvent,
	type WithdrawalQueueState
} from "./decisions"
import { resolveAppPaths } from "./env"
import { formatRoute, parseChainRef, resolveRoute } from "./routes"
import { createDefaultBridgeAdapter, deriveAccount, resolveDepositTimeoutSlots } from "./sdk"
import {
	createOperationLogger,
	createProgressLog,
	createSessionStore,
	renderBridgeResult,
	toBridgeJsonResult,
	type SessionStore
} from "./session"
import type {
	BridgeAdapter,
	BridgeAdapterFactory,
	BridgeCapabilityDiagnostic,
	BridgeSdkCallTrace,
	BridgeSdkOperation,
	BridgeVerboseDiagnostics,
	ChainRef,
	LogFn,
	OperationPhase,
	OperationSession
} from "./types"
import { formatErrorMessage, sleepFor } from "./utils"

const RETRY_SLEEP_MS = 5_000
const HEARTBEAT_INTERVAL_MS = 30_000

const transition = (
	session: OperationSession,
	event: TransitionEvent,
	now: () => string,
	patch: Partial<OperationSession> = {}
): OperationSession => {
	const timestamp = now()
	const next = OPERATION_STATE_BY_EVENT[event]
	return {
		...session,
		...patch,
		phase: next.phase,
		status: next.status,
		updatedAt: timestamp,
		verboseDiagnostics: session.verboseDiagnostics
			? updatePhaseTiming(session.verboseDiagnostics, timestamp, next.phase)
			: undefined
	}
}

const updatePhaseTiming = (
	diagnostics: BridgeVerboseDiagnostics,
	now: string,
	nextPhase: OperationPhase
): BridgeVerboseDiagnostics => {
	const phaseTimings = [...diagnostics.phaseTimings]
	const current = phaseTimings.at(-1)
	if (!current)
		return { ...diagnostics, phaseTimings: [{ phase: nextPhase, startedAt: now, durationMs: 0 }] }
	const elapsed = Math.max(0, Date.parse(now) - Date.parse(current.startedAt))
	const closed = {
		...current,
		endedAt: now,
		durationMs: Number.isNaN(elapsed) ? current.durationMs : elapsed
	}
	if (current.phase === nextPhase) {
		phaseTimings[phaseTimings.length - 1] = { ...closed, endedAt: undefined }
		return { ...diagnostics, phaseTimings }
	}
	phaseTimings[phaseTimings.length - 1] = closed
	phaseTimings.push({ phase: nextPhase, startedAt: now, durationMs: 0 })
	return { ...diagnostics, phaseTimings }
}

const createVerboseDiagnostics = (
	startedAt: string,
	phase: OperationPhase
): BridgeVerboseDiagnostics => ({
	sdkCalls: [],
	sdkMethodStats: {},
	phaseTimings: [{ phase, startedAt, durationMs: 0 }],
	waitReasons: {}
})

const recordSdkCall = (session: OperationSession, trace: BridgeSdkCallTrace): OperationSession => {
	if (!session.verboseDiagnostics) return session
	const sdkCalls = [...session.verboseDiagnostics.sdkCalls, trace]
	const stats: BridgeVerboseDiagnostics["sdkMethodStats"] = {}
	for (const call of sdkCalls) {
		const previous = stats[call.operation]
		stats[call.operation] = {
			count: (previous?.count ?? 0) + 1,
			successCount: (previous?.successCount ?? 0) + (call.success ? 1 : 0),
			errorCount: (previous?.errorCount ?? 0) + (call.success ? 0 : 1),
			totalDurationMs: (previous?.totalDurationMs ?? 0) + call.durationMs,
			lastStartedAt: call.startedAt,
			lastEndedAt: call.endedAt,
			lastDurationMs: call.durationMs,
			lastMessage: call.message,
			lastResult: call.result
		}
	}
	return {
		...session,
		verboseDiagnostics: { ...session.verboseDiagnostics, sdkCalls, sdkMethodStats: stats }
	}
}

const recordWaitReason = (
	session: OperationSession,
	key: "canFinalizeDeposit" | "canCancelDeposit" | "canFinalizeWithdrawal",
	diagnostic: BridgeCapabilityDiagnostic
): OperationSession =>
	session.verboseDiagnostics
		? {
				...session,
				verboseDiagnostics: {
					...session.verboseDiagnostics,
					waitReasons: { ...session.verboseDiagnostics.waitReasons, [key]: diagnostic }
				}
			}
		: session

const mergeDiagnostics = (
	session: OperationSession,
	sources: OperationSession[]
): OperationSession => {
	if (!session.verboseDiagnostics) return sources.at(-1) ?? session
	const baseCount = session.verboseDiagnostics.sdkCalls.length
	return sources.reduce((next, source) => {
		if (!source.verboseDiagnostics) return next
		const calls = source.verboseDiagnostics.sdkCalls.slice(baseCount)
		return calls.reduce(recordSdkCall, next)
	}, session)
}

const summarizeSdkResult = (value: unknown): string | undefined => {
	if (typeof value === "boolean") return String(value)
	if (Array.isArray(value)) return `count=${value.length}`
	if (typeof value !== "object" || value === null) return undefined
	if ("available" in value && typeof value.available === "boolean")
		return `available=${String(value.available)}`
	return "hash" in value && typeof value.hash === "string" ? `hash=${value.hash}` : undefined
}

const durationMs = (startedAt: string, endedAt: string) => {
	const start = Date.parse(startedAt)
	const end = Date.parse(endedAt)
	return Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.max(0, end - start)
}

const appendTransaction = (
	session: OperationSession,
	transaction: { action: "submit" | "finalize" | "cancel"; hash: string }
) => ({ submittedTransactions: [...session.submittedTransactions, transaction] })

const persist = async (
	session: OperationSession,
	sessionStore: Pick<SessionStore, "save">,
	log: LogFn,
	event: string,
	details?: Record<string, unknown>
) => {
	await sessionStore.save(session)
	await log({ event, phase: session.phase, details })
}

const withRetry = async <T>({
	session,
	sessionStore,
	log,
	sleep,
	retryDelayMs,
	now,
	operation,
	shouldRetry,
	run
}: {
	session: OperationSession
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	sleep: (ms: number) => Promise<void>
	retryDelayMs?: number
	now: () => string
	operation: BridgeSdkOperation
	shouldRetry?: (error: unknown) => boolean
	run: () => Promise<T>
}): Promise<{ session: OperationSession; value: T }> => {
	let currentSession = session
	for (let attempt = 1; ; attempt += 1) {
		const startedAt = now()
		try {
			const value = await run()
			const endedAt = now()
			return {
				value,
				session: recordSdkCall(currentSession, {
					operation,
					attempt,
					startedAt,
					endedAt,
					durationMs: durationMs(startedAt, endedAt),
					success: true,
					result: summarizeSdkResult(value)
				})
			}
		} catch (error) {
			const endedAt = now()
			currentSession = recordSdkCall(currentSession, {
				operation,
				attempt,
				startedAt,
				endedAt,
				durationMs: durationMs(startedAt, endedAt),
				success: false,
				message: formatErrorMessage(error)
			})
			if (shouldRetry && !shouldRetry(error)) throw error
			currentSession = transition(currentSession, "MARK_RETRYING", now, {
				lastError: formatErrorMessage(error)
			})
			await persist(currentSession, sessionStore, log, "retrying", {
				operation,
				message: formatErrorMessage(error)
			})
			await sleep(retryDelayMs ?? RETRY_SLEEP_MS)
		}
	}
}

const isRecoverableMutationError = (error: unknown): boolean => {
	const message = formatErrorMessage(error)
	return (
		/Failed to fetch|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|Failed to fetch proved forest|No key returned from mutation/i.test(
			message
		) && !isInsufficientFirstWithdrawalAmountError(error)
	)
}

const isTransientClaimUnavailableError = (error: unknown): boolean =>
	[
		/Did not find any (deposit|withdrawal) to finalize/i,
		/No (deposit|withdrawal) witnesses found/i,
		/No earliest before state found/i,
		/No my (deposit|withdrawal) index found/i,
		/No next commit index found/i,
		/No synced outer action state index found/i
	].some((pattern) => pattern.test(formatErrorMessage(error)))

const completeSession = async ({
	session,
	sessionStore,
	log,
	now,
	finalTransaction
}: {
	session: OperationSession
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
	finalTransaction?: OperationSession["finalTransaction"]
}) => {
	const completed = transition(
		session,
		"MARK_COMPLETED",
		now,
		finalTransaction ? { finalTransaction } : {}
	)
	await persist(completed, sessionStore, log, "completed", {
		hash: completed.finalTransaction?.hash
	})
	return completed
}

const failSession = async ({
	session,
	sessionStore,
	log,
	now,
	error
}: {
	session: OperationSession
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
	error: string
}) => {
	const failed = transition(session, "MARK_FAILED", now, { lastError: error })
	await persist(failed, sessionStore, log, "failed", { message: error })
	return failed
}

const emitHeartbeat = async ({
	session,
	now,
	pollIntervalMs,
	tracker,
	log,
	details
}: {
	session: OperationSession
	now: () => string
	pollIntervalMs: number
	tracker: {
		lastWaitSignature?: string
		lastHeartbeatBucket?: number
		emittedImmediateHeartbeat: boolean
	}
	log: LogFn
	details: Record<string, unknown>
}) => {
	const elapsedSeconds = Math.max(
		0,
		Math.floor((Date.parse(now()) - Date.parse(session.createdAt)) / 1000)
	)
	if (pollIntervalMs === 0) {
		if (!tracker.emittedImmediateHeartbeat) {
			tracker.emittedImmediateHeartbeat = true
			await log({
				event: "heartbeat",
				phase: session.phase,
				details: { elapsedSeconds, ...details }
			})
		}
		return
	}
	const interval = Math.max(pollIntervalMs, HEARTBEAT_INTERVAL_MS)
	const bucket = Math.floor((elapsedSeconds * 1_000) / interval)
	if (bucket > 0 && bucket !== tracker.lastHeartbeatBucket) {
		tracker.lastHeartbeatBucket = bucket
		await log({ event: "heartbeat", phase: session.phase, details: { elapsedSeconds, ...details } })
	}
}

type BridgeFlowDeps = {
	adapter: Partial<BridgeAdapter>
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	sleep: (ms: number) => Promise<void>
	pollIntervalMs: number
	retryDelayMs?: number
	now?: () => string
	verbose?: boolean
}

type BridgeFlowInput = {
	id: string
	from: ChainRef
	to: ChainRef
	amount: string
	account: string
	recipient?: string
	timeoutSlots?: number
	session?: OperationSession
}

const method = <T extends keyof BridgeAdapter>(
	adapter: Partial<BridgeAdapter>,
	name: T
): NonNullable<BridgeAdapter[T]> => {
	const value = adapter[name]
	if (!value) throw new Error(`Adapter does not implement ${String(name)}`)
	return value as NonNullable<BridgeAdapter[T]>
}

const initialSession = (input: BridgeFlowInput, deps: BridgeFlowDeps): OperationSession => {
	const route = resolveRoute(input.from, input.to)
	const now = deps.now ?? (() => new Date().toISOString())
	const createdAt = now()
	const session =
		input.session ??
		({
			id: input.id,
			status: "running",
			phase: "initializing",
			route: formatRoute(input.from, input.to),
			direction: route.direction,
			account: input.account,
			recipient: input.recipient ?? input.account,
			amount: input.amount,
			timeoutSlots: input.timeoutSlots,
			logPath: "",
			createdAt,
			updatedAt: createdAt,
			submittedTransactions: []
		} satisfies OperationSession)
	return deps.verbose && !session.verboseDiagnostics
		? { ...session, verboseDiagnostics: createVerboseDiagnostics(session.createdAt, session.phase) }
		: session
}

export const runBridgeOperation = async (
	input: BridgeFlowInput,
	deps: BridgeFlowDeps
): Promise<OperationSession> => {
	let session = initialSession(input, deps)
	const now = deps.now ?? (() => new Date().toISOString())
	const tracker = { emittedImmediateHeartbeat: false } as {
		lastWaitSignature?: string
		lastHeartbeatBucket?: number
		emittedImmediateHeartbeat: boolean
	}
	await persist(session, deps.sessionStore, deps.log, "initialized")

	const setWait = async (
		decision: Extract<Decision, { action: "wait" }>,
		patch: Partial<OperationSession> = {}
	) => {
		if (tracker.lastWaitSignature === decision.signature) {
			session = { ...session, ...patch, updatedAt: now() }
			return
		}
		session = transition(session, decision.event, now, patch)
		tracker.lastWaitSignature = decision.signature
		tracker.emittedImmediateHeartbeat = false
		await persist(
			session,
			deps.sessionStore,
			deps.log,
			decision.details.waiting === "prior-claims"
				? "waiting-on-prior-claims"
				: decision.details.waiting === "submission"
					? "waiting-for-submission"
					: "waiting-for-finalization",
			decision.details
		)
	}

	while (session.status === "running") {
		try {
			if (session.direction === "withdrawal" && session.submittedTransactions.length === 0) {
				const submit = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "submitWithdrawal",
					shouldRetry: isRecoverableMutationError,
					run: () =>
						method(
							deps.adapter,
							"submitWithdrawal"
						)({
							account: session.account,
							recipient: session.recipient,
							amount: session.amount,
							wait: false
						})
				})
				session = transition(
					submit.session,
					"MARK_SUBMITTED",
					now,
					appendTransaction(submit.session, { action: "submit", hash: submit.value.hash })
				)
				await persist(session, deps.sessionStore, deps.log, "submitted", {
					hash: submit.value.hash
				})
				continue
			}

			if (session.direction === "deposit") {
				const statusesResult = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "getDepositStatuses",
					run: () => method(deps.adapter, "getDepositStatuses")(session.account)
				})
				session = statusesResult.session
				const statuses = sortByIndex(statusesResult.value)
				const hasSubmit = getSubmitHash(session) !== undefined
				let decision = decideDepositStep({
					session,
					statuses,
					canFinalize: { available: false, reason: null },
					canCancel: { available: false, reason: null },
					now
				})
				const initialAnalysis = decision.analysis as DepositQueueState
				if (
					hasSubmit &&
					initialAnalysis.targetIndex !== undefined &&
					session.targetIndex !== initialAnalysis.targetIndex
				) {
					session = { ...session, targetIndex: initialAnalysis.targetIndex, updatedAt: now() }
					await deps.sessionStore.save(session)
				}
				if (decision.action === "submit") {
					const submit = await withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "submitDeposit",
						shouldRetry: isRecoverableMutationError,
						run: () =>
							method(
								deps.adapter,
								"submitDeposit"
							)({
								account: session.account,
								recipient: session.recipient,
								amount: session.amount,
								timeoutSlots: session.timeoutSlots,
								wait: false
							})
					})
					session = transition(
						submit.session,
						"MARK_SUBMITTED",
						now,
						appendTransaction(submit.session, { action: "submit", hash: submit.value.hash })
					)
					await persist(session, deps.sessionStore, deps.log, "submitted", {
						hash: submit.value.hash
					})
					continue
				}
				if (decision.action === "cancelled") {
					session = transition(session, "MARK_CANCELLED", now)
					await persist(session, deps.sessionStore, deps.log, "cancelled")
					break
				}
				if (decision.action === "complete") {
					const target = initialAnalysis.target
					session = await completeSession({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						now,
						finalTransaction:
							session.finalTransaction ??
							(target ? { action: "finalize", hash: target.hash, explorerUrl: "" } : undefined)
					})
					break
				}
				if (decision.action === "wait") {
					await setWait(
						decision,
						decision.event === "MARK_WAITING_FINALIZATION"
							? { targetIndex: hasSubmit ? initialAnalysis.target?.index : undefined }
							: decision.event === "MARK_WAITING_PRIOR_CLAIMS"
								? {
										targetIndex: hasSubmit ? initialAnalysis.targetIndex : undefined,
										queueAdvances: session.queueAdvances ?? 0
									}
								: {}
					)
				}
				const [canFinalizeResult, canCancelResult] = await Promise.all([
					withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "canFinalizeDeposit",
						run: async () =>
							capabilityDiagnostic(
								await (deps.adapter.canFinalizeDeposit?.(session.account) ?? false)
							)
					}),
					withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "canCancelDeposit",
						run: async () =>
							capabilityDiagnostic(
								await (deps.adapter.canCancelDeposit?.(session.account) ?? false)
							)
					})
				])
				session = mergeDiagnostics(session, [canFinalizeResult.session, canCancelResult.session])
				session = recordWaitReason(
					recordWaitReason(session, "canFinalizeDeposit", canFinalizeResult.value),
					"canCancelDeposit",
					canCancelResult.value
				)
				decision = decideDepositStep({
					session,
					statuses,
					canFinalize: canFinalizeResult.value,
					canCancel: canCancelResult.value,
					now
				})
				const analysis = decision.analysis as DepositQueueState
				if (decision.action === "finalize") {
					const effectiveClaimableIndex = resolveEffectiveDepositClaimableIndex({
						claimableIndex: decision.claimableIndex ?? analysis.claimableIndex,
						target: analysis.target,
						pendingAhead: analysis.pendingAhead,
						canFinalize: true
					})
					try {
						const finalized = await withRetry({
							session,
							sessionStore: deps.sessionStore,
							log: deps.log,
							sleep: deps.sleep,
							retryDelayMs: deps.retryDelayMs,
							now,
							operation: "finalizeDeposit",
							shouldRetry: isRecoverableMutationError,
							run: () =>
								method(deps.adapter, "finalizeDeposit")({ account: session.account, wait: false })
						})
						session = transition(finalized.session, "MARK_FINALIZING", now, {
							...appendTransaction(finalized.session, {
								action: "finalize",
								hash: finalized.value.hash
							}),
							finalTransaction:
								hasSubmit && analysis.target && effectiveClaimableIndex === analysis.target.index
									? {
											action: "finalize",
											hash: finalized.value.hash,
											explorerUrl: finalized.value.explorerUrl
										}
									: session.finalTransaction,
							pendingFinalizeIndex: effectiveClaimableIndex,
							pendingFinalizeSubmittedAt: now(),
							queueAdvances: analysis.shouldAdvanceQueuedClaims
								? (session.queueAdvances ?? 0) + 1
								: session.queueAdvances
						})
						tracker.lastWaitSignature = undefined
						tracker.emittedImmediateHeartbeat = false
						await persist(session, deps.sessionStore, deps.log, "finalized", {
							hash: finalized.value.hash,
							claimIndex: effectiveClaimableIndex,
							advancedPriorClaim: analysis.shouldAdvanceQueuedClaims
						})
					} catch (error) {
						if (!isTransientClaimUnavailableError(error)) throw error
						await deps.log({
							event: "claim-pending",
							phase: session.phase,
							details: { claimIndex: effectiveClaimableIndex, message: formatErrorMessage(error) }
						})
					}
					continue
				}
				if (decision.action === "cancel") {
					const canceled = await withRetry({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "cancelDeposit",
						shouldRetry: isRecoverableMutationError,
						run: () =>
							method(deps.adapter, "cancelDeposit")({ account: session.account, wait: false })
					})
					const cancellingCurrent =
						hasSubmit && analysis.target !== undefined && analysis.pendingAhead === 0
					session = transition(canceled.session, "MARK_CANCELLING", now, {
						...appendTransaction(canceled.session, { action: "cancel", hash: canceled.value.hash }),
						finalTransaction: cancellingCurrent
							? {
									action: "cancel",
									hash: canceled.value.hash,
									explorerUrl: canceled.value.explorerUrl
								}
							: session.finalTransaction,
						pendingCancelMarker: decision.cancelMarker,
						queueAdvances: analysis.shouldAdvanceQueuedClaims
							? (session.queueAdvances ?? 0) + 1
							: session.queueAdvances
					})
					tracker.lastWaitSignature = undefined
					tracker.emittedImmediateHeartbeat = false
					await persist(session, deps.sessionStore, deps.log, "cancel-submitted", {
						hash: canceled.value.hash,
						advancedPriorClaim: analysis.shouldAdvanceQueuedClaims,
						pendingAhead: analysis.pendingAhead,
						claimIndex: analysis.claimableIndex
					})
					continue
				}
				if (decision.action === "wait") {
					await emitHeartbeat({
						session,
						now,
						pollIntervalMs: deps.pollIntervalMs,
						tracker,
						log: deps.log,
						details: decision.details
					})
					await deps.sleep(deps.pollIntervalMs)
					continue
				}
			}

			if (session.direction === "withdrawal") {
				const statusesResult = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "getWithdrawalStatuses",
					run: () => method(deps.adapter, "getWithdrawalStatuses")(session.account)
				})
				session = statusesResult.session
				const statuses = sortByIndex(statusesResult.value)
				let decision = decideWithdrawalStep({
					session,
					statuses,
					canFinalize: { available: false, reason: null },
					now
				})
				const initialAnalysis = decision.analysis as WithdrawalQueueState
				if (
					initialAnalysis.targetIndex !== undefined &&
					session.targetIndex !== initialAnalysis.targetIndex
				) {
					session = { ...session, targetIndex: initialAnalysis.targetIndex, updatedAt: now() }
					await deps.sessionStore.save(session)
				}
				if (decision.action === "complete") {
					const target = initialAnalysis.target
					session = await completeSession({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						now,
						finalTransaction:
							session.finalTransaction ??
							(target ? { action: "finalize", hash: target.hash, explorerUrl: "" } : undefined)
					})
					break
				}
				if (decision.action === "wait") {
					await setWait(
						decision,
						decision.event === "MARK_WAITING_FINALIZATION" && initialAnalysis.target
							? { targetIndex: initialAnalysis.target.index }
							: decision.event === "MARK_WAITING_PRIOR_CLAIMS"
								? {
										targetIndex: initialAnalysis.targetIndex,
										queueAdvances: session.queueAdvances ?? 0
									}
								: {}
					)
					if (
						decision.event === "MARK_WAITING_SUBMISSION" &&
						initialAnalysis.target &&
						!initialAnalysis.target.committed
					) {
						await emitHeartbeat({
							session,
							now,
							pollIntervalMs: deps.pollIntervalMs,
							tracker,
							log: deps.log,
							details: decision.details
						})
						await deps.sleep(deps.pollIntervalMs)
						continue
					}
				}
				const canFinalize = await withRetry({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					sleep: deps.sleep,
					retryDelayMs: deps.retryDelayMs,
					now,
					operation: "canFinalizeWithdrawal",
					shouldRetry: (error) => !isInsufficientFirstWithdrawalAmountError(error),
					run: async () =>
						capabilityDiagnostic(
							await (deps.adapter.canFinalizeWithdrawal?.(session.account) ?? false)
						)
				})
				session = recordWaitReason(canFinalize.session, "canFinalizeWithdrawal", canFinalize.value)
				decision = decideWithdrawalStep({ session, statuses, canFinalize: canFinalize.value, now })
				const analysis = decision.analysis as WithdrawalQueueState
				if (decision.action === "complete") {
					session = await completeSession({
						session,
						sessionStore: deps.sessionStore,
						log: deps.log,
						now,
						finalTransaction: session.finalTransaction ?? {
							action: "finalize",
							hash: analysis.target?.hash ?? getSubmitHash(session) ?? "",
							explorerUrl: ""
						}
					})
					break
				}
				if (decision.action === "finalize") {
					try {
						const finalized = await withRetry({
							session,
							sessionStore: deps.sessionStore,
							log: deps.log,
							sleep: deps.sleep,
							retryDelayMs: deps.retryDelayMs,
							now,
							operation: "finalizeWithdrawal",
							shouldRetry: isRecoverableMutationError,
							run: () =>
								method(
									deps.adapter,
									"finalizeWithdrawal"
								)({ account: session.account, wait: false })
						})
						session = transition(finalized.session, "MARK_FINALIZING", now, {
							...appendTransaction(finalized.session, {
								action: "finalize",
								hash: finalized.value.hash
							}),
							finalTransaction:
								analysis.target && analysis.claimableIndex === analysis.target.index
									? {
											action: "finalize",
											hash: finalized.value.hash,
											explorerUrl: finalized.value.explorerUrl
										}
									: session.finalTransaction,
							pendingFinalizeIndex: analysis.claimableIndex,
							pendingFinalizeSubmittedAt: now(),
							queueAdvances: analysis.shouldAdvanceQueuedClaims
								? (session.queueAdvances ?? 0) + 1
								: session.queueAdvances
						})
						tracker.lastWaitSignature = undefined
						tracker.emittedImmediateHeartbeat = false
						await persist(session, deps.sessionStore, deps.log, "finalized", {
							hash: finalized.value.hash,
							claimIndex: analysis.claimableIndex,
							advancedPriorClaim: analysis.shouldAdvanceQueuedClaims
						})
					} catch (error) {
						if (!isTransientClaimUnavailableError(error)) throw error
						await deps.log({
							event: "claim-pending",
							phase: session.phase,
							details: { claimIndex: analysis.claimableIndex, message: formatErrorMessage(error) }
						})
					}
					continue
				}
				if (decision.action === "wait") {
					await emitHeartbeat({
						session,
						now,
						pollIntervalMs: deps.pollIntervalMs,
						tracker,
						log: deps.log,
						details: decision.details
					})
					await deps.sleep(deps.pollIntervalMs)
				}
			}
		} catch (error) {
			session = await failSession({
				session,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: formatErrorMessage(error)
			})
			break
		}
	}

	return session
}

export const createAdapterWithRetries = async ({
	createAdapter,
	from,
	to,
	verbose,
	log,
	sleep,
	retryDelayMs
}: {
	createAdapter: BridgeAdapterFactory
	from: ChainRef
	to: ChainRef
	verbose: boolean
	log: LogFn
	sleep: (ms: number) => Promise<void>
	retryDelayMs: number
}): Promise<BridgeAdapter> => {
	for (let attempt = 1; ; attempt += 1) {
		try {
			return await createAdapter({ from, to, verbose })
		} catch (error) {
			const message = formatErrorMessage(error)
			if (
				/Missing required signer private key|Unsupported bridge route|Invalid private key/i.test(
					message
				)
			) {
				throw error
			}
			await log({
				event: "retrying",
				phase: "initializing",
				details: { operation: "Bridge.init", attempt, message }
			})
			await sleep(retryDelayMs)
		}
	}
}

type BridgeCommandDeps = {
	createAdapter?: BridgeAdapterFactory
	createStore?: (input: { stateDir: string }) => Pick<SessionStore, "save">
	createLogger?: (input: { logPath: string }) => Pick<
		ReturnType<typeof createOperationLogger>,
		"write"
	>
	now?: () => string
	resolvePaths?: typeof resolveAppPaths
	generateId?: () => string
	write?: (message: string) => void
	writeProgress?: (message: string) => void
	sleep?: (ms: number) => Promise<void>
	pollIntervalMs?: number
	retryDelayMs?: number
}

const commonBridgeArgs: NonNullable<CommandDef["args"]> = {
	from: { type: "string", default: "mina:testnet" },
	to: { type: "string", default: "zeko:testnet" },
	amount: { type: "string", required: true },
	account: { type: "string", required: false },
	recipient: { type: "string", required: false },
	timeoutSlots: { type: "string", required: false, alias: ["timeout-slots"] },
	pollIntervalMs: { type: "string", required: false, alias: ["poll-interval-ms"] },
	retryDelayMs: { type: "string", required: false, alias: ["retry-delay-ms"] },
	json: { type: "boolean", default: false },
	verbose: { type: "boolean", default: false }
}

export const createBridgeCommand = (deps: BridgeCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: { name: "bridge", description: "Run a full bridge flow from source to destination." },
		args: commonBridgeArgs,
		async run({ args }) {
			const from = parseChainRef(readString(args, "from") ?? "mina:testnet", "--from")
			const to = parseChainRef(readString(args, "to") ?? "zeko:testnet", "--to")
			const route = resolveRoute(from, to)
			const json = readBoolean(args, "json")
			const verbose = readBoolean(args, "verbose")
			const now = deps.now ?? (() => new Date().toISOString())
			const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
			const id = (deps.generateId ?? randomUUID)()
			const logPath = path.join(appPaths.logDir, `${id}.jsonl`)
			const logger = (deps.createLogger ?? createOperationLogger)({ logPath })
			const log = createProgressLog({ writeProgress: deps.writeProgress ?? console.error, logger })
			const sleep = deps.sleep ?? sleepFor
			const pollIntervalMs =
				readAliasedNumber(args, "pollIntervalMs", "poll-interval-ms", "--poll-interval-ms") ??
				deps.pollIntervalMs ??
				20_000
			const retryDelayMs =
				readAliasedNumber(args, "retryDelayMs", "retry-delay-ms", "--retry-delay-ms") ??
				deps.retryDelayMs
			const account = deriveAccount(from, readString(args, "account"))
			const recipient = readString(args, "recipient") ?? deriveAccount(to)
			const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
			const adapter = await createAdapterWithRetries({
				createAdapter: deps.createAdapter ?? createDefaultBridgeAdapter,
				from,
				to,
				verbose,
				log,
				sleep,
				retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
			})
			const session = await runBridgeOperation(
				{
					id,
					from,
					to,
					amount: readRequired(args, "amount", "Missing required --amount"),
					account,
					recipient,
					timeoutSlots: resolveDepositTimeoutSlots(
						readAliasedString(args, "timeoutSlots", "timeout-slots")
							? Number(readAliasedString(args, "timeoutSlots", "timeout-slots"))
							: undefined
					)
				},
				{
					adapter,
					sessionStore: store,
					log,
					sleep,
					pollIntervalMs,
					retryDelayMs,
					now,
					verbose
				}
			)
			const output = json
				? JSON.stringify(toBridgeJsonResult(session), null, 2)
				: renderBridgeResult(session)
			;(deps.write ?? console.log)(output)
			if (session.status === "failed") process.exitCode = 1
			void route
		}
	})
