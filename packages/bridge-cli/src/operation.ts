import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { defineCommand, type CommandDef } from "citty"
import { readAliasedNumber, readBoolean, readRequired, readString } from "./args"
import { runBridgeOperation, createAdapterWithRetries } from "./bridge"
import {
	capabilityDiagnostic,
	decideDepositStep,
	decideWithdrawalStep,
	getSubmitHash,
	sortByIndex,
	type DepositQueueState,
	type WithdrawalQueueState
} from "./decisions"
import { resolveAppPaths } from "./env"
import { formatRoute, parseChainRef, resolveRoute } from "./routes"
import { createDefaultBridgeAdapter, deriveAccount } from "./sdk"
import {
	createOperationLogger,
	createProgressLog,
	createSessionStore,
	parseSessionRoute,
	projectOperationStatus,
	renderBridgeResult,
	renderOperationProgress,
	toBridgeJsonResult,
	type SessionStore
} from "./session"
import type {
	BridgeAdapter,
	BridgeAdapterFactory,
	ChainRef,
	DepositStatus,
	Direction,
	OperationLiveSnapshot,
	OperationSession,
	WithdrawalStatus
} from "./types"
import { sleepFor } from "./utils"

const RETRY_SLEEP_MS = 5_000

const refreshSessionFromNetwork = async ({
	session,
	adapter,
	now
}: {
	session: OperationSession
	adapter: BridgeAdapter
	now: () => string
}): Promise<OperationSession> => {
	const submitHash = getSubmitHash(session)
	if (session.direction === "deposit") {
		const statuses = sortByIndex(await adapter.getDepositStatuses(session.account))
		const canFinalize = capabilityDiagnostic(
			await (adapter.canFinalizeDeposit?.(session.account) ?? false)
		)
		const canCancel = capabilityDiagnostic(
			await (adapter.canCancelDeposit?.(session.account) ?? false)
		)
		const decision = decideDepositStep({ session, statuses, canFinalize, canCancel, now })
		const analysis = decision.analysis as DepositQueueState
		return {
			...session,
			updatedAt: now(),
			liveSnapshot: {
				refreshedAt: now(),
				nextAction:
					decision.action === "complete"
						? "completed"
						: decision.action === "cancelled"
							? "cancelled"
							: decision.action === "finalize"
								? "finalize"
								: decision.action === "cancel"
									? "cancel"
									: "wait",
				waitingOn:
					decision.action === "wait"
						? (decision.details.waiting as OperationLiveSnapshot["waitingOn"])
						: undefined,
				targetIndex: analysis.targetIndex,
				claimableIndex: analysis.claimableIndex,
				pendingAhead: analysis.pendingAhead,
				canFinalize: canFinalize.available,
				canCancel: canCancel.available,
				submitHash,
				observedCounts: { deposits: statuses.length, withdrawals: 0 }
			}
		}
	}
	const statuses = sortByIndex(await adapter.getWithdrawalStatuses(session.account))
	const canFinalize = capabilityDiagnostic(
		await (adapter.canFinalizeWithdrawal?.(session.account) ?? false)
	)
	const decision = decideWithdrawalStep({ session, statuses, canFinalize, now })
	const analysis = decision.analysis as WithdrawalQueueState
	return {
		...session,
		updatedAt: now(),
		liveSnapshot: {
			refreshedAt: now(),
			nextAction:
				decision.action === "complete"
					? "completed"
					: decision.action === "finalize"
						? "finalize"
						: "wait",
			waitingOn:
				decision.action === "wait"
					? (decision.details.waiting as OperationLiveSnapshot["waitingOn"])
					: undefined,
			targetIndex: analysis.targetIndex,
			claimableIndex: analysis.claimableIndex,
			pendingAhead: analysis.pendingAhead,
			canFinalize: canFinalize.available,
			submitHash,
			observedCounts: { deposits: 0, withdrawals: statuses.length }
		}
	}
}

type ResumeQueueItem = {
	direction: Direction
	from: ChainRef
	to: ChainRef
	status: DepositStatus | WithdrawalStatus
	session?: OperationSession
}

