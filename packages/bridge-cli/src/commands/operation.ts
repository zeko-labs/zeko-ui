import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { defineCommand, type CommandDef } from "citty"
import { PrivateKey } from "o1js"
import { runBridgeOperation } from "./bridge"
import type { BridgeAdapter } from "../core/adapter"
import {
	analyzeDepositQueue,
	analyzeWithdrawalQueue,
	getSubmitHash,
	sortByIndex
} from "../core/bridge-queue"
import { createOperationLogger } from "../core/logger"
import { resolveAppPaths } from "../core/paths"
import {
	renderBridgeResult,
	renderOperationProgress,
	toBridgeJsonResult,
	type BridgeCommandJsonResult
} from "../core/reporter"
import { resolveSignerKeys } from "../core/signer"
import { createSessionStore, type SessionStore } from "../core/session-store"
import type { ChainRef } from "../core/routes"
import { formatRoute, parseChainRef, parseRouteString, resolveRoute } from "../core/routes"
import type {
	BridgeCapabilityDiagnostic,
	DepositStatus,
	OperationLiveSnapshot,
	OperationPhase,
	OperationSession,
	WithdrawalStatus
} from "../core/types"

type OperationCommandDeps = {
	createStore?: (input: { stateDir: string }) => Pick<SessionStore, "list" | "load" | "save">
	resolvePaths?: typeof resolveAppPaths
	createAdapter?: (input: { from: ChainRef; to: ChainRef; verbose: boolean }) =>
		| Promise<BridgeAdapter>
		| BridgeAdapter
	readLog?: (path: string) => Promise<string>
	createLogger?: (input: { logPath: string }) => Pick<
		ReturnType<typeof createOperationLogger>,
		"write"
	>
	write?: (message: string) => void
	writeProgress?: (message: string) => void
	sleep?: (ms: number) => Promise<void>
	pollIntervalMs?: number
	heartbeatIntervalMs?: number
	retryDelayMs?: number
	generateId?: () => string
	now?: () => string
}

type ResumeUserQueueItem =
	| {
			direction: "deposit"
			from: ChainRef
			to: ChainRef
			target: DepositStatus
			session?: OperationSession
	  }
	| {
			direction: "withdrawal"
			from: ChainRef
			to: ChainRef
			target: WithdrawalStatus
			session?: OperationSession
	  }

type ResumeUserResult = {
	success: boolean
	account: string
	operationsFound: number
	operationsResolved: number
	results: OperationSession[]
}

type ResumeUserJsonResult = {
	success: boolean
	account: string
	operations_found: number
	operations_resolved: number
	operations: Array<
		BridgeCommandJsonResult & {
			resolved: boolean
		}
	>
}

type CompletedOperationJsonResult = {
	count: number
	operations: BridgeCommandJsonResult[]
}

type OperationStatusJsonResult = {
	id: string
	status: OperationSession["status"]
	phase: string
	route: OperationSession["route"]
	direction: OperationSession["direction"]
	account: string
	recipient: string
	amount: string
	timeout_slots?: number
	log_path: string
	created_at: string
	updated_at: string
	refreshed_at?: string
	submitted_transactions: OperationSession["submittedTransactions"]
	final_transaction: OperationSession["finalTransaction"] | null
	target_index?: number
	claimable_index?: number
	pending_ahead?: number
	can_finalize?: boolean
	can_cancel?: boolean
	submit_hash?: string
	observed_counts?: OperationLiveSnapshot["observedCounts"]
	next_action?: OperationLiveSnapshot["nextAction"]
	waiting_on?: OperationLiveSnapshot["waitingOn"]
	error: string | null
}

const parseId = (value: unknown): string => {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error("Missing required operation id")
	}

	return value
}

const parseJsonFlag = (value: unknown): boolean => (typeof value === "boolean" ? value : false)

const parseRoutePair = (value: string): [ChainRef, ChainRef] => parseRouteString(value)

const parseChainArg = (value: unknown, fallback: ChainRef, flag: "--from" | "--to"): ChainRef =>
	parseChainRef(typeof value === "string" ? value : fallback, flag)

