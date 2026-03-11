import { randomUUID } from "node:crypto"
import path from "node:path"
import { defineCommand, type CommandDef } from "citty"
import { PrivateKey } from "o1js"
import type { BridgeAdapter } from "../core/adapter"
import { createOperationLogger } from "../core/logger"
import { createOperationStateController } from "../core/operation-machine"
import { resolveAppPaths } from "../core/paths"
import { renderBridgeResult, renderOperationProgress, toBridgeJsonResult } from "../core/reporter"
import { formatRoute, parseChainRef, type ChainRef, resolveRoute } from "../core/routes"
import { resolveSignerKeys } from "../core/signer"
import { createSessionStore, type SessionStore } from "../core/session-store"
import type {
	DepositStatus,
	OperationPhase,
	OperationSession,
	WithdrawalStatus
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
	createAdapter?: (input: { from: ChainRef; to: ChainRef }) =>
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
}

type BridgeCommandRunArgs = {
	from?: string
	to?: string
	amount: string
	account?: string
	recipient?: string
	timeoutSlots?: string
	json?: boolean
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
	return {
		...session,
		...patch,
		phase: next.phase,
		status: next.status,
		updatedAt: now()
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
	json: args.json === true
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

const sortByIndex = <T extends { index: number }>(items: T[]): T[] =>
	[...items].sort((left, right) => left.index - right.index)

const maxIndex = <T extends { index: number }>(items: T[]): number =>
	items.reduce((highest, item) => Math.max(highest, item.index), -1)

const getSubmitHash = (session: OperationSession): string | undefined =>
	session.submittedTransactions.find((transaction) => transaction.action === "submit")?.hash

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

const isDepositTerminal = (status: DepositStatus) => status.finalised || status.cancelled
const isWithdrawalTerminal = (status: WithdrawalStatus) => status.finalised

const formatErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error)

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
	run
}: {
	session: OperationSession
	controller: ReturnType<typeof createOperationStateController>
	sessionStore: Pick<SessionStore, "save">
	log: LogFn
	sleep: (ms: number) => Promise<void>
	retryDelayMs?: number
	now: () => string
	operation: string
	run: () => Promise<T>
}): Promise<{ session: OperationSession; value: T }> => {
	let currentSession = session

	for (;;) {
		try {
			return { session: currentSession, value: await run() }
		} catch (error) {
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

const resolveTargetIndex = ({
	session,
	statuses
}: {
	session: OperationSession
	statuses: Array<DepositStatus | WithdrawalStatus>
}): number | undefined => {
	if (session.targetIndex !== undefined) {
		return session.targetIndex
	}

	const submitHash = getSubmitHash(session)
	if (submitHash !== undefined) {
		const matchedIndex = statuses.find((status) => status.hash === submitHash)?.index
		if (matchedIndex !== undefined) {
			return matchedIndex
		}
	}

	return statuses.length > 0 ? maxIndex(statuses) : undefined
}

const findDepositTarget = ({
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

	return statuses.length === 1 ? statuses[0] : undefined
}

const findWithdrawalTarget = ({
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

	return statuses.length === 1 ? statuses[0] : undefined
}

const firstClaimableDepositIndex = (statuses: DepositStatus[]): number | undefined =>
	sortByIndex(statuses).find((status) => status.confirmed && !status.finalised && !status.cancelled)
		?.index

const firstClaimableWithdrawalIndex = (statuses: WithdrawalStatus[]): number | undefined =>
	sortByIndex(statuses).find((status) => status.committed && !status.finalised)?.index

export const runBridgeOperation = async (
	input: BridgeFlowInput,
	deps: BridgeFlowDeps
): Promise<OperationSession> => {
	const route = resolveRoute(input.from, input.to)
	const now = deps.now ?? (() => new Date().toISOString())
	let session =
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
			createdAt: now(),
			updatedAt: now(),
			submittedTransactions: []
		} satisfies OperationSession)
	const controller = createOperationStateController({
		phase: session.phase,
		status: session.status
	})
	const waitTracker: WaitStateTracker = {
		emittedImmediateHeartbeat: false
	}

	await persistSession({
		session,
		sessionStore: deps.sessionStore,
		log: deps.log,
		event: "initialized"
	})

	if (session.direction === "deposit") {
		if (session.submittedTransactions.length === 0) {
			const submitResult = await requireAdapterMethod(
				deps.adapter,
				"submitDeposit"
			)({
				account: session.account,
				amount: session.amount,
				timeoutSlots: session.timeoutSlots,
				wait: true
			})
			session = transitionSession({
				controller,
				session,
				event: "MARK_SUBMITTED",
				now,
				patch: appendSubmittedTransaction(session, {
					action: "submit",
					hash: submitResult.hash
				})
			})
			await persistSession({
				session,
				sessionStore: deps.sessionStore,
				log: deps.log,
				event: "submitted",
				details: { hash: submitResult.hash }
			})
		}

		for (;;) {
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
			const statuses = sortByIndex(depositStatusesResult.value)
			const target = findDepositTarget({ session, statuses })
			const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
			const claimableIndex = firstClaimableDepositIndex(statuses)
			const pendingAhead =
				targetIndex === undefined
					? 0
					: statuses.filter((status) => status.index < targetIndex && !isDepositTerminal(status))
							.length

			if (targetIndex !== undefined && session.targetIndex !== targetIndex) {
				session = {
					...session,
					targetIndex,
					updatedAt: now()
				}
				await deps.sessionStore.save(session)
			}

			if (target?.cancelled) {
				return cancelSession({
					session,
					controller,
					sessionStore: deps.sessionStore,
					log: deps.log,
					now
				})
			}

			if (target?.finalised) {
				return completeSession({
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
				})
			}

			if (pendingAhead > 0) {
				session = await maybeEnterWaitState({
					session,
					controller,
					sessionStore: deps.sessionStore,
					log: deps.log,
					now,
					tracker: waitTracker,
					signature: `prior:${targetIndex ?? "unknown"}:${pendingAhead}`,
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
				operation: "canFinalizeDeposit",
				run: async () =>
					deps.adapter.canFinalizeDeposit
						? deps.adapter.canFinalizeDeposit(session.account)
						: Boolean(target?.confirmed && !target?.finalised)
			})
			session = canFinalizeResult.session

			const shouldAdvanceClaim =
				canFinalizeResult.value &&
				claimableIndex !== undefined &&
				claimableIndex !== session.pendingFinalizeIndex &&
				(pendingAhead > 0 || claimableIndex === target?.index)

			if (shouldAdvanceClaim) {
				const finalizeResult = await requireAdapterMethod(
					deps.adapter,
					"finalizeDeposit"
				)({
					account: session.account,
					wait: true
				})
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
						finalTransaction: {
							action: "finalize",
							hash: finalizeResult.hash,
							explorerUrl: finalizeResult.explorerUrl
						},
						pendingFinalizeIndex: claimableIndex,
						queueAdvances:
							pendingAhead > 0 ? (session.queueAdvances ?? 0) + 1 : session.queueAdvances
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
						claimIndex: claimableIndex,
						advancedPriorClaim: pendingAhead > 0
					}
				})
				continue
			}

			const canCancelResult = await withRetry({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				sleep: deps.sleep,
				retryDelayMs: deps.retryDelayMs,
				now,
				operation: "canCancelDeposit",
				run: async () =>
					deps.adapter.canCancelDeposit ? deps.adapter.canCancelDeposit(session.account) : false
			})
			session = canCancelResult.session

			const shouldCancel =
				canCancelResult.value &&
				target !== undefined &&
				pendingAhead === 0 &&
				!target.confirmed &&
				!session.submittedTransactions.some((transaction) => transaction.action === "cancel")

			if (shouldCancel) {
				const cancelResult = await requireAdapterMethod(
					deps.adapter,
					"cancelDeposit"
				)({
					account: session.account,
					wait: true
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
						finalTransaction: {
							action: "cancel",
							hash: cancelResult.hash,
							explorerUrl: cancelResult.explorerUrl
						}
					}
				})
				waitTracker.lastWaitSignature = undefined
				waitTracker.emittedImmediateHeartbeat = false
				await persistSession({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					event: "cancel-submitted",
					details: { hash: cancelResult.hash }
				})
				continue
			}

			await maybeEmitHeartbeat({
				session,
				now,
				pollIntervalMs: deps.pollIntervalMs,
				tracker: waitTracker,
				log: deps.log,
				details:
					pendingAhead > 0
						? { waiting: "prior-claims", pendingAhead, targetIndex, claimIndex: claimableIndex }
						: target
							? { waiting: "finalization", targetIndex: target.index, claimIndex: claimableIndex }
							: { waiting: "submission", submitHash: getSubmitHash(session) }
			})
			await deps.sleep(deps.pollIntervalMs)
		}
	}

	if (session.submittedTransactions.length === 0) {
		const submitResult = await requireAdapterMethod(
			deps.adapter,
			"submitWithdrawal"
		)({
			account: session.account,
			amount: session.amount,
			wait: true
		})
		session = transitionSession({
			controller,
			session,
			event: "MARK_SUBMITTED",
			now,
			patch: appendSubmittedTransaction(session, {
				action: "submit",
				hash: submitResult.hash
			})
		})
		await persistSession({
			session,
			sessionStore: deps.sessionStore,
			log: deps.log,
			event: "submitted",
			details: { hash: submitResult.hash }
		})
	}

	for (;;) {
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
		const statuses = sortByIndex(withdrawalStatusesResult.value)
		const target = findWithdrawalTarget({ session, statuses })
		const targetIndex = target?.index ?? resolveTargetIndex({ session, statuses })
		const claimableIndex = firstClaimableWithdrawalIndex(statuses)
		const pendingAhead =
			targetIndex === undefined
				? 0
				: statuses.filter((status) => status.index < targetIndex && !isWithdrawalTerminal(status))
						.length

		if (targetIndex !== undefined && session.targetIndex !== targetIndex) {
			session = {
				...session,
				targetIndex,
				updatedAt: now()
			}
			await deps.sessionStore.save(session)
		}

		if (target?.finalised) {
			return completeSession({
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
			})
		}

		if (pendingAhead > 0) {
			session = await maybeEnterWaitState({
				session,
				controller,
				sessionStore: deps.sessionStore,
				log: deps.log,
				now,
				tracker: waitTracker,
				signature: `prior:${targetIndex ?? "unknown"}:${pendingAhead}`,
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
			run: async () =>
				deps.adapter.canFinalizeWithdrawal
					? deps.adapter.canFinalizeWithdrawal(session.account)
					: Boolean(target?.committed && !target?.finalised)
		})
		session = canFinalizeResult.session

		const shouldAdvanceClaim =
			canFinalizeResult.value &&
			claimableIndex !== undefined &&
			claimableIndex !== session.pendingFinalizeIndex &&
			(pendingAhead > 0 || claimableIndex === target?.index)

		if (shouldAdvanceClaim) {
			const finalizeResult = await requireAdapterMethod(
				deps.adapter,
				"finalizeWithdrawal"
			)({
				account: session.account,
				wait: true
			})
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
					finalTransaction: {
						action: "finalize",
						hash: finalizeResult.hash,
						explorerUrl: finalizeResult.explorerUrl
					},
					pendingFinalizeIndex: claimableIndex,
					queueAdvances: pendingAhead > 0 ? (session.queueAdvances ?? 0) + 1 : session.queueAdvances
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
					claimIndex: claimableIndex,
					advancedPriorClaim: pendingAhead > 0
				}
			})
			continue
		}

		await maybeEmitHeartbeat({
			session,
			now,
			pollIntervalMs: deps.pollIntervalMs,
			tracker: waitTracker,
			log: deps.log,
			details:
				pendingAhead > 0
					? { waiting: "prior-claims", pendingAhead, targetIndex, claimIndex: claimableIndex }
					: target
						? { waiting: "finalization", targetIndex: target.index, claimIndex: claimableIndex }
						: { waiting: "submission", submitHash: getSubmitHash(session) }
		})
		await deps.sleep(deps.pollIntervalMs)
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
			json: { type: "boolean", default: false }
		},
		async run({ args }) {
			const commandArgs = parseBridgeCommandArgs({
				from: typeof args.from === "string" ? args.from : undefined,
				to: typeof args.to === "string" ? args.to : undefined,
				amount: typeof args.amount === "string" ? args.amount : "",
				account: typeof args.account === "string" ? args.account : undefined,
				recipient: typeof args.recipient === "string" ? args.recipient : undefined,
				timeoutSlots: typeof args.timeoutSlots === "string" ? args.timeoutSlots : undefined,
				json: args.json === true
			} satisfies BridgeCommandRunArgs)
			const from = commandArgs.from
			const to = commandArgs.to
			const account = deriveAccount(from, commandArgs.account)
			const recipient = commandArgs.recipient ?? account
			const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
			const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
			const id = (deps.generateId ?? randomUUID)()
			const logPath = path.join(appPaths.logDir, `${id}.jsonl`)
			const logger = (deps.createLogger ?? createOperationLogger)({ logPath })
			const createAdapter =
				deps.createAdapter ??
				(async ({
					from: inputFrom,
					to: inputTo
				}: {
					from: ChainRef
					to: ChainRef
				}) => {
					const { createBridgeAdapter } = await import("../core/adapter")
					return createBridgeAdapter({ route: resolveRoute(inputFrom, inputTo) })
				})
			const session = await runBridgeOperation(
				{
					id,
					from,
					to,
					amount: commandArgs.amount,
					account,
					recipient,
					timeoutSlots: commandArgs.timeoutSlots
				},
				{
					adapter: await createAdapter({ from, to }),
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
					now: deps.now
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
