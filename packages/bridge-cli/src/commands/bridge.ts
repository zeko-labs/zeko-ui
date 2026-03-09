import { randomUUID } from "node:crypto"
import path from "node:path"
import { defineCommand, type CommandDef } from "citty"
import { PrivateKey } from "o1js"
import type { BridgeAdapter } from "../core/adapter"
import { createOperationLogger } from "../core/logger"
import { resolveAppPaths } from "../core/paths"
import { renderBridgeResult, renderOperationProgress, toBridgeJsonResult } from "../core/reporter"
import type { ChainRef } from "../core/routes"
import { resolveRoute } from "../core/routes"
import { resolveSignerSecrets } from "../core/signer"
import { createSessionStore, type SessionStore } from "../core/session-store"
import type { OperationPhase, OperationSession, OperationStatus } from "../core/types"

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

const updateSession = ({
	session,
	phase,
	status,
	now,
	patch = {}
}: {
	session: OperationSession
	phase: OperationPhase
	status?: OperationStatus
	now: () => string
	patch?: Partial<OperationSession>
}): OperationSession => ({
	...session,
	...patch,
	phase,
	status: status ?? session.status,
	updatedAt: now()
})

const latestByIndex = <T extends { index: number }>(items: T[]): T | null =>
	items.length === 0 ? null : [...items].sort((left, right) => right.index - left.index)[0] ?? null

const deriveAccount = (from: ChainRef, explicit?: string): string => {
	if (explicit) return explicit

	const secrets = resolveSignerSecrets()
	const secret = from.startsWith("zeko:") ? secrets.zeko : secrets.mina
	return PrivateKey.fromBase58(secret).toPublicKey().toBase58()
}

const routeString = (from: ChainRef, to: ChainRef) => `${from}->${to}` as const

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
			route: routeString(input.from, input.to),
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
			session = updateSession({
				session,
				phase: "submitted",
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
				session = updateSession({
					session,
					phase: "completed",
					status: "completed",
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
				session = updateSession({ session, phase: "cancelled", status: "cancelled", now })
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
				session = updateSession({
					session,
					phase: "finalizing",
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
				session = updateSession({
					session,
					phase: "canceling",
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

			session = updateSession({ session, phase: "waiting", now })
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
		session = updateSession({
			session,
			phase: "submitted",
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
			session = updateSession({
				session,
				phase: "completed",
				status: "completed",
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
			session = updateSession({
				session,
				phase: "finalizing",
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

		session = updateSession({ session, phase: "waiting", now })
		await deps.sessionStore.save(session)
		await deps.sleep(deps.pollIntervalMs)
	}
}

export const createBridgeCommand = (): CommandDef<any> =>
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
			const from = args.from as ChainRef
			const to = args.to as ChainRef
			const route = resolveRoute(from, to)
			const recipient =
				(args.recipient as string | undefined) ?? (args.account as string | undefined)
			const appPaths = resolveAppPaths()
			const store = createSessionStore({ stateDir: appPaths.stateDir })
			const id = randomUUID()
			const logPath = path.join(appPaths.logDir, `${id}.jsonl`)
			const logger = createOperationLogger({ logPath })
			const { createBridgeAdapter } = await import("../core/adapter")
			const session = await runBridgeOperation(
				{
					id,
					from,
					to,
					amount: args.amount as string,
					account: deriveAccount(from, recipient),
					recipient,
					timeoutSlots:
						typeof args.timeoutSlots === "string" ? Number(args.timeoutSlots) : undefined,
					waitForCompletion: args.wait as boolean
				},
				{
					adapter: createBridgeAdapter({ route }),
					sessionStore: {
						async save(operation) {
							await store.save({ ...operation, logPath })
						}
					},
					log: async ({ event, phase, details }) => {
						console.error(renderOperationProgress({ event, phase, details }))
						await logger.write(event, { phase, ...details })
					},
					sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
					pollIntervalMs: 20_000
				}
			)

			const finalSession = { ...session, logPath }
			console.log(
				args.json
					? JSON.stringify(toBridgeJsonResult(finalSession), null, 2)
					: renderBridgeResult(finalSession)
			)
		}
	})