const parseOptionalString = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined

const deriveAccount = (from: ChainRef, explicit?: string): string => {
	if (explicit) return explicit

	const keys = resolveSignerKeys()
	const secret = from.startsWith("zeko:") ? keys.zeko : keys.mina
	return PrivateKey.fromBase58(secret).toPublicKey().toBase58()
}

const toResumeUserJsonResult = (result: ResumeUserResult): ResumeUserJsonResult => ({
	success: result.success,
	account: result.account,
	operations_found: result.operationsFound,
	operations_resolved: result.operationsResolved,
	operations: result.results.map((session) => ({
		...toBridgeJsonResult(session),
		resolved: session.status === "completed" || session.status === "cancelled"
	}))
})

const renderResumeUserResult = (result: ResumeUserResult): string => {
	const lines = [
		`${result.success ? "Success" : "Failed"}: resumed ${result.operationsResolved}/${result.operationsFound} pending operation${result.operationsFound === 1 ? "" : "s"}`,
		`Account: ${result.account}`
	]

	for (const session of result.results) {
		lines.push(
			`- ${session.id} | ${session.direction} | ${session.route} | ${session.status} | submit=${getSubmitHash(session) ?? "-"} | final=${session.finalTransaction?.hash ?? "-"} | log=${session.logPath}`
		)
	}

	return lines.join("\n")
}

const isResolvedOperation = (session: OperationSession): boolean =>
	session.status === "completed" || session.status === "cancelled"

const renderCompletedOperations = (sessions: OperationSession[]): string => {
	const lines = [`Completed operations: ${sessions.length}`]

	if (sessions.length === 0) {
		lines.push("No completed or cancelled operations found.")
		return lines.join("\n")
	}

	for (const session of sessions) {
		lines.push(
			`- ${session.id} | ${session.status} | ${session.direction} | ${session.route} | submit=${getSubmitHash(session) ?? "-"} | final=${session.finalTransaction?.hash ?? "-"} | updated=${session.updatedAt}`
		)
	}

	return lines.join("\n")
}

const toCompletedOperationsJsonResult = (
	sessions: OperationSession[]
): CompletedOperationJsonResult => ({
	count: sessions.length,
	operations: sessions.map((session) => toBridgeJsonResult(session))
})

const toOperationStatusPhase = (session: OperationSession): string => {
	const snapshot = session.liveSnapshot
	if (!snapshot) {
		return session.phase
	}

	if (snapshot.nextAction === "finalize") {
		return "ready-finalization"
	}

	if (snapshot.nextAction === "cancel") {
		return "ready-cancellation"
	}

	if (snapshot.nextAction === "completed") {
		return "completed"
	}

	if (snapshot.nextAction === "cancelled") {
		return "cancelled"
	}

	if (snapshot.waitingOn === "submission") {
		return "waiting-submission"
	}

	if (snapshot.waitingOn === "prior-claims") {
		return "waiting-prior-claims"
	}

	if (snapshot.waitingOn === "finalization") {
		return "waiting-finalization"
	}

	return session.phase
}

