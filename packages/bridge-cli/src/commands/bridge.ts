import { randomUUID } from "node:crypto"
import path from "node:path"
import { defineCommand, type CommandDef } from "citty"
import { isInsufficientFirstWithdrawalAmountError } from "@zeko-labs/bridge-sdk"
import { PrivateKey } from "o1js"
import { assign, createActor, fromPromise, setup, toPromise } from "xstate"
import type { BridgeAdapter } from "../core/adapter"
import { createOperationLogger } from "../core/logger"
import { createOperationStateController } from "../core/operation-machine"
import { resolveAppPaths } from "../core/paths"
import {
	analyzeDepositQueue,
	analyzeWithdrawalQueue,
	type DepositQueueState,
	getSubmitHash,
	sortByIndex
} from "../core/bridge-queue"
import type { WithdrawalQueueState } from "../core/bridge-queue"
import { renderBridgeResult, renderOperationProgress, toBridgeJsonResult } from "../core/reporter"
import { formatRoute, parseChainRef, type ChainRef, resolveRoute } from "../core/routes"
import { resolveSignerKeys } from "../core/signer"
import { resolveDepositTimeoutSlots } from "../core/timeouts"
import { createSessionStore, type SessionStore } from "../core/session-store"
import type {
	BridgeCapabilityDiagnostic,
	BridgePhaseTiming,
	BridgeSdkCallTrace,
	BridgeSdkMethodStat,
	BridgeSdkOperation,
	BridgeVerboseDiagnostics,
	OperationPhase,
	OperationSession
} from "../core/types"

type LogFn = (entry: {
	event: string
	phase: OperationPhase
	details?: Record<string, unknown>
}) => Promise<void>