export const createResumeQueue = ({
	from,
	to,
	account,
	persistedSessions,
	depositStatuses,
	withdrawalStatuses
}: {
	from: ChainRef
	to: ChainRef
	account: string
	persistedSessions: OperationSession[]
	depositStatuses: DepositStatus[]
	withdrawalStatuses: WithdrawalStatus[]
}): ResumeQueueItem[] => {
	const depositRoute = { from: "mina:testnet" as ChainRef, to: "zeko:testnet" as ChainRef }
	const withdrawalRoute = { from: "zeko:testnet" as ChainRef, to: "mina:testnet" as ChainRef }
	const byHash = new Map(
		persistedSessions
			.filter((session) => session.account === account && session.status === "running")
			.map((session) => [getSubmitHash(session), session])
			.filter((entry): entry is [string, OperationSession] => entry[0] !== undefined)
	)
	const deposits = sortByIndex(depositStatuses)
		.filter((status) => !status.finalised && !status.cancelled)
		.map(
			(status): ResumeQueueItem => ({
				direction: "deposit",
				from: depositRoute.from,
				to: depositRoute.to,
				status,
				session: byHash.get(status.hash)
			})
		)
	const withdrawals = sortByIndex(withdrawalStatuses)
		.filter((status) => !status.finalised)
		.map(
			(status): ResumeQueueItem => ({
				direction: "withdrawal",
				from: withdrawalRoute.from,
				to: withdrawalRoute.to,
				status,
				session: byHash.get(status.hash)
			})
		)
	return resolveRoute(from, to).direction === "withdrawal"
		? [...withdrawals, ...deposits]
		: [...deposits, ...withdrawals]
}

const normalizeSessionForResume = ({
	session,
	now
}: {
	session: OperationSession
	now: () => string
}): OperationSession =>
	session.status === "running"
		? { ...session, updatedAt: now(), lastError: undefined }
		: {
				...session,
				status: "running",
				phase: "submitted",
				updatedAt: now(),
				lastError: undefined
			}

const createResumedSession = ({
	item,
	account,
	now,
	logDir,
	generateId
}: {
	item: ResumeQueueItem
	account: string
	now: () => string
	logDir: string
	generateId: () => string
}): OperationSession => {
	if (item.session) return normalizeSessionForResume({ session: item.session, now })
	const id = generateId()
	const status = item.status
	return {
		id,
		status: "running",
		phase: "submitted",
		route: formatRoute(item.from, item.to),
		direction: item.direction,
		account,
		recipient: status.recipient,
		amount: status.amount,
		logPath: path.join(logDir, `${id}.jsonl`),
		createdAt: now(),
		updatedAt: now(),
		targetIndex: status.index,
		submittedTransactions: [{ action: "submit", hash: status.hash }]
	}
}

const renderResumeAllResult = (result: {
	success: boolean
	account: string
	operationsFound: number
	operationsResolved: number
	results: OperationSession[]
}) =>
	[
		`${result.success ? "Success" : "Failed"}: resumed ${result.operationsResolved}/${result.operationsFound} pending operation${result.operationsFound === 1 ? "" : "s"}`,
		`Account: ${result.account}`,
		...result.results.map(
			(session) =>
				`- ${session.id} | ${session.direction} | ${session.route} | ${session.status} | submit=${getSubmitHash(session) ?? "-"} | final=${session.finalTransaction?.hash ?? "-"} | log=${session.logPath}`
		)
	].join("\n")

const completedJson = (sessions: OperationSession[]) => ({
	count: sessions.length,
	operations: sessions.map(toBridgeJsonResult)
})