const toOperationStatusJsonResult = (session: OperationSession): OperationStatusJsonResult => ({
	id: session.id,
	status: session.status,
	phase: toOperationStatusPhase(session),
	route: session.route,
	direction: session.direction,
	account: session.account,
	recipient: session.recipient ?? session.account,
	amount: session.amount,
	...(session.timeoutSlots !== undefined ? { timeout_slots: session.timeoutSlots } : {}),
	log_path: session.logPath,
	created_at: session.createdAt,
	updated_at: session.updatedAt,
	...(session.liveSnapshot?.refreshedAt ? { refreshed_at: session.liveSnapshot.refreshedAt } : {}),
	submitted_transactions: session.submittedTransactions,
	final_transaction: session.finalTransaction ?? null,
	...(session.liveSnapshot?.targetIndex !== undefined
		? { target_index: session.liveSnapshot.targetIndex }
		: session.targetIndex !== undefined
			? { target_index: session.targetIndex }
			: {}),
	...(session.liveSnapshot?.claimableIndex !== undefined
		? { claimable_index: session.liveSnapshot.claimableIndex }
		: {}),
	...(session.liveSnapshot?.pendingAhead !== undefined
		? { pending_ahead: session.liveSnapshot.pendingAhead }
		: {}),
	...(session.liveSnapshot?.canFinalize !== undefined
		? { can_finalize: session.liveSnapshot.canFinalize }
		: {}),
	...(session.liveSnapshot?.canCancel !== undefined
		? { can_cancel: session.liveSnapshot.canCancel }
		: {}),
	...(session.liveSnapshot?.submitHash ? { submit_hash: session.liveSnapshot.submitHash } : {}),
	...(session.liveSnapshot?.observedCounts
		? { observed_counts: session.liveSnapshot.observedCounts }
		: {}),
	...(session.liveSnapshot?.nextAction ? { next_action: session.liveSnapshot.nextAction } : {}),
	...(session.liveSnapshot?.waitingOn ? { waiting_on: session.liveSnapshot.waitingOn } : {}),
	error: session.lastError ?? null
})

const resolveRouteQueue = (from: ChainRef, to: ChainRef) => {
	const route = resolveRoute(from, to)
	return route.direction === "deposit"
		? {
				depositFrom: from,
				depositTo: to,
				withdrawalFrom: to,
				withdrawalTo: from
			}
		: {
				depositFrom: to,
				depositTo: from,
				withdrawalFrom: from,
				withdrawalTo: to
			}
}

const matchesPendingItem = ({
	session,
	direction,
	from,
	to,
	hash
}: {
	session: OperationSession
	direction: "deposit" | "withdrawal"
	from: ChainRef
	to: ChainRef
	hash: string
}): boolean =>
	session.direction === direction &&
	session.route === formatRoute(from, to) &&
	getSubmitHash(session) === hash

const withSubmittedHash = ({
	session,
	hash
}: {
	session: OperationSession
	hash: string
}): OperationSession => {
	if (session.submittedTransactions.some((transaction) => transaction.action === "submit")) {
		return session.submittedTransactions.some(
			(transaction) => transaction.action === "submit" && transaction.hash === hash
		)
			? session
			: {
					...session,
					submittedTransactions: [
						{ action: "submit", hash },
						...session.submittedTransactions.filter(
							(transaction) => transaction.action !== "submit"
						)
					]
				}
	}

	return {
		...session,
		submittedTransactions: [{ action: "submit", hash }, ...session.submittedTransactions]
	}
}

const createResumedSession = ({
	item,
	account,
	now,
	appPaths,
	generateId
}: {
	item: ResumeUserQueueItem
	account: string
	now: () => string
	appPaths: ReturnType<typeof resolveAppPaths>
	generateId: () => string
}): OperationSession => {
	const existing = item.session
	const id = existing?.id ?? generateId()
	const logPath =
		existing?.logPath && existing.logPath.length > 0
			? existing.logPath
			: path.join(appPaths.logDir, `${id}.jsonl`)
	const next = withSubmittedHash({
		session:
			existing ??
			({
				id,
				status: "running",
				phase: "submitted",
				route: formatRoute(item.from, item.to),
				direction: item.direction,
				account,
				recipient: item.target.recipient,
				amount: item.target.amount,
				logPath,
				createdAt: now(),
				updatedAt: now(),
				submittedTransactions: []
			} satisfies OperationSession),
		hash: item.target.hash
	})

	return {
		...next,
		status: "running",
		phase: "submitted",
		route: formatRoute(item.from, item.to),
		direction: item.direction,
		account,
		recipient: item.target.recipient,
		amount: item.target.amount,
		logPath,
		targetIndex: item.target.index,
		pendingFinalizeIndex: undefined,
		finalTransaction: undefined,
		lastError: undefined,
		updatedAt: now()
	}
}