type BridgeFlowDeps = {
	adapter: Partial<
		Pick<
			BridgeAdapter,
			| "submitDeposit"
			| "finalizeDeposit"
			| "cancelDeposit"
			| "submitWithdrawal"
			| "finalizeWithdrawal"
			| "getDepositStatuses"
			| "getWithdrawalStatuses"
			| "canFinalizeDeposit"
			| "canCancelDeposit"
			| "canFinalizeWithdrawal"
		>
	>
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

type BridgeCommandDeps = {
	createAdapter?: (input: { from: ChainRef; to: ChainRef; verbose: boolean }) =>
		| Promise<BridgeAdapter>
		| BridgeAdapter
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

type BridgeCommandArgs = {
	from: { type: "string"; default: string }
	to: { type: "string"; default: string }
	amount: { type: "string"; required: true }
	account: { type: "string"; required: false }
	recipient: { type: "string"; required: false }
	timeoutSlots: { type: "string"; required: false }
	json: { type: "boolean"; default: false }
	verbose: { type: "boolean"; default: false }
}

type BridgeCommandRunArgs = {
	from?: string
	to?: string
	amount: string
	account?: string
	recipient?: string
	timeoutSlots?: string
	json?: boolean
	verbose?: boolean
}

type TransitionEvent =
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

type WaitStateTracker = {
	lastWaitSignature?: string
	lastHeartbeatBucket?: number
	emittedImmediateHeartbeat: boolean
}

const HEARTBEAT_INTERVAL_MS = 30_000
const RETRY_SLEEP_MS = 5_000
const FINALIZE_RETRY_AFTER_MS = 180_000

const getPendingFinalizeRetryState = ({
	session,
	claimableIndex,
	now
}: {
	session: OperationSession
	claimableIndex: number | undefined
	now: () => string
}): { isPending: boolean; isStale: boolean } => {
	if (claimableIndex === undefined || session.pendingFinalizeIndex !== claimableIndex) {
		return { isPending: false, isStale: false }
	}

	const submittedAt = session.pendingFinalizeSubmittedAt
	if (!submittedAt) {
		return { isPending: true, isStale: true }
	}

	const submittedAtMs = Date.parse(submittedAt)
	const nowMs = Date.parse(now())
	if (Number.isNaN(submittedAtMs) || Number.isNaN(nowMs)) {
		return { isPending: true, isStale: true }
	}

	return {
		isPending: true,
		isStale: nowMs - submittedAtMs >= FINALIZE_RETRY_AFTER_MS
	}
}

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
const persistSession = async ({
	session,
	sessionStore,
	log,
	event,
	details
}: {
	session: OperationSession
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	event: string
	details?: Record<string, unknown>
}) => {
	await sessionStore.save(session)
	await log({ event, phase: session.phase, details })
}

const transitionSession = ({
	controller,
	session,
	event,
	now,
	patch = {}
}: {
	controller: ReturnType<typeof createOperationStateController>
	session: OperationSession
	event: TransitionEvent
	now: () => string
	patch?: Partial<OperationSession>
}): OperationSession => {
	const next = controller.transition({ type: event })
	const timestamp = now()
	return {
		...session,
		...patch,
		phase: next.phase,
		status: next.status,
		updatedAt: timestamp,
		verboseDiagnostics: session.verboseDiagnostics
			? withPhaseTiming({
					diagnostics: session.verboseDiagnostics,
					now: timestamp,
					nextPhase: next.phase
				})
			: undefined
	}
}

const deriveAccount = (from: ChainRef, explicit?: string): string => {
	if (explicit) return explicit

	const keys = resolveSignerKeys()
	const secret = from.startsWith("zeko:") ? keys.zeko : keys.mina
	return PrivateKey.fromBase58(secret).toPublicKey().toBase58()
}

const parseOptionalString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined

const parseOptionalNumber = (value: unknown): number | undefined =>
	typeof value === "string" && value.length > 0 ? Number(value) : undefined

const parseBridgeCommandArgs = (args: BridgeCommandRunArgs) => ({
	from: parseChainRef(args.from ?? "mina:testnet", "--from"),
	to: parseChainRef(args.to ?? "zeko:testnet", "--to"),
	amount: String(args.amount),
	account: parseOptionalString(args.account),
	recipient: parseOptionalString(args.recipient),
	timeoutSlots: parseOptionalNumber(args.timeoutSlots),
	json: args.json === true,
	verbose: args.verbose === true
})

const requireAdapterMethod = <T extends keyof BridgeFlowDeps["adapter"]>(
	adapter: BridgeFlowDeps["adapter"],
	method: T
): NonNullable<BridgeFlowDeps["adapter"][T]> => {
	const value = adapter[method]
	if (!value) {
		throw new Error(`Adapter does not implement ${String(method)}`)
	}

	return value
}

const getCapabilityDiagnostic = async ({
	adapter,
	account,
	method
}: {
	adapter: BridgeFlowDeps["adapter"]
	account: string
	method: "canFinalizeDeposit" | "canCancelDeposit" | "canFinalizeWithdrawal"
}): Promise<BridgeCapabilityDiagnostic> => {
	const result = adapter[method] ? await adapter[method](account) : false
	return typeof result === "boolean" ? { available: result, reason: null } : result
}

const appendSubmittedTransaction = (
	session: OperationSession,
	transaction: { action: "submit" | "finalize" | "cancel"; hash: string }
) => ({
	submittedTransactions: [...session.submittedTransactions, transaction]
})

const getElapsedSeconds = (session: OperationSession, now: () => string): number => {
	const startedAt = Date.parse(session.createdAt)
	const currentTime = Date.parse(now())
	if (Number.isNaN(startedAt) || Number.isNaN(currentTime)) return 0
	return Math.max(0, Math.floor((currentTime - startedAt) / 1000))
}

const getHeartbeatBucket = ({
	elapsedSeconds,
	pollIntervalMs
}: {
	elapsedSeconds: number
	pollIntervalMs: number
}): number => {
	const intervalMs = Math.max(
		pollIntervalMs > 0 ? pollIntervalMs : HEARTBEAT_INTERVAL_MS,
		HEARTBEAT_INTERVAL_MS
	)
	return Math.floor((elapsedSeconds * 1_000) / intervalMs)
}

const formatErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

const createVerboseDiagnostics = (
	startedAt: string,
	phase: OperationPhase
): BridgeVerboseDiagnostics => ({
	sdkCalls: [],
	sdkMethodStats: {},
	phaseTimings: [{ phase, startedAt, durationMs: 0 }],
	waitReasons: {}
})

const summarizeSdkResult = (value: unknown): string | undefined => {
	if (typeof value === "boolean") {
		return String(value)
	}

	if (typeof value === "object" && value !== null) {
		if ("available" in value && typeof value.available === "boolean") {
			const reason =
				"reason" in value && typeof value.reason === "string" ? ` reason=${value.reason}` : ""
			return `available=${String(value.available)}${reason}`
		}

		if ("hash" in value && typeof value.hash === "string") {
			return `hash=${value.hash}`
		}

		if (Array.isArray(value)) {
			return `count=${value.length}`
		}
	}

	return undefined
}

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

const withRecordedSdkCall = ({
	session,
	trace
}: {
	session: OperationSession
	trace: BridgeSdkCallTrace
}): OperationSession => {
	if (!session.verboseDiagnostics) {
		return session
	}

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

const mergeVerboseDiagnosticsFromSessions = ({
	session,
	sources
}: {
	session: OperationSession
	sources: OperationSession[]
}): OperationSession => {
	if (!session.verboseDiagnostics) {
		return sources.at(-1) ?? session
	}

	const baseCallCount = session.verboseDiagnostics.sdkCalls.length
	const sdkCalls = [...session.verboseDiagnostics.sdkCalls]
	const waitReasons = { ...(session.verboseDiagnostics.waitReasons ?? {}) }

	for (const source of sources) {
		if (!source.verboseDiagnostics) {
			continue
		}

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

const withCapabilityWaitReason = ({
	session,
	key,
	diagnostic
}: {
	session: OperationSession
	key: "canFinalizeDeposit" | "canCancelDeposit" | "canFinalizeWithdrawal"
	diagnostic: BridgeCapabilityDiagnostic
}): OperationSession => {
	if (!session.verboseDiagnostics) {
		return session
	}

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

const withPhaseTiming = ({
	diagnostics,
	now,
	nextPhase
}: {
	diagnostics: BridgeVerboseDiagnostics
	now: string
	nextPhase: OperationPhase
}): BridgeVerboseDiagnostics => {
	const phaseTimings = [...diagnostics.phaseTimings]
	const current = phaseTimings.at(-1)

	if (!current) {
		return {
			...diagnostics,
			phaseTimings: [{ phase: nextPhase, startedAt: now, durationMs: 0 }]
		}
	}

	const elapsed = Math.max(0, Date.parse(now) - Date.parse(current.startedAt))
	const currentWithElapsed: BridgePhaseTiming = {
		...current,
		endedAt: now,
		durationMs: Number.isNaN(elapsed) ? current.durationMs : elapsed
	}

	if (current.phase === nextPhase) {
		phaseTimings[phaseTimings.length - 1] = {
			...currentWithElapsed,
			endedAt: undefined
		}

		return {
			...diagnostics,
			phaseTimings
		}
	}

	phaseTimings[phaseTimings.length - 1] = currentWithElapsed
	phaseTimings.push({ phase: nextPhase, startedAt: now, durationMs: 0 })

	return {
		...diagnostics,
		phaseTimings
	}
}

const RECOVERABLE_MUTATION_ERROR_PATTERNS = [
	/Failed to fetch proved forest/i,
	/No key returned from mutation/i
]

const TRANSIENT_CLAIM_UNAVAILABLE_ERROR_PATTERNS = [
	/Did not find any (deposit|withdrawal) to finalize/i,
	/No (deposit|withdrawal) witnesses found/i,
	/No earliest before state found/i,
	/No my (deposit|withdrawal) index found/i,
	/No next commit index found/i,
	/No synced outer action state index found/i
]

const isRecoverableMutationError = (error: unknown): boolean => {
	const message = formatErrorMessage(error)
	return RECOVERABLE_MUTATION_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

const isTransientClaimUnavailableError = (error: unknown): boolean => {
	const message = formatErrorMessage(error)
	return TRANSIENT_CLAIM_UNAVAILABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

const isRetryableCapabilityError = (error: unknown): boolean =>
	!isInsufficientFirstWithdrawalAmountError(error)

const maybeEmitHeartbeat = async ({
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
	tracker: WaitStateTracker
	log: LogFn
	details: Record<string, unknown>
}) => {
	if (pollIntervalMs === 0) {
		if (!tracker.emittedImmediateHeartbeat) {
			tracker.emittedImmediateHeartbeat = true
			await log({
				event: "heartbeat",
				phase: session.phase,
				details: { elapsedSeconds: getElapsedSeconds(session, now), ...details }
			})
		}
		return
	}

	const elapsedSeconds = getElapsedSeconds(session, now)
	const bucket = getHeartbeatBucket({ elapsedSeconds, pollIntervalMs })
	if (bucket <= 0 || bucket === tracker.lastHeartbeatBucket) {
		return
	}

	tracker.lastHeartbeatBucket = bucket
	await log({
		event: "heartbeat",
		phase: session.phase,
		details: { elapsedSeconds, ...details }
	})
}

const maybeEnterWaitState = async ({
	session,
	controller,
	sessionStore,
	log,
	now,
	tracker,
	signature,
	event,
	phaseEvent,
	patch,
	details
}: {
	session: OperationSession
	controller: ReturnType<typeof createOperationStateController>
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
	tracker: WaitStateTracker
	signature: string
	event: string
	phaseEvent: TransitionEvent
	patch?: Partial<OperationSession>
	details?: Record<string, unknown>
}): Promise<OperationSession> => {
	const nextSession =
		tracker.lastWaitSignature === signature
			? {
					...session,
					...patch,
					updatedAt: now()
				}
			: transitionSession({
					controller,
					session,
					event: phaseEvent,
					now,
					patch
				})

	if (tracker.lastWaitSignature !== signature) {
		tracker.lastWaitSignature = signature
		tracker.emittedImmediateHeartbeat = false
		await persistSession({
			session: nextSession,
			sessionStore,
			log,
			event,
			details
		})
	}

	return nextSession
}

const withRetry = async <T>({
	session,
	controller,
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
	controller: ReturnType<typeof createOperationStateController>
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
	let attempt = 1

	for (;;) {
		const startedAtMs = Date.now()
		const startedAt = new Date(startedAtMs).toISOString()
		try {
			const value = await run()
			const endedAtMs = Date.now()
			const endedAt = new Date(endedAtMs).toISOString()
			currentSession = withRecordedSdkCall({
				session: currentSession,
				trace: {
					operation,
					attempt,
					startedAt,
					endedAt,
					durationMs: Math.max(0, endedAtMs - startedAtMs),
					success: true,
					result: summarizeSdkResult(value)
				}
			})
			return { session: currentSession, value }
		} catch (error) {
			const endedAtMs = Date.now()
			const endedAt = new Date(endedAtMs).toISOString()
			currentSession = withRecordedSdkCall({
				session: currentSession,
				trace: {
					operation,
					attempt,
					startedAt,
					endedAt,
					durationMs: Math.max(0, endedAtMs - startedAtMs),
					success: false,
					message: formatErrorMessage(error)
				}
			})
			if (shouldRetry && !shouldRetry(error)) {
				throw error
			}

			currentSession = transitionSession({
				controller,
				session: currentSession,
				event: "MARK_RETRYING",
				now,
				patch: {
					lastError: formatErrorMessage(error)
				}
			})
			await persistSession({
				session: currentSession,
				sessionStore,
				log,
				event: "retrying",
				details: {
					operation,
					message: formatErrorMessage(error)
				}
			})
			await sleep(retryDelayMs ?? RETRY_SLEEP_MS)
			attempt += 1
		}
	}
}

const completeSession = async ({
	session,
	controller,
	sessionStore,
	log,
	now,
	finalTransaction
}: {
	session: OperationSession
	controller: ReturnType<typeof createOperationStateController>
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
	finalTransaction?: OperationSession["finalTransaction"]
}) => {
	const completed = transitionSession({
		controller,
		session,
		event: "MARK_COMPLETED",
		now,
		patch: finalTransaction ? { finalTransaction } : {}
	})
	await persistSession({
		session: completed,
		sessionStore,
		log,
		event: "completed",
		details: { hash: completed.finalTransaction?.hash }
	})
	return completed
}

const cancelSession = async ({
	session,
	controller,
	sessionStore,
	log,
	now
}: {
	session: OperationSession
	controller: ReturnType<typeof createOperationStateController>
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
}) => {
	const cancelled = transitionSession({
		controller,
		session,
		event: "MARK_CANCELLED",
		now
	})
	await persistSession({
		session: cancelled,
		sessionStore,
		log,
		event: "cancelled"
	})
	return cancelled
}

const failSession = async ({
	session,
	controller,
	sessionStore,
	log,
	now,
	error
}: {
	session: OperationSession
	controller: ReturnType<typeof createOperationStateController>
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	now: () => string
	error: string
}) => {
	const failed = transitionSession({
		controller,
		session,
		event: "MARK_FAILED",
		now,
		patch: {
			lastError: error
		}
	})
	await persistSession({
		session: failed,
		sessionStore,
		log,
		event: "failed",
		details: { message: error }
	})
	return failed
}

type BridgeRunnerContext = {
	session: OperationSession
	input: BridgeFlowInput
	deps: BridgeFlowDeps
	controller: ReturnType<typeof createOperationStateController>
	waitTracker: WaitStateTracker
	now: () => string
	depositAnalysis?: DepositQueueState
	withdrawalAnalysis?: WithdrawalQueueState
}

type RunnerStep =
	| "inspect-deposit"
	| "inspect-withdrawal"
	| "wait-deposit"
	| "wait-withdrawal"
	| "finalize-deposit"
	| "cancel-deposit"
	| "finalize-withdrawal"
	| "completed"
	| "cancelled"
	| "failed"

type RunnerOutput = Pick<
	BridgeRunnerContext,
	"session" | "depositAnalysis" | "withdrawalAnalysis"
> & {
	next: RunnerStep
}

const createInitialRunnerContext = (
	input: BridgeFlowInput,
	deps: BridgeFlowDeps
): BridgeRunnerContext => {
	const route = resolveRoute(input.from, input.to)
	const now = deps.now ?? (() => new Date().toISOString())
	const createdAt = now()
	const baseSession =
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
			submittedTransactions: [],
			verboseDiagnostics: deps.verbose
				? createVerboseDiagnostics(createdAt, "initializing")
				: undefined
		} satisfies OperationSession)
	const session =
		deps.verbose && !baseSession.verboseDiagnostics
			? {
					...baseSession,
					verboseDiagnostics: createVerboseDiagnostics(baseSession.createdAt, baseSession.phase)
				}
			: baseSession

	return {
		session,
		input,
		deps,
		now,
		controller: createOperationStateController({
			phase: session.phase,
			status: session.status
		}),
		waitTracker: {
			emittedImmediateHeartbeat: false
		}
	}
}

const runSubmitStep = async (
	context: BridgeRunnerContext,
	direction: "deposit" | "withdrawal"
): Promise<RunnerOutput> => {
	const { deps, controller, now } = context
	let { session } = context

	try {
		const submitResult =
			direction === "deposit"
				? await withRetry({
						session,
						controller,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "submitDeposit",
						shouldRetry: isRecoverableMutationError,
						run: async () =>
							requireAdapterMethod(
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
				: await withRetry({
						session,
						controller,
						sessionStore: deps.sessionStore,
						log: deps.log,
						sleep: deps.sleep,
						retryDelayMs: deps.retryDelayMs,
						now,
						operation: "submitWithdrawal",
						shouldRetry: isRecoverableMutationError,
						run: async () =>
							requireAdapterMethod(
								deps.adapter,
								"submitWithdrawal"
							)({
								account: session.account,
								recipient: session.recipient,
								amount: session.amount,
								wait: false
							})
					})

		session = submitResult.session
		session = transitionSession({
			controller,
			session,
			event: "MARK_SUBMITTED",
			now,
			patch: appendSubmittedTransaction(session, {
				action: "submit",
				hash: submitResult.value.hash
			})
		})
		await persistSession({
			session,
			sessionStore: deps.sessionStore,
			log: deps.log,
			event: "submitted",
			details: { hash: submitResult.value.hash }
		})

		return {
			session,
			next: direction === "deposit" ? "inspect-deposit" : "inspect-withdrawal"
		}
	} catch (error) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: formatErrorMessage(error)
			}),
			next: "failed"
		}
	}
}

const runInspectDepositStep = async (context: BridgeRunnerContext): Promise<RunnerOutput> => {
	const { deps, controller, waitTracker, now } = context
	let { session } = context

	try {
		const depositStatusesResult = await withRetry({
			session,
			controller,
			sessionStore: deps.sessionStore,
			log: deps.log,
			sleep: deps.sleep,
			retryDelayMs: deps.retryDelayMs,
			now,
			operation: "getDepositStatuses",
			run: async () => requireAdapterMethod(deps.adapter, "getDepositStatuses")(session.account)
		})
		session = depositStatusesResult.session
		const analysis = analyzeDepositQueue({
			session,
			statuses: sortByIndex(depositStatusesResult.value)
		})
		const {
			target,
			targetIndex,
			claimableIndex,
			pendingAhead,
			blockingAhead,
			skippableAhead,
			shouldAdvanceQueuedClaims
		} = analysis

		if (targetIndex !== undefined && session.targetIndex !== targetIndex) {
			session = {
				...session,
				targetIndex,
				updatedAt: now()
			}
			await deps.sessionStore.save(session)
		}

		if (target?.cancelled) {
			return {
				session: await cancelSession({
					session,
					controller,
					sessionStore: deps.sessionStore,
					log: deps.log,
					now
				}),
				depositAnalysis: analysis,
				next: "cancelled"
			}
		}

		if (target?.finalised) {
			return {
				session: await completeSession({
					session,
					controller,
					sessionStore: deps.sessionStore,
					log: deps.log,
					now,
					finalTransaction: session.finalTransaction ?? {
						action: "finalize",
						hash: target.hash,
						explorerUrl: ""
					}
				}),
				depositAnalysis: analysis,
				next: "completed"
			}
		}

		if (shouldAdvanceQueuedClaims) {
			session = await maybeEnterWaitState({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				tracker: waitTracker,
				signature: `prior:${targetIndex ?? "unknown"}:${claimableIndex ?? "none"}:${pendingAhead}:${blockingAhead}:${skippableAhead}`,
				event: "waiting-on-prior-claims",
				phaseEvent: "MARK_WAITING_PRIOR_CLAIMS",
				patch: {
					targetIndex,
					queueAdvances: session.queueAdvances ?? 0
				},
				details: {
					targetIndex,
					pendingAhead,
					blockingAhead,
					skippableAhead,
					claimIndex: claimableIndex
				}
			})
		} else if (!target) {
			session = await maybeEnterWaitState({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				tracker: waitTracker,
				signature: "submission:pending",
				event: "waiting-for-submission",
				phaseEvent: "MARK_WAITING_SUBMISSION",
				details: { submitHash: getSubmitHash(session) }
			})
		} else {
			session = await maybeEnterWaitState({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				tracker: waitTracker,
				signature: `finalization:${target.index}:${claimableIndex ?? "none"}`,
				event: "waiting-for-finalization",
				phaseEvent: "MARK_WAITING_FINALIZATION",
				patch: {
					targetIndex: target.index
				},
				details: {
					targetIndex: target.index,
					claimIndex: claimableIndex
				}
			})
		}

		const [canFinalizeDepositResult, canCancelResult] = await Promise.all([
			withRetry({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				sleep: deps.sleep,
				retryDelayMs: deps.retryDelayMs,
				now,
				operation: "canFinalizeDeposit",
				run: async () =>
					getCapabilityDiagnostic({
						adapter: deps.adapter,
						account: session.account,
						method: "canFinalizeDeposit"
					})
			}),
			withRetry({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				sleep: deps.sleep,
				retryDelayMs: deps.retryDelayMs,
				now,
				operation: "canCancelDeposit",
				run: async () =>
					getCapabilityDiagnostic({
						adapter: deps.adapter,
						account: session.account,
						method: "canCancelDeposit"
					})
			})
		])
		session = mergeVerboseDiagnosticsFromSessions({
			session,
			sources: [canFinalizeDepositResult.session, canCancelResult.session]
		})
		session = withCapabilityWaitReason({
			session,
			key: "canFinalizeDeposit",
			diagnostic: canFinalizeDepositResult.value
		})
		session = withCapabilityWaitReason({
			session,
			key: "canCancelDeposit",
			diagnostic: canCancelResult.value
		})
		const pendingFinalizeState = getPendingFinalizeRetryState({
			session,
			claimableIndex,
			now
		})
		const currentTargetCancelMarker = toPendingCancelMarker({
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

		const shouldCancelCurrentTarget =
			target !== undefined &&
			pendingAhead === 0 &&
			!canFinalizeDepositResult.value.available &&
			canCancelResult.value.available &&
			session.pendingCancelMarker !== currentTargetCancelMarker

		const shouldAdvanceClaim =
			canFinalizeDepositResult.value.available &&
			claimableIndex !== undefined &&
			(!pendingFinalizeState.isPending || pendingFinalizeState.isStale) &&
			skippableAhead === 0 &&
			(target === undefined || blockingAhead > 0 || claimableIndex === target.index) &&
			!shouldCancelCurrentTarget

		if (shouldAdvanceClaim) {
			return {
				session,
				depositAnalysis: analysis,
				next: "finalize-deposit"
			}
		}

		const shouldAdvancePriorCancellation =
			canCancelResult.value.available &&
			skippableAhead > 0 &&
			session.pendingCancelMarker !== priorCancelMarker

		if (shouldAdvancePriorCancellation || shouldCancelCurrentTarget) {
			return {
				session,
				depositAnalysis: analysis,
				next: "cancel-deposit"
			}
		}

		await maybeEmitHeartbeat({
			session,
			now,
			pollIntervalMs: deps.pollIntervalMs,
			tracker: waitTracker,
			log: deps.log,
			details: shouldAdvanceQueuedClaims
				? {
						waiting: "prior-claims",
						pendingAhead,
						blockingAhead,
						skippableAhead,
						targetIndex,
						claimIndex: claimableIndex,
						finalizeAvailable: canFinalizeDepositResult.value.available,
						finalizeReason: canFinalizeDepositResult.value.reason,
						cancelAvailable: canCancelResult.value.available,
						cancelReason: canCancelResult.value.reason
					}
				: target
					? {
							waiting: "finalization",
							targetIndex: target.index,
							claimIndex: claimableIndex,
							finalizeAvailable: canFinalizeDepositResult.value.available,
							finalizeReason: canFinalizeDepositResult.value.reason,
							cancelAvailable: canCancelResult.value.available,
							cancelReason: canCancelResult.value.reason
						}
					: {
							waiting: "submission",
							submitHash: getSubmitHash(session),
							finalizeAvailable: canFinalizeDepositResult.value.available,
							finalizeReason: canFinalizeDepositResult.value.reason,
							cancelAvailable: canCancelResult.value.available,
							cancelReason: canCancelResult.value.reason
						}
		})

		return {
			session,
			depositAnalysis: analysis,
			next: "wait-deposit"
		}
	} catch (error) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: formatErrorMessage(error)
			}),
			next: "failed"
		}
	}
}

const runInspectWithdrawalStep = async (context: BridgeRunnerContext): Promise<RunnerOutput> => {
	const { deps, controller, waitTracker, now } = context
	let { session } = context

	try {
		const withdrawalStatusesResult = await withRetry({
			session,
			controller,
			sessionStore: deps.sessionStore,
			log: deps.log,
			sleep: deps.sleep,
			retryDelayMs: deps.retryDelayMs,
			now,
			operation: "getWithdrawalStatuses",
			run: async () => requireAdapterMethod(deps.adapter, "getWithdrawalStatuses")(session.account)
		})
		session = withdrawalStatusesResult.session
		const analysis = analyzeWithdrawalQueue({
			session,
			statuses: sortByIndex(withdrawalStatusesResult.value)
		})
		const { target, targetIndex, claimableIndex, pendingAhead, shouldAdvanceQueuedClaims } =
			analysis

		if (targetIndex !== undefined && session.targetIndex !== targetIndex) {
			session = {
				...session,
				targetIndex,
				updatedAt: now()
			}
			await deps.sessionStore.save(session)
		}

		if (target?.finalised) {
			return {
				session: await completeSession({
					session,
					controller,
					sessionStore: deps.sessionStore,
					log: deps.log,
					now,
					finalTransaction: session.finalTransaction ?? {
						action: "finalize",
						hash: target.hash,
						explorerUrl: ""
					}
				}),
				withdrawalAnalysis: analysis,
				next: "completed"
			}
		}

		if (shouldAdvanceQueuedClaims) {
			session = await maybeEnterWaitState({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				tracker: waitTracker,
				signature: `prior:${targetIndex ?? "unknown"}:${claimableIndex ?? "none"}:${pendingAhead}`,
				event: "waiting-on-prior-claims",
				phaseEvent: "MARK_WAITING_PRIOR_CLAIMS",
				patch: {
					targetIndex,
					queueAdvances: session.queueAdvances ?? 0
				},
				details: {
					targetIndex,
					pendingAhead,
					claimIndex: claimableIndex
				}
			})
		} else if (!target) {
			session = await maybeEnterWaitState({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				tracker: waitTracker,
				signature: "submission:pending",
				event: "waiting-for-submission",
				phaseEvent: "MARK_WAITING_SUBMISSION",
				details: { submitHash: getSubmitHash(session) }
			})
		} else {
			session = await maybeEnterWaitState({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				tracker: waitTracker,
				signature: `finalization:${target.index}:${claimableIndex ?? "none"}`,
				event: "waiting-for-finalization",
				phaseEvent: "MARK_WAITING_FINALIZATION",
				patch: {
					targetIndex: target.index
				},
				details: {
					targetIndex: target.index,
					claimIndex: claimableIndex
				}
			})
		}

		const canFinalizeResult = await withRetry({
			session,
			controller,
			sessionStore: deps.sessionStore,
			log: deps.log,
			sleep: deps.sleep,
			retryDelayMs: deps.retryDelayMs,
			now,
			operation: "canFinalizeWithdrawal",
			shouldRetry: isRetryableCapabilityError,
			run: async () =>
				getCapabilityDiagnostic({
					adapter: deps.adapter,
					account: session.account,
					method: "canFinalizeWithdrawal"
				})
		})
		session = canFinalizeResult.session
		session = withCapabilityWaitReason({
			session,
			key: "canFinalizeWithdrawal",
			diagnostic: canFinalizeResult.value
		})
		const pendingFinalizeState = getPendingFinalizeRetryState({
			session,
			claimableIndex,
			now
		})

		const shouldAdvanceClaim =
			canFinalizeResult.value.available &&
			claimableIndex !== undefined &&
			(!pendingFinalizeState.isPending || pendingFinalizeState.isStale) &&
			(shouldAdvanceQueuedClaims || claimableIndex === target?.index)

		if (shouldAdvanceClaim) {
			return {
				session,
				withdrawalAnalysis: analysis,
				next: "finalize-withdrawal"
			}
		}

		await maybeEmitHeartbeat({
			session,
			now,
			pollIntervalMs: deps.pollIntervalMs,
			tracker: waitTracker,
			log: deps.log,
			details: shouldAdvanceQueuedClaims
				? {
						waiting: "prior-claims",
						pendingAhead,
						targetIndex,
						claimIndex: claimableIndex,
						finalizeAvailable: canFinalizeResult.value.available,
						finalizeReason: canFinalizeResult.value.reason
					}
				: target
					? {
							waiting: "finalization",
							targetIndex: target.index,
							claimIndex: claimableIndex,
							finalizeAvailable: canFinalizeResult.value.available,
							finalizeReason: canFinalizeResult.value.reason
						}
					: {
							waiting: "submission",
							submitHash: getSubmitHash(session),
							finalizeAvailable: canFinalizeResult.value.available,
							finalizeReason: canFinalizeResult.value.reason
						}
		})

		return {
			session,
			withdrawalAnalysis: analysis,
			next: "wait-withdrawal"
		}
	} catch (error) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: formatErrorMessage(error)
			}),
			next: "failed"
		}
	}
}