export const createOperationCommand = (
	deps: {
		createStore?: (input: { stateDir: string }) => Pick<SessionStore, "list" | "load" | "save">
		resolvePaths?: typeof resolveAppPaths
		createAdapter?: BridgeAdapterFactory
		readLog?: (path: string) => Promise<string>
		createLogger?: (input: { logPath: string }) => Pick<
			ReturnType<typeof createOperationLogger>,
			"write"
		>
		write?: (message: string) => void
		writeProgress?: (message: string) => void
		sleep?: (ms: number) => Promise<void>
		pollIntervalMs?: number
		retryDelayMs?: number
		generateId?: () => string
		now?: () => string
	} = {}
): CommandDef =>
	defineCommand({
		meta: { name: "operation", description: "Inspect or resume persisted bridge operations." },
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
				args: { json: { type: "boolean", default: false } },
				async run({ args }) {
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const sessions = (await store.list()).filter(
						(session) => session.status === "completed" || session.status === "cancelled"
					)
					;(deps.write ?? console.log)(
						readBoolean(args, "json")
							? JSON.stringify(completedJson(sessions), null, 2)
							: `Completed operations: ${sessions.length}${sessions.length ? `\n${sessions.map((session) => `- ${session.id} | ${session.status} | ${session.direction} | ${session.route} | submit=${getSubmitHash(session) ?? "-"} | final=${session.finalTransaction?.hash ?? "-"} | updated=${session.updatedAt}`).join("\n")}` : "\nNo completed or cancelled operations found."}`
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
					const id = readRequired(args, "id", "Missing required operation id")
					const now = deps.now ?? (() => new Date().toISOString())
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					const [from, to] = parseSessionRoute(session)
					;(deps.writeProgress ?? console.error)(
						renderOperationProgress({
							event: "refreshing-status",
							phase: session.phase,
							details: { operationId: session.id, route: session.route }
						})
					)
					const refreshed = await refreshSessionFromNetwork({
						session,
						adapter: await (deps.createAdapter ?? createDefaultBridgeAdapter)({
							from,
							to,
							verbose: readBoolean(args, "verbose")
						}),
						now
					})
					await store.save(refreshed)
					;(deps.write ?? console.log)(JSON.stringify(projectOperationStatus(refreshed), null, 2))
				}
			}),
			logs: defineCommand({
				meta: { name: "logs", description: "Print the log file for an operation." },
				args: { id: { type: "positional", required: true } },
				async run({ args }) {
					const id = readRequired(args, "id", "Missing required operation id")
					const store = (deps.createStore ?? createSessionStore)({
						stateDir: (deps.resolvePaths ?? resolveAppPaths)().stateDir
					})
					const session = await store.load(id)
					if (!session) throw new Error(`Operation ${id} not found`)
					;(deps.write ?? console.log)(
						await (deps.readLog ?? ((filePath) => readFile(filePath, "utf8")))(session.logPath)
					)
				}
			}),
			resume: defineCommand({
				meta: { name: "resume", description: "Resume a persisted operation." },
				args: {
					id: { type: "positional", required: true },
					pollIntervalMs: { type: "string", required: false, alias: ["poll-interval-ms"] },
					retryDelayMs: { type: "string", required: false, alias: ["retry-delay-ms"] },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const id = readRequired(args, "id", "Missing required operation id")
					const now = deps.now ?? (() => new Date().toISOString())
					const sleep = deps.sleep ?? sleepFor
					const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
					const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
					const loaded = await store.load(id)
					if (!loaded) throw new Error(`Operation ${id} not found`)
					const session = normalizeSessionForResume({ session: loaded, now })
					const [from, to] = parseSessionRoute(session)
					const logger = (deps.createLogger ?? createOperationLogger)({ logPath: session.logPath })
					const log = createProgressLog({
						writeProgress: deps.writeProgress ?? console.error,
						logger
					})
					const retryDelayMs =
						readAliasedNumber(args, "retryDelayMs", "retry-delay-ms", "--retry-delay-ms") ??
						deps.retryDelayMs
					const result = await runBridgeOperation(
						{
							id: session.id,
							from,
							to,
							amount: session.amount,
							account: session.account,
							recipient: session.recipient,
							timeoutSlots: session.timeoutSlots,
							session
						},
						{
							adapter: await createAdapterWithRetries({
								createAdapter: deps.createAdapter ?? createDefaultBridgeAdapter,
								from,
								to,
								verbose: readBoolean(args, "verbose"),
								log,
								sleep,
								retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
							}),
							sessionStore: store,
							log,
							sleep,
							pollIntervalMs:
								readAliasedNumber(
									args,
									"pollIntervalMs",
									"poll-interval-ms",
									"--poll-interval-ms"
								) ??
								deps.pollIntervalMs ??
								20_000,
							retryDelayMs,
							now,
							verbose: readBoolean(args, "verbose")
						}
					)
					;(deps.write ?? console.log)(
						readBoolean(args, "json")
							? JSON.stringify(toBridgeJsonResult(result), null, 2)
							: renderBridgeResult(result)
					)
				}
			}),
			"resume-all": defineCommand({
				meta: {
					name: "resume-all",
					description: "Discover and sequentially resume pending bridge operations for an account."
				},
				args: {
					from: { type: "string", default: "mina:testnet" },
					to: { type: "string", default: "zeko:testnet" },
					account: { type: "string", required: false },
					pollIntervalMs: { type: "string", required: false, alias: ["poll-interval-ms"] },
					retryDelayMs: { type: "string", required: false, alias: ["retry-delay-ms"] },
					json: { type: "boolean", default: false },
					verbose: { type: "boolean", default: false }
				},
				async run({ args }) {
					const from = parseChainRef(readString(args, "from") ?? "mina:testnet", "--from")
					const to = parseChainRef(readString(args, "to") ?? "zeko:testnet", "--to")
					const account = deriveAccount(from, readString(args, "account"))
					const now = deps.now ?? (() => new Date().toISOString())
					const sleep = deps.sleep ?? sleepFor
					const appPaths = (deps.resolvePaths ?? resolveAppPaths)()
					const store = (deps.createStore ?? createSessionStore)({ stateDir: appPaths.stateDir })
					const log = createProgressLog({ writeProgress: deps.writeProgress ?? console.error })
					const retryDelayMs =
						readAliasedNumber(args, "retryDelayMs", "retry-delay-ms", "--retry-delay-ms") ??
						deps.retryDelayMs
					const createAdapter = deps.createAdapter ?? createDefaultBridgeAdapter
					const depositAdapter = await createAdapterWithRetries({
						createAdapter,
						from: "mina:testnet",
						to: "zeko:testnet",
						verbose: readBoolean(args, "verbose"),
						log,
						sleep,
						retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
					})
					const withdrawalAdapter = await createAdapterWithRetries({
						createAdapter,
						from: "zeko:testnet",
						to: "mina:testnet",
						verbose: readBoolean(args, "verbose"),
						log,
						sleep,
						retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
					})
					const queue = createResumeQueue({
						from,
						to,
						account,
						persistedSessions: await store.list(),
						depositStatuses: await depositAdapter.getDepositStatuses(account),
						withdrawalStatuses: await withdrawalAdapter.getWithdrawalStatuses(account)
					})
					const results: OperationSession[] = []
					for (const item of queue) {
						const session = createResumedSession({
							item,
							account,
							now,
							logDir: appPaths.logDir,
							generateId: deps.generateId ?? randomUUID
						})
						const logger = (deps.createLogger ?? createOperationLogger)({
							logPath: session.logPath
						})
						const itemLog = createProgressLog({
							writeProgress: deps.writeProgress ?? console.error,
							logger
						})
						const result = await runBridgeOperation(
							{
								id: session.id,
								from: item.from,
								to: item.to,
								amount: session.amount,
								account,
								recipient: session.recipient,
								timeoutSlots: session.timeoutSlots,
								session
							},
							{
								adapter: await createAdapterWithRetries({
									createAdapter,
									from: item.from,
									to: item.to,
									verbose: readBoolean(args, "verbose"),
									log: itemLog,
									sleep,
									retryDelayMs: retryDelayMs ?? RETRY_SLEEP_MS
								}),
								sessionStore: store,
								log: itemLog,
								sleep,
								pollIntervalMs:
									readAliasedNumber(
										args,
										"pollIntervalMs",
										"poll-interval-ms",
										"--poll-interval-ms"
									) ??
									deps.pollIntervalMs ??
									20_000,
								retryDelayMs,
								now,
								verbose: readBoolean(args, "verbose")
							}
						)
						results.push(result)
						if (result.status === "failed") break
					}
					const operationsResolved = results.filter(
						(session) => session.status === "completed" || session.status === "cancelled"
					).length
					const result = {
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
						readBoolean(args, "json")
							? JSON.stringify(
									{
										success: result.success,
										account,
										operations_found: queue.length,
										operations_resolved: operationsResolved,
										operations: results.map((session) => ({
											...toBridgeJsonResult(session),
											resolved: session.status === "completed" || session.status === "cancelled"
										}))
									},
									null,
									2
								)
							: renderResumeAllResult(result)
					)
				}
			})
		}
	})
