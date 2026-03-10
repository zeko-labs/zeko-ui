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
import type { OperationPhase, OperationSession } from "../core/types"

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
	waitForCompletion?: boolean
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
}

type BridgeCommandArgs = {
	from: { type: "string"; default: string }
	to: { type: "string"; default: string }
	amount: { type: "string"; required: true }
	account: { type: "string"; required: false }
	recipient: { type: "string"; required: false }
	timeoutSlots: { type: "string"; required: false }
	wait: { type: "boolean"; default: true }
	json: { type: "boolean"; default: false }
}

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
	event:
		| "MARK_SUBMITTED"
		| "MARK_WAITING"
		| "MARK_FINALIZING"
		| "MARK_CANCELLING"
		| "MARK_COMPLETED"
		| "MARK_CANCELLED"
		| "MARK_FAILED"
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

const latestByIndex = <T extends { index: number }>(items: T[]): T | null =>
	items.length === 0 ? null : [...items].sort((left, right) => right.index - left.index)[0] ?? null

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

const parseBoolean = (value: unknown, fallback: boolean): boolean =>
	typeof value === "boolean" ? value : fallback

const parseBridgeCommandArgs = (args: Record<string, unknown>) => ({
	from: parseChainRef(args.from, "--from"),
	to: parseChainRef(args.to, "--to"),
	amount: String(args.amount),
	account: parseOptionalString(args.account),
	recipient: parseOptionalString(args.recipient),
	timeoutSlots: parseOptionalNumber(args.timeoutSlots),
	wait: parseBoolean(args.wait, true),
	json: parseBoolean(args.json, false)
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
	const operationState = createOperationStateController({
		phase: session.phase,
		status: session.status
	})

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
				controller: operationState,
				session,
				event: "MARK_SUBMITTED",
				now,
				patch: {
					submittedTransactions: [{ action: "submit", hash: submitResult.hash }]
				}
			})
			await persistSession({
				session,
				sessionStore: deps.sessionStore,
				log: deps.log,
				event: "submitted",
				details: { hash: submitResult.hash }
			})

			if (input.waitForCompletion === false) {
				return session
			}
		}

		for (;;) {
			const latest = latestByIndex(
				await requireAdapterMethod(deps.adapter, "getDepositStatuses")(session.account)
			)
			if (latest?.finalised) {
				session = transitionSession({
					controller: operationState,
					session,
					event: "MARK_COMPLETED",
					now,
					patch: {
						finalTransaction: {
							action: "finalize",
							hash: latest.hash,
							explorerUrl: ""
						}
					}
				})
				await persistSession({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					event: "completed",
					details: { hash: latest.hash }
				})
				return session
			}

			if (latest?.cancelled) {
				session = transitionSession({
					controller: operationState,
					session,
					event: "MARK_CANCELLED",
					now
				})
				await persistSession({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					event: "cancelled"
				})
				return session
			}

			const canFinalize = deps.adapter.canFinalizeDeposit
				? await deps.adapter.canFinalizeDeposit(session.account)
				: Boolean(latest?.confirmed && !latest.finalised)
			if (canFinalize && !session.submittedTransactions.some((tx) => tx.action === "finalize")) {
				const finalizeResult = await requireAdapterMethod(
					deps.adapter,
					"finalizeDeposit"
				)({
					account: session.account,
					wait: true
				})
				session = transitionSession({
					controller: operationState,
					session,
					event: "MARK_FINALIZING",
					now,
					patch: {
						submittedTransactions: [
							...session.submittedTransactions,
							{ action: "finalize", hash: finalizeResult.hash }
						],
						finalTransaction: {
							action: "finalize",
							hash: finalizeResult.hash,
							explorerUrl: finalizeResult.explorerUrl
						}
					}
				})
				await persistSession({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					event: "finalized",
					details: { hash: finalizeResult.hash }
				})
				continue
			}

			const canCancel = deps.adapter.canCancelDeposit
				? await deps.adapter.canCancelDeposit(session.account)
				: false
			if (canCancel && !session.submittedTransactions.some((tx) => tx.action === "cancel")) {
				const cancelResult = await requireAdapterMethod(
					deps.adapter,
					"cancelDeposit"
				)({
					account: session.account,
					wait: true
				})
				session = transitionSession({
					controller: operationState,
					session,
					event: "MARK_CANCELLING",
					now,
					patch: {
						submittedTransactions: [
							...session.submittedTransactions,
							{ action: "cancel", hash: cancelResult.hash }
						],
						finalTransaction: {
							action: "cancel",
							hash: cancelResult.hash,
							explorerUrl: cancelResult.explorerUrl
						}
					}
				})
				await persistSession({
					session,
					sessionStore: deps.sessionStore,
					log: deps.log,
					event: "cancel-submitted",
					details: { hash: cancelResult.hash }
				})
			}

			session = transitionSession({
				controller: operationState,
				session,
				event: "MARK_WAITING",
				now
			})
			await deps.sessionStore.save(session)
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
			controller: operationState,
			session,
			event: "MARK_SUBMITTED",
			now,
			patch: {
				submittedTransactions: [{ action: "submit", hash: submitResult.hash }]
			}
		})
		await persistSession({
			session,
			sessionStore: deps.sessionStore,
			log: deps.log,
			event: "submitted",
			details: { hash: submitResult.hash }
		})

		if (input.waitForCompletion === false) {
			return session
		}
	}

	for (;;) {
		const latest = latestByIndex(
			await requireAdapterMethod(deps.adapter, "getWithdrawalStatuses")(session.account)
		)
		if (latest?.finalised) {
			session = transitionSession({
				controller: operationState,
				session,
				event: "MARK_COMPLETED",
				now,
				patch: {
					finalTransaction: {
						action: "finalize",
						hash: latest.hash,
						explorerUrl: ""
					}
				}
			})
			await persistSession({
				session,
				sessionStore: deps.sessionStore,
				log: deps.log,
				event: "completed",
				details: { hash: latest.hash }
			})
			return session
		}

		const canFinalize = deps.adapter.canFinalizeWithdrawal
			? await deps.adapter.canFinalizeWithdrawal(session.account)
			: Boolean(latest?.committed && !latest.finalised)
		if (canFinalize && !session.submittedTransactions.some((tx) => tx.action === "finalize")) {
			const finalizeResult = await requireAdapterMethod(
				deps.adapter,
				"finalizeWithdrawal"
			)({
				account: session.account,
				wait: true
			})
			session = transitionSession({
				controller: operationState,
				session,
				event: "MARK_FINALIZING",
				now,
				patch: {
					submittedTransactions: [
						...session.submittedTransactions,
						{ action: "finalize", hash: finalizeResult.hash }
					],
					finalTransaction: {
						action: "finalize",
						hash: finalizeResult.hash,
						explorerUrl: finalizeResult.explorerUrl
					}
				}
			})
			await persistSession({
				session,
				sessionStore: deps.sessionStore,
				log: deps.log,
				event: "finalized",
				details: { hash: finalizeResult.hash }
			})
			continue
		}

		session = transitionSession({
			controller: operationState,
			session,
			event: "MARK_WAITING",
			now
		})
		await deps.sessionStore.save(session)
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
			wait: { type: "boolean", default: true },
			json: { type: "boolean", default: false }
		},
		async run({ args }) {
			const commandArgs = parseBridgeCommandArgs(args)
			const from = commandArgs.from
			const to = commandArgs.to
			const recipient = commandArgs.recipient ?? commandArgs.account
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
					account: deriveAccount(from, recipient),
					recipient,
					timeoutSlots: commandArgs.timeoutSlots,
					waitForCompletion: commandArgs.wait
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