const normalizeSessionForResume = ({
	session,
	now
}: {
	session: OperationSession
	now: () => string
}): OperationSession => {
	if (session.status !== "failed") {
		return session
	}

	return {
		...session,
		status: "running",
		phase: "submitted",
		lastError: undefined,
		updatedAt: now()
	}
}

const withLiveSnapshot = ({
	session,
	now,
	patch,
	liveSnapshot
}: {
	session: OperationSession
	now: () => string
	patch: Partial<OperationSession>
	liveSnapshot: OperationLiveSnapshot
}): OperationSession => ({
	...session,
	...patch,
	liveSnapshot,
	updatedAt: now()
})

const normalizeCapabilityResult = (
	result: boolean | BridgeCapabilityDiagnostic
): BridgeCapabilityDiagnostic =>
	typeof result === "boolean" ? { available: result, reason: null } : result

const refreshDepositSession = async ({
	session,
	adapter,
	now
}: {
	session: OperationSession
	adapter: BridgeAdapter
	now: () => string
}): Promise<OperationSession> => {
	const deposits = sortByIndex(await adapter.getDepositStatuses(session.account))
	const analysis = analyzeDepositQueue({ session, statuses: deposits })
	const [canFinalizeResult, canCancelResult] = await Promise.all([
		adapter.canFinalizeDeposit
			? adapter.canFinalizeDeposit(session.account)
			: Promise.resolve(false as boolean | BridgeCapabilityDiagnostic),
		adapter.canCancelDeposit
			? adapter.canCancelDeposit(session.account)
			: Promise.resolve(false as boolean | BridgeCapabilityDiagnostic)
	])
	const canFinalize = normalizeCapabilityResult(canFinalizeResult).available
	const canCancel = normalizeCapabilityResult(canCancelResult).available
	const liveBase = {
		refreshedAt: now(),
		targetIndex: analysis.targetIndex,
		claimableIndex: analysis.claimableIndex,
		pendingAhead: analysis.pendingAhead,
		canFinalize,
		canCancel,
		submitHash: getSubmitHash(session),
		observedCounts: {
			deposits: deposits.length,
			withdrawals: 0
		}
	} satisfies Omit<OperationLiveSnapshot, "nextAction">

	if (analysis.target?.cancelled) {
		return withLiveSnapshot({
			session,
			now,
			patch: {
				status: "cancelled",
				phase: "cancelled",
				lastError: undefined,
				targetIndex: analysis.target.index,
				pendingFinalizeIndex: undefined,
				pendingFinalizeSubmittedAt: undefined,
				pendingCancelMarker: undefined,
				finalTransaction: session.finalTransaction ?? {
					action: "cancel",
					hash: analysis.target.hash,
					explorerUrl: ""
				}
			},
			liveSnapshot: {
				...liveBase,
				nextAction: "cancelled"
			}
		})
	}

	if (analysis.target?.finalised) {
		return withLiveSnapshot({
			session,
			now,
			patch: {
				status: "completed",
				phase: "completed",
				lastError: undefined,
				targetIndex: analysis.target.index,
				pendingFinalizeIndex: undefined,
				pendingFinalizeSubmittedAt: undefined,
				pendingCancelMarker: undefined,
				finalTransaction: session.finalTransaction ?? {
					action: "finalize",
					hash: analysis.target.hash,
					explorerUrl: ""
				}
			},
			liveSnapshot: {
				...liveBase,
				nextAction: "completed"
			}
		})
	}

	const shouldFinalize =
		canFinalize &&
		analysis.claimableIndex !== undefined &&
		(analysis.shouldAdvanceQueuedClaims || analysis.claimableIndex === analysis.target?.index)
	const shouldCancel =
		canCancel &&
		((analysis.shouldAdvanceQueuedClaims &&
			(analysis.claimableIndex === undefined || !canFinalize)) ||
			(analysis.target !== undefined && analysis.pendingAhead === 0 && !canFinalize))
	const waitingOn =
		analysis.target === undefined
			? "submission"
			: analysis.shouldAdvanceQueuedClaims
				? "prior-claims"
				: "finalization"
	const phase: OperationPhase =
		waitingOn === "submission"
			? "waiting-submission"
			: waitingOn === "prior-claims"
				? "waiting-prior-claims"
				: "waiting-finalization"

	return withLiveSnapshot({
		session,
		now,
		patch: {
			status: "running",
			phase,
			lastError: undefined,
			targetIndex: analysis.targetIndex
		},
		liveSnapshot: {
			...liveBase,
			nextAction: shouldFinalize ? "finalize" : shouldCancel ? "cancel" : "wait",
			waitingOn
		}
	})
}