const runFinalizeDepositStep = async (context: BridgeRunnerContext): Promise<RunnerOutput> => {
	const { deps, controller, waitTracker, now, depositAnalysis } = context
	let { session } = context

	if (!depositAnalysis) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: "Missing deposit queue analysis before finalize."
			}),
			next: "failed"
		}
	}

	try {
		const finalizeDepositResult = await withRetry({
			session,
			controller,
			sessionStore: deps.sessionStore,
			log: deps.log,
			sleep: deps.sleep,
			retryDelayMs: deps.retryDelayMs,
			now,
			operation: "finalizeDeposit",
			shouldRetry: isRecoverableMutationError,
			run: async () =>
				requireAdapterMethod(
					deps.adapter,
					"finalizeDeposit"
				)({
					account: session.account,
					wait: false
				})
		})
		session = finalizeDepositResult.session
		const finalizeResult = finalizeDepositResult.value
		session = transitionSession({
			controller,
			session,
			event: "MARK_FINALIZING",
			now,
			patch: {
				...appendSubmittedTransaction(session, {
					action: "finalize",
					hash: finalizeResult.hash
				}),
				finalTransaction:
					depositAnalysis.target && depositAnalysis.claimableIndex === depositAnalysis.target.index
						? {
								action: "finalize",
								hash: finalizeResult.hash,
								explorerUrl: finalizeResult.explorerUrl
							}
						: session.finalTransaction,
				pendingFinalizeIndex: depositAnalysis.claimableIndex,
				pendingFinalizeSubmittedAt: now(),
				queueAdvances: depositAnalysis.shouldAdvanceQueuedClaims
					? (session.queueAdvances ?? 0) + 1
					: session.queueAdvances
			}
		})
		waitTracker.lastWaitSignature = undefined
		waitTracker.emittedImmediateHeartbeat = false
		await persistSession({
			session,
			sessionStore: deps.sessionStore,
			log: deps.log,
			event: "finalized",
			details: {
				hash: finalizeResult.hash,
				claimIndex: depositAnalysis.claimableIndex,
				advancedPriorClaim: depositAnalysis.shouldAdvanceQueuedClaims
			}
		})

		return {
			session,
			next: "wait-deposit"
		}
	} catch (error) {
		if (!isTransientClaimUnavailableError(error)) {
			return {
				session: await failSession({
					session,
					controller,
					sessionStore: deps.sessionStore,
					log: deps.log,
					now,
					error: formatErrorMessage(error)
				}),
				next: "failed"
			}
		}

		await deps.log({
			event: "claim-pending",
			phase: session.phase,
			details: {
				claimIndex: depositAnalysis.claimableIndex,
				message: formatErrorMessage(error)
			}
		})

		return {
			session,
			next: "wait-deposit"
		}
	}
}