const refreshWithdrawalSession = async ({
	session,
	adapter,
	now
}: {
	session: OperationSession
	adapter: BridgeAdapter
	now: () => string
}): Promise<OperationSession> => {
	const withdrawals = sortByIndex(await adapter.getWithdrawalStatuses(session.account))
	const analysis = analyzeWithdrawalQueue({ session, statuses: withdrawals })
	const canFinalize = adapter.canFinalizeWithdrawal
		? normalizeCapabilityResult(await adapter.canFinalizeWithdrawal(session.account)).available
		: false
	const liveBase = {
		refreshedAt: now(),
		targetIndex: analysis.targetIndex,
		claimableIndex: analysis.claimableIndex,
		pendingAhead: analysis.pendingAhead,
		canFinalize,
		submitHash: getSubmitHash(session),
		observedCounts: {
			deposits: 0,
			withdrawals: withdrawals.length
		}
	} satisfies Omit<OperationLiveSnapshot, "nextAction">

	if (analysis.target?.finalised) {
		return withLiveSnapshot({
			session,
			now,
			patch: {
				status: "completed",
				phase: "completed",
				lastError: undefined,
				targetIndex: analysis.target.index,
				pendingFinalizeIndex: undefined,
				pendingFinalizeSubmittedAt: undefined,
				finalTransaction: session.finalTransaction ?? {
					action: "finalize",
					hash: analysis.target.hash,
					explorerUrl: ""
				}
			},
			liveSnapshot: {
				...liveBase,
				nextAction: "completed"
			}
		})
	}

	const shouldFinalize =
		canFinalize &&
		analysis.claimableIndex !== undefined &&
		(analysis.shouldAdvanceQueuedClaims || analysis.claimableIndex === analysis.target?.index)
	const waitingOn =
		analysis.target === undefined
			? "submission"
			: analysis.shouldAdvanceQueuedClaims
				? "prior-claims"
				: "finalization"
	const phase: OperationPhase =
		waitingOn === "submission"
			? "waiting-submission"
			: waitingOn === "prior-claims"
				? "waiting-prior-claims"
				: "waiting-finalization"

	return withLiveSnapshot({
		session,
		now,
		patch: {
			status: "running",
			phase,
			lastError: undefined,
			targetIndex: analysis.targetIndex
		},
		liveSnapshot: {
			...liveBase,
			nextAction: shouldFinalize ? "finalize" : "wait",
			waitingOn
		}
	})
}

const refreshOperationSession = async ({
	session,
	createAdapter,
	now,
	verbose
}: {
	session: OperationSession
	createAdapter: (input: {
		from: ChainRef
		to: ChainRef
		verbose: boolean
	}) => Promise<BridgeAdapter> | BridgeAdapter
	now: () => string
	verbose: boolean
}): Promise<OperationSession> => {
	const [from, to] = parseRoutePair(session.route)
	const adapter = await createAdapter({ from, to, verbose })

	return session.direction === "deposit"
		? refreshDepositSession({ session, adapter, now })
		: refreshWithdrawalSession({ session, adapter, now })
}

const createAdapterWithRetries = async ({
	createAdapter,
	from,
	to,
	verbose,
	log,
	sleep,
	retryDelayMs
}: {
	createAdapter: (input: {
		from: ChainRef
		to: ChainRef
		verbose: boolean
	}) => Promise<BridgeAdapter> | BridgeAdapter
	from: ChainRef
	to: ChainRef
	verbose: boolean
	log: (entry: {
		event: string
		phase: OperationPhase
		details?: Record<string, unknown>
	}) => Promise<void>
	sleep: (ms: number) => Promise<void>
	retryDelayMs: number
}): Promise<BridgeAdapter> => {
	const isRetryableInitializationError = (error: unknown): boolean => {
		const message = error instanceof Error ? error.message : String(error)
		return !/Missing required signer private key|Unsupported bridge route|Invalid private key/i.test(
			message
		)
	}

	for (let attempt = 1; ; attempt += 1) {
		try {
			return await createAdapter({ from, to, verbose })
		} catch (error) {
			if (!isRetryableInitializationError(error)) {
				throw error
			}

			await log({
				event: "retrying",
				phase: "initializing",
				details: {
					operation: "Bridge.init",
					attempt,
					message: error instanceof Error ? error.message : String(error)
				}
			})
			await sleep(retryDelayMs)
		}
	}
}