const runCancelDepositStep = async (context: BridgeRunnerContext): Promise<RunnerOutput> => {
	const { deps, controller, waitTracker, now, depositAnalysis } = context
	let { session } = context

	if (!depositAnalysis) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: "Missing deposit queue analysis before cancel."
			}),
			next: "failed"
		}
	}

	try {
		const cancelDepositResult = await withRetry({
			session,
			controller,
			sessionStore: deps.sessionStore,
			log: deps.log,
			sleep: deps.sleep,
			retryDelayMs: deps.retryDelayMs,
			now,
			operation: "cancelDeposit",
			shouldRetry: isRecoverableMutationError,
			run: async () =>
				requireAdapterMethod(
					deps.adapter,
					"cancelDeposit"
				)({
					account: session.account,
					wait: false
				})
		})
		session = cancelDepositResult.session
		const cancelResult = cancelDepositResult.value
		const cancellingCurrentTarget =
			depositAnalysis.target !== undefined &&
			depositAnalysis.pendingAhead === 0 &&
			(depositAnalysis.claimableIndex === undefined ||
				depositAnalysis.claimableIndex === depositAnalysis.target.index)
		const pendingCancelMarker = toPendingCancelMarker({
			currentTargetIndex: depositAnalysis.target?.index,
			claimableIndex: depositAnalysis.claimableIndex,
			pendingAhead: depositAnalysis.pendingAhead,
			isCurrentTarget: cancellingCurrentTarget
		})
		session = transitionSession({
			controller,
			session,
			event: "MARK_CANCELLING",
			now,
			patch: {
				...appendSubmittedTransaction(session, {
					action: "cancel",
					hash: cancelResult.hash
				}),
				finalTransaction: cancellingCurrentTarget
					? {
							action: "cancel",
							hash: cancelResult.hash,
							explorerUrl: cancelResult.explorerUrl
						}
					: session.finalTransaction,
				pendingCancelMarker,
				queueAdvances: depositAnalysis.shouldAdvanceQueuedClaims
					? (session.queueAdvances ?? 0) + 1
					: session.queueAdvances
			}
		})
		waitTracker.lastWaitSignature = undefined
		waitTracker.emittedImmediateHeartbeat = false
		await persistSession({
			session,
			sessionStore: deps.sessionStore,
			log: deps.log,
			event: "cancel-submitted",
			details: {
				hash: cancelResult.hash,
				advancedPriorClaim: depositAnalysis.shouldAdvanceQueuedClaims,
				pendingAhead: depositAnalysis.pendingAhead,
				claimIndex: depositAnalysis.claimableIndex
			}
		})

		return {
			session,
			next: "wait-deposit"
		}
	} catch (error) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: formatErrorMessage(error)
			}),
			next: "failed"
		}
	}
}