export const createOperationCommand = (deps: OperationCommandDeps = {}): CommandDef =>
	defineCommand({
		meta: {
			name: "operation",
			description: "Inspect or resume persisted bridge operations."
		},
		subCommands: {
			list: defineCommand({
				meta: { name: "list", description: "List persisted operations." },
				async run() {
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					;(deps.write ?? console.log)(JSON.stringify(await store.list(), null, 2))
				}
			}),
			completed: defineCommand({
				meta: { name: "completed", description: "List completed and cancelled operations." },
				args: {
					json: { type: "boolean", default: false }
				},
				async run({ args }) {
					const json = parseJsonFlag(args.json)
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const completedSessions = (await store.list()).filter(isResolvedOperation)
					;(deps.write ?? console.log)(
						json
							? JSON.stringify(toCompletedOperationsJsonResult(completedSessions), null, 2)
							: renderCompletedOperations(completedSessions)
					)
				}
			}),
			status: defineCommand({
				meta: { name: "status", description: "Show one persisted operation." },
				args: {
					id: { type: "positional", required: true },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const id = parseId(args.id)
					const verbose = typeof args.verbose === "boolean" ? args.verbose : false
					const now = deps.now ?? (() => new Date().toISOString())
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					const createAdapter =
						deps.createAdapter ??
						(async ({
							from: inputFrom,
							to: inputTo,
							verbose: inputVerbose
						}: {
							from: ChainRef
							to: ChainRef
							verbose: boolean
						}) => {
							const { createBridgeAdapter } = await import("../core/adapter")
							return createBridgeAdapter({
								route: resolveRoute(inputFrom, inputTo),
								verbose: inputVerbose
							})
						})
					;(deps.writeProgress ?? console.error)(
						renderOperationProgress({
							event: "refreshing-status",
							phase: session.phase,
							details: {
								operationId: session.id,
								route: session.route
							}
						})
					)
					const refreshed = await refreshOperationSession({
						session,
						createAdapter,
						now,
						verbose
					})
					await store.save(refreshed)
					;(deps.write ?? console.log)(
						JSON.stringify(toOperationStatusJsonResult(refreshed), null, 2)
					)
				}
			}),
			logs: defineCommand({
				meta: { name: "logs", description: "Print the log file for an operation." },
				args: {
					id: { type: "positional", required: true }
				},
				async run({ args }) {
					const id = parseId(args.id)
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					;(deps.write ?? console.log)(
						await (deps.readLog ?? ((path) => readFile(path, "utf8")))(session.logPath)
					)
				}
			}),
			resume: defineCommand({
				meta: { name: "resume", description: "Resume a persisted operation." },
				args: {
					id: { type: "positional", required: true },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const id = parseId(args.id)
					const json = parseJsonFlag(args.json)
					const verbose = typeof args.verbose === "boolean" ? args.verbose : false
					const now = deps.now ?? (() => new Date().toISOString())
					const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
					const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					const normalizedSession = normalizeSessionForResume({ session, now })
					const [from, to] = parseRoutePair(session.route)
					const logger = (deps.createLogger ?? createOperationLogger)({
						logPath: session.logPath
					})
					const createAdapter =
						deps.createAdapter ??
						(async ({
							from: inputFrom,
							to: inputTo,
							verbose: inputVerbose
						}: {
							from: ChainRef
							to: ChainRef
							verbose: boolean
						}) => {
							const { createBridgeAdapter } = await import("../core/adapter")
							return createBridgeAdapter({
								route: resolveRoute(inputFrom, inputTo),
								verbose: inputVerbose
							})
						})
					const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
					const log = async ({
						event,
						phase,
						details
					}: {
						event: string
						phase: OperationPhase
						details?: Record<string, unknown>
					}) => {
						;(deps.writeProgress ?? console.error)(
							renderOperationProgress({ event, phase, details })
						)
						await logger.write(event, { phase, ...details })
					}
					const resumed = await runBridgeOperation(
						{
							id: normalizedSession.id,
							from,
							to,
							amount: normalizedSession.amount,
							account: normalizedSession.account,
							recipient: normalizedSession.recipient,
							timeoutSlots: normalizedSession.timeoutSlots,
							session: normalizedSession
						},
						{
							adapter: await createAdapterWithRetries({
								createAdapter,
								from,
								to,
								verbose,
								log,
								sleep,
								retryDelayMs: deps.retryDelayMs ?? 5_000
							}),
							sessionStore: store,
							log,
							sleep,
							pollIntervalMs: deps.pollIntervalMs ?? 20_000,
							retryDelayMs: deps.retryDelayMs,
							verbose
						}
					)
					;(deps.write ?? console.log)(
						json
							? JSON.stringify(toBridgeJsonResult(resumed), null, 2)
							: renderBridgeResult(resumed)
					)
				}
			}),
			"resume-user": defineCommand({
				meta: {
					name: "resume-user",
					description: "Discover and sequentially resume pending bridge operations for a user."
				},
				args: {
					from: { type: "string", default: "mina:testnet" },
					to: { type: "string", default: "zeko:testnet" },
					account: { type: "string", required: false },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const from = parseChainArg(args.from, "mina:testnet", "--from")
					const to = parseChainArg(args.to, "zeko:testnet", "--to")
					const json = parseJsonFlag(args.json)
					const verbose = typeof args.verbose === "boolean" ? args.verbose : false
					const account = deriveAccount(from, parseOptionalString(args.account))
					const now = deps.now ?? (() => new Date().toISOString())
					const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
					const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
					const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
					const createAdapter =
						deps.createAdapter ??
						(async ({
							from: inputFrom,
							to: inputTo,
							verbose: inputVerbose
						}: {
							from: ChainRef
							to: ChainRef
							verbose: boolean
						}) => {
							const { createBridgeAdapter } = await import("../core/adapter")
							return createBridgeAdapter({
								route: resolveRoute(inputFrom, inputTo),
								verbose: inputVerbose
							})
						})
					const queueRoutes = resolveRouteQueue(from, to)
					const discoveryLog = async ({
						event,
						phase,
						details
					}: {
						event: string
						phase: OperationPhase
						details?: Record<string, unknown>
					}) => {
						;(deps.writeProgress ?? console.error)(
							renderOperationProgress({ event, phase, details })
						)
					}
					const depositAdapter = await createAdapterWithRetries({
						createAdapter,
						from: queueRoutes.depositFrom,
						to: queueRoutes.depositTo,
						verbose,
						log: discoveryLog,
						sleep,
						retryDelayMs: deps.retryDelayMs ?? 5_000
					})
					const withdrawalAdapter = await createAdapterWithRetries({
						createAdapter,
						from: queueRoutes.withdrawalFrom,
						to: queueRoutes.withdrawalTo,
						verbose,
						log: discoveryLog,
						sleep,
						retryDelayMs: deps.retryDelayMs ?? 5_000
					})
					const [persistedSessions, depositStatuses, withdrawalStatuses] = await Promise.all([
						store.list(),
						depositAdapter.getDepositStatuses(account),
						withdrawalAdapter.getWithdrawalStatuses(account)
					])
					const depositQueue: ResumeUserQueueItem[] = sortByIndex(depositStatuses)
						.filter((status) => !status.finalised && !status.cancelled)
						.map((target) => ({
							direction: "deposit" as const,
							from: queueRoutes.depositFrom,
							to: queueRoutes.depositTo,
							target,
							session: persistedSessions.find((session) =>
								matchesPendingItem({
									session,
									direction: "deposit",
									from: queueRoutes.depositFrom,
									to: queueRoutes.depositTo,
									hash: target.hash
								})
							)
						}))
					const withdrawalQueue: ResumeUserQueueItem[] = sortByIndex(withdrawalStatuses)
						.filter((status) => !status.finalised)
						.map((target) => ({
							direction: "withdrawal" as const,
							from: queueRoutes.withdrawalFrom,
							to: queueRoutes.withdrawalTo,
							target,
							session: persistedSessions.find((session) =>
								matchesPendingItem({
									session,
									direction: "withdrawal",
									from: queueRoutes.withdrawalFrom,
									to: queueRoutes.withdrawalTo,
									hash: target.hash
								})
							)
						}))
					const prioritizedQueues =
						resolveRoute(from, to).direction === "withdrawal"
							? [withdrawalQueue, depositQueue]
							: [depositQueue, withdrawalQueue]
					const queue = prioritizedQueues.flat()

					if (queue.length === 0) {
						const result: ResumeUserResult = {
							success: true,
							account,
							operationsFound: 0,
							operationsResolved: 0,
							results: []
						}
						;(deps.write ?? console.log)(
							json
								? JSON.stringify(toResumeUserJsonResult(result), null, 2)
								: renderResumeUserResult(result)
						)
						return
					}

					const results: OperationSession[] = []
					for (const group of prioritizedQueues) {
						for (const item of group) {
							const session = createResumedSession({
								item,
								account,
								now,
								appPaths,
								generateId: deps.generateId ?? randomUUID
							})
							const logger = (deps.createLogger ?? createOperationLogger)({
								logPath: session.logPath
							})
							const log = async ({
								event,
								phase,
								details
							}: {
								event: string
								phase: OperationPhase
								details?: Record<string, unknown>
							}) => {
								;(deps.writeProgress ?? console.error)(
									renderOperationProgress({ event, phase, details })
								)
								await logger.write(event, { phase, ...details })
							}

							await log({
								event: "queue-resume",
								phase: session.phase,
								details: {
									position: results.length + 1,
									total: queue.length,
									operationId: session.id,
									direction: session.direction,
									targetIndex: session.targetIndex
								}
							})

							const resumed = await runBridgeOperation(
								{
									id: session.id,
									from: item.from,
									to: item.to,
									amount: session.amount,
									account: session.account,
									recipient: session.recipient,
									timeoutSlots: session.timeoutSlots,
									session
								},
								{
									adapter: await createAdapterWithRetries({
										createAdapter,
										from: item.from,
										to: item.to,
										verbose,
										log,
										sleep,
										retryDelayMs: deps.retryDelayMs ?? 5_000
									}),
									sessionStore: store,
									log,
									sleep,
									pollIntervalMs: deps.pollIntervalMs ?? 20_000,
									retryDelayMs: deps.retryDelayMs,
									verbose,
									now
								}
							)

							results.push(resumed)
							if (resumed.status === "failed") {
								break
							}
						}
					}

					const operationsResolved = results.filter(
						(session) => session.status === "completed" || session.status === "cancelled"
					).length
					const result: ResumeUserResult = {
						success:
							results.length === queue.length &&
							results.every(
								(session) => session.status === "completed" || session.status === "cancelled"
							),
						account,
						operationsFound: queue.length,
						operationsResolved,
						results
					}
					;(deps.write ?? console.log)(
						json
							? JSON.stringify(toResumeUserJsonResult(result), null, 2)
							: renderResumeUserResult(result)
					)
				}
			})
		}
	})