const runFinalizeWithdrawalStep = async (context: BridgeRunnerContext): Promise<RunnerOutput> => {
	const { deps, controller, waitTracker, now, withdrawalAnalysis } = context
	let { session } = context

	if (!withdrawalAnalysis) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: "Missing withdrawal queue analysis before finalize."
			}),
			next: "failed"
		}
	}

	try {
		const finalizeWithdrawalResult = await withRetry({
			session,
			controller,
			sessionStore: deps.sessionStore,
			log: deps.log,
			sleep: deps.sleep,
			retryDelayMs: deps.retryDelayMs,
			now,
			operation: "finalizeWithdrawal",
			shouldRetry: isRecoverableMutationError,
			run: async () =>
				requireAdapterMethod(
					deps.adapter,
					"finalizeWithdrawal"
				)({
					account: session.account,
					wait: false
				})
		})
		session = finalizeWithdrawalResult.session
		const finalizeResult = finalizeWithdrawalResult.value
		session = transitionSession({
			controller,
			session,
			event: "MARK_FINALIZING",
			now,
			patch: {
				...appendSubmittedTransaction(session, {
					action: "finalize",
					hash: finalizeResult.hash
				}),
				finalTransaction:
					withdrawalAnalysis.target &&
					withdrawalAnalysis.claimableIndex === withdrawalAnalysis.target.index
						? {
								action: "finalize",
								hash: finalizeResult.hash,
								explorerUrl: finalizeResult.explorerUrl
							}
						: session.finalTransaction,
				pendingFinalizeIndex: withdrawalAnalysis.claimableIndex,
				pendingFinalizeSubmittedAt: now(),
				queueAdvances: withdrawalAnalysis.shouldAdvanceQueuedClaims
					? (session.queueAdvances ?? 0) + 1
					: session.queueAdvances
			}
		})
		waitTracker.lastWaitSignature = undefined
		waitTracker.emittedImmediateHeartbeat = false
		await persistSession({
			session,
			sessionStore: deps.sessionStore,
			log: deps.log,
			event: "finalized",
			details: {
				hash: finalizeResult.hash,
				claimIndex: withdrawalAnalysis.claimableIndex,
				advancedPriorClaim: withdrawalAnalysis.shouldAdvanceQueuedClaims
			}
		})

		return {
			session,
			next: "wait-withdrawal"
		}
	} catch (error) {
		if (!isTransientClaimUnavailableError(error)) {
			return {
				session: await failSession({
					session,
					controller,
					sessionStore: deps.sessionStore,
					log: deps.log,
					now,
					error: formatErrorMessage(error)
				}),
				next: "failed"
			}
		}

		await deps.log({
			event: "claim-pending",
			phase: session.phase,
			details: {
				claimIndex: withdrawalAnalysis.claimableIndex,
				message: formatErrorMessage(error)
			}
		})

		return {
			session,
			next: "wait-withdrawal"
		}
	}
}

const runWaitStep = async (
	context: BridgeRunnerContext,
	direction: "deposit" | "withdrawal"
): Promise<RunnerOutput> => {
	const { deps, controller, now } = context
	const { session } = context

	try {
		await deps.sleep(deps.pollIntervalMs)
		return {
			session,
			depositAnalysis: context.depositAnalysis,
			withdrawalAnalysis: context.withdrawalAnalysis,
			next: direction === "deposit" ? "inspect-deposit" : "inspect-withdrawal"
		}
	} catch (error) {
		return {
			session: await failSession({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				error: formatErrorMessage(error)
			}),
			depositAnalysis: context.depositAnalysis,
			withdrawalAnalysis: context.withdrawalAnalysis,
			next: "failed"
		}
	}
}

const bridgeOperationMachine = setup({
	types: {
		context: {} as BridgeRunnerContext,
		input: {} as BridgeRunnerContext,
		output: {} as OperationSession
	},
	actors: {
		submitDepositStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runSubmitStep(input, "deposit")
		),
		submitWithdrawalStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runSubmitStep(input, "withdrawal")
		),
		inspectDepositStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runInspectDepositStep(input)
		),
		inspectWithdrawalStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runInspectWithdrawalStep(input)
		),
		finalizeDepositStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runFinalizeDepositStep(input)
		),
		cancelDepositStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runCancelDepositStep(input)
		),
		finalizeWithdrawalStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runFinalizeWithdrawalStep(input)
		),
		waitDepositStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runWaitStep(input, "deposit")
		),
		waitWithdrawalStep: fromPromise<RunnerOutput, BridgeRunnerContext>(({ input }) =>
			runWaitStep(input, "withdrawal")
		)
	}
}).createMachine({
	id: "bridge-cli-runner",
	context: ({ input }) => input,
	output: ({ context }) => context.session,
	initial: "route",
	states: {
		route: {
			always: [
				{
					target: "submitDeposit",
					guard: ({ context }) =>
						context.session.direction === "deposit" &&
						context.session.submittedTransactions.length === 0
				},
				{
					target: "submitWithdrawal",
					guard: ({ context }) =>
						context.session.direction === "withdrawal" &&
						context.session.submittedTransactions.length === 0
				},
				{
					target: "inspectDeposit",
					guard: ({ context }) => context.session.direction === "deposit"
				},
				{
					target: "inspectWithdrawal"
				}
			]
		},
		submitDeposit: {
			invoke: {
				src: "submitDepositStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					},
					{
						target: "inspectDeposit",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					}
				]
			}
		},
		submitWithdrawal: {
			invoke: {
				src: "submitWithdrawalStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					},
					{
						target: "inspectWithdrawal",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					}
				]
			}
		},
		inspectDeposit: {
			invoke: {
				src: "inspectDepositStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "completed",
						guard: ({ event }) => event.output.next === "completed",
						actions: assign({
							session: ({ event }) => event.output.session,
							depositAnalysis: ({ event }) => event.output.depositAnalysis
						})
					},
					{
						target: "cancelled",
						guard: ({ event }) => event.output.next === "cancelled",
						actions: assign({
							session: ({ event }) => event.output.session,
							depositAnalysis: ({ event }) => event.output.depositAnalysis
						})
					},
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session,
							depositAnalysis: ({ event }) => event.output.depositAnalysis
						})
					},
					{
						target: "finalizeDeposit",
						guard: ({ event }) => event.output.next === "finalize-deposit",
						actions: assign({
							session: ({ event }) => event.output.session,
							depositAnalysis: ({ event }) => event.output.depositAnalysis
						})
					},
					{
						target: "cancelDeposit",
						guard: ({ event }) => event.output.next === "cancel-deposit",
						actions: assign({
							session: ({ event }) => event.output.session,
							depositAnalysis: ({ event }) => event.output.depositAnalysis
						})
					},
					{
						target: "waitDeposit",
						actions: assign({
							session: ({ event }) => event.output.session,
							depositAnalysis: ({ event }) => event.output.depositAnalysis
						})
					}
				]
			}
		},
		waitDeposit: {
			invoke: {
				src: "waitDepositStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					},
					{
						target: "inspectDeposit",
						actions: assign({
							session: ({ event }) => event.output.session,
							depositAnalysis: ({ event }) => event.output.depositAnalysis
						})
					}
				]
			}
		},
		finalizeDeposit: {
			invoke: {
				src: "finalizeDepositStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					},
					{
						target: "inspectDeposit",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					}
				]
			}
		},
		cancelDeposit: {
			invoke: {
				src: "cancelDepositStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					},
					{
						target: "inspectDeposit",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					}
				]
			}
		},
		inspectWithdrawal: {
			invoke: {
				src: "inspectWithdrawalStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "completed",
						guard: ({ event }) => event.output.next === "completed",
						actions: assign({
							session: ({ event }) => event.output.session,
							withdrawalAnalysis: ({ event }) => event.output.withdrawalAnalysis
						})
					},
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session,
							withdrawalAnalysis: ({ event }) => event.output.withdrawalAnalysis
						})
					},
					{
						target: "finalizeWithdrawal",
						guard: ({ event }) => event.output.next === "finalize-withdrawal",
						actions: assign({
							session: ({ event }) => event.output.session,
							withdrawalAnalysis: ({ event }) => event.output.withdrawalAnalysis
						})
					},
					{
						target: "waitWithdrawal",
						actions: assign({
							session: ({ event }) => event.output.session,
							withdrawalAnalysis: ({ event }) => event.output.withdrawalAnalysis
						})
					}
				]
			}
		},
		waitWithdrawal: {
			invoke: {
				src: "waitWithdrawalStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					},
					{
						target: "inspectWithdrawal",
						actions: assign({
							session: ({ event }) => event.output.session,
							withdrawalAnalysis: ({ event }) => event.output.withdrawalAnalysis
						})
					}
				]
			}
		},
		finalizeWithdrawal: {
			invoke: {
				src: "finalizeWithdrawalStep",
				input: ({ context }) => context,
				onDone: [
					{
						target: "failed",
						guard: ({ event }) => event.output.next === "failed",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					},
					{
						target: "inspectWithdrawal",
						actions: assign({
							session: ({ event }) => event.output.session
						})
					}
				]
			}
		},
		completed: { type: "final" },
		cancelled: { type: "final" },
		failed: { type: "final" }
	}
})

export const runBridgeOperation = async (
	input: BridgeFlowInput,
	deps: BridgeFlowDeps
): Promise<OperationSession> => {
	const context = createInitialRunnerContext(input, deps)

	await persistSession({
		session: context.session,
		sessionStore: deps.sessionStore,
		log: deps.log,
		event: "initialized"
	})

	const actor = createActor(bridgeOperationMachine, {
		input: context
	})
	actor.start()

	try {
		return await toPromise(actor)
	} finally {
		actor.stop()
	}
}

export const createBridgeCommand = (deps: BridgeCommandDeps = {}): CommandDef<BridgeCommandArgs> =>
	defineCommand({
		meta: {
			name: "bridge",
			description: "Run a full bridge flow from source to destination."
		},
		args: {
			from: { type: "string", default: "mina:testnet" },
			to: { type: "string", default: "zeko:testnet" },
			amount: { type: "string", required: true },
			account: { type: "string", required: false },
			recipient: { type: "string", required: false },
			timeoutSlots: { type: "string", required: false },
			json: { type: "boolean", default: false },
			verbose: { type: "boolean", default: false }
		},
		async run({ args }) {
			const commandArgs = parseBridgeCommandArgs({
				from: typeof args.from === "string" ? args.from : undefined,
				to: typeof args.to === "string" ? args.to : undefined,
				amount: typeof args.amount === "string" ? args.amount : "",
				account: typeof args.account === "string" ? args.account : undefined,
				recipient: typeof args.recipient === "string" ? args.recipient : undefined,
				timeoutSlots: typeof args.timeoutSlots === "string" ? args.timeoutSlots : undefined,
				json: args.json === true,
				verbose: args.verbose === true
			} satisfies BridgeCommandRunArgs)
			const from = commandArgs.from
			const to = commandArgs.to
			const account = deriveAccount(from, commandArgs.account)
			const recipient = commandArgs.recipient ?? deriveAccount(to)
			const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
			const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
			const id = (deps.generateId ?? randomUUID)()
			const logPath = path.join(appPaths.logDir, `${id}.jsonl`)
			const logger = (deps.createLogger ?? createOperationLogger)({ logPath })
			const createAdapter =
				deps.createAdapter ??
				(async ({
					from: inputFrom,
					to: inputTo,
					verbose
				}: {
					from: ChainRef
					to: ChainRef
					verbose: boolean
				}) => {
					const { createBridgeAdapter } = await import("../core/adapter")
					return createBridgeAdapter({
						route: resolveRoute(inputFrom, inputTo),
						verbose
					})
				})
			const session = await runBridgeOperation(
				{
					id,
					from,
					to,
					amount: commandArgs.amount,
					account,
					recipient,
					timeoutSlots:
						resolveRoute(from, to).direction === "deposit"
							? resolveDepositTimeoutSlots(commandArgs.timeoutSlots)
							: commandArgs.timeoutSlots
				},
				{
					adapter: await createAdapter({ from, to, verbose: commandArgs.verbose }),
					sessionStore: {
						async save(operation) {
							await store.save({ ...operation, logPath })
						}
					},
					log: async ({ event, phase, details }) => {
						;(deps.writeProgress ?? console.error)(
							renderOperationProgress({ event, phase, details })
						)
						await logger.write(event, { phase, ...details })
					},
					sleep: deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
					pollIntervalMs: deps.pollIntervalMs ?? 20_000,
					retryDelayMs: deps.retryDelayMs,
					now: deps.now,
					verbose: commandArgs.verbose
				}
			)

			const finalSession = { ...session, logPath }
			;(deps.write ?? console.log)(
				commandArgs.json
					? JSON.stringify(toBridgeJsonResult(finalSession), null, 2)
					: renderBridgeResult(finalSession)
			)
		}
	})
