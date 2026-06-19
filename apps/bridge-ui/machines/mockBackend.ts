import type { ActionState, OperationsWorker, SdkSignatureRequest } from "./operations.worker"
import type { BridgeNetwork } from "./networks"

export const BRIDGE_DEBUG_BACKEND_STORAGE_KEY = "bridgeDebugBackendState"

export const bridgeDebugBackendScenarios = [
	"happy-path",
	"delayed-deposit-finalization",
	"delayed-withdrawal-finalization",
	"already-finalized-withdrawal",
	"recovered-pending-operations",
	"cancellable-deposit",
	"cancelled-deposit",
	"fee-too-low-retry",
	"transient-worker-error",
	"terminal-worker-error",
	"repro-withdrawal-recovered-completed",
	"repro-withdrawal-already-finalised",
	"repro-withdrawal-blocked-loop"
] as const

export type BridgeDebugBackendScenario = (typeof bridgeDebugBackendScenarios)[number]
export type BridgeDebugForcedError = "fee-too-low" | "terminal" | "transient"
export type BridgeDebugOperationKind = "deposit" | "withdrawal"
type BridgeDebugWorkerMethod = keyof OperationsWorker
type WorkerMethodInput = Parameters<OperationsWorker[BridgeDebugWorkerMethod]>[0]

export type BridgeDebugWorkerCall = {
	id: number
	method: BridgeDebugWorkerMethod
	input: unknown
	output?: unknown
	error?: string
	createdAtMs: number
}

export type BridgeDebugSignatureRequest = {
	requestId: string
	action: Exclude<
		BridgeDebugWorkerMethod,
		| "canCancelDeposit"
		| "canFinalizeDeposit"
		| "canFinalizeWithdrawal"
		| "completeSdkSignature"
		| "findPendingOperations"
		| "rejectSdkSignature"
	>
	user: string
	amount?: string
	feeNanomina: number
	transaction: string
	completed: boolean
	hash?: string
	rejected: boolean
	rejectionMessage?: string
	signedTransaction?: unknown
	createdAtMs: number
	completedAtMs?: number
}

export type BridgeDebugSeededOperation = {
	kind: BridgeDebugOperationKind
	index: number
	id: string
	recipient?: string
	amount: string
	cancelled: boolean
	cancellable?: boolean
	timeoutSlot?: string
	finalised: boolean
	transactionHash: string
	timestampMs: number
}

export type BridgeDebugBackendState = {
	scenario: BridgeDebugBackendScenario
	currentSlot: number
	pendingAdvancements: number
	nextCallId: number
	nextRequestId: number
	nextHashId: number
	nextOperationIndex: number
	forcedError: BridgeDebugForcedError | null
	calls: BridgeDebugWorkerCall[]
	signatureRequests: BridgeDebugSignatureRequest[]
	seededOperations: BridgeDebugSeededOperation[]
}

type BridgeDebugBackendStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

type CreateBridgeDebugBackendStoreOptions = {
	storage?: BridgeDebugBackendStorage | null
}

type SeedRecoveredOperationInput = Partial<
	Pick<
		BridgeDebugSeededOperation,
		"amount" | "cancelled" | "cancellable" | "finalised" | "recipient" | "timeoutSlot"
	>
>

export type BridgeDebugBackendStore = {
	advancePendingStatus: () => void
	clearLogs: () => void
	exportSnapshot: () => string
	forceNextError: (error: BridgeDebugForcedError) => void
	getSnapshot: () => BridgeDebugBackendState
	recordCall: <T>(
		method: BridgeDebugWorkerMethod,
		input: unknown,
		run: () => Promise<T>
	) => Promise<T>
	reset: () => void
	seedRecoveredOperation: (
		kind: BridgeDebugOperationKind,
		input?: SeedRecoveredOperationInput
	) => BridgeDebugSeededOperation
	setScenario: (scenario: BridgeDebugBackendScenario) => void
	subscribe: (listener: (state: BridgeDebugBackendState) => void) => () => void
	toggleCancellableDeposit: (cancellable?: boolean) => void
	update: (recipe: (state: BridgeDebugBackendState) => BridgeDebugBackendState) => void
}

const isBridgeDebugBackendScenario = (value: unknown): value is BridgeDebugBackendScenario =>
	bridgeDebugBackendScenarios.includes(value as BridgeDebugBackendScenario)

const defaultState = (): BridgeDebugBackendState => ({
	scenario: "happy-path",
	currentSlot: 1,
	pendingAdvancements: 0,
	nextCallId: 1,
	nextRequestId: 1,
	nextHashId: 1,
	nextOperationIndex: 1,
	forcedError: null,
	calls: [],
	signatureRequests: [],
	seededOperations: []
})

const safeStorage = (): BridgeDebugBackendStorage | null => {
	try {
		return globalThis.localStorage ?? null
	} catch {
		return null
	}
}

const cloneState = (state: BridgeDebugBackendState): BridgeDebugBackendState =>
	JSON.parse(JSON.stringify(state)) as BridgeDebugBackendState

const safeClone = (value: unknown): unknown => {
	try {
		return JSON.parse(JSON.stringify(value)) as unknown
	} catch {
		return String(value)
	}
}

const readState = (storage: BridgeDebugBackendStorage | null): BridgeDebugBackendState => {
	try {
		const raw = storage?.getItem(BRIDGE_DEBUG_BACKEND_STORAGE_KEY)
		if (!raw) return defaultState()
		const parsed = JSON.parse(raw) as Partial<BridgeDebugBackendState>
		const fallback = defaultState()
		return {
			...fallback,
			...parsed,
			scenario: isBridgeDebugBackendScenario(parsed.scenario) ? parsed.scenario : fallback.scenario,
			forcedError: parsed.forcedError ?? null,
			calls: Array.isArray(parsed.calls) ? parsed.calls : [],
			signatureRequests: Array.isArray(parsed.signatureRequests) ? parsed.signatureRequests : [],
			seededOperations: Array.isArray(parsed.seededOperations) ? parsed.seededOperations : []
		}
	} catch {
		return defaultState()
	}
}

const persistState = (
	storage: BridgeDebugBackendStorage | null,
	state: BridgeDebugBackendState
) => {
	try {
		storage?.setItem(BRIDGE_DEBUG_BACKEND_STORAGE_KEY, JSON.stringify(state))
	} catch {
		// Debug state persistence is best-effort only.
	}
}

const debugErrorMessage = (error: BridgeDebugForcedError) =>
	({
		"fee-too-low": 'Transaction failed: "Fee is too low"',
		terminal: "Debug scenario: terminal backend error",
		transient: "Debug scenario: transient worker error"
	})[error]

const currentTimestampMs = () => Date.now()

const fakeHash = (id: number) => `5Jdebug${String(id).padStart(6, "0")}`
const withdrawalAlreadyFinalisedReason = "Withdrawal already finalised"
const blockedWithdrawalReason =
	"First Zeko->Mina withdrawal amount is too small: recipient debug recipient does not have an L1 helper account yet, so the first withdrawal must cover the Mina account creation fee. This withdrawal cannot proceed as submitted."

const createUnsignedTransaction = ({
	action,
	amount,
	feeNanomina,
	user
}: {
	action: BridgeDebugSignatureRequest["action"]
	amount?: string
	feeNanomina: number
	user: string
}) =>
	JSON.stringify({
		accountUpdates: [],
		feePayer: {
			authorization: "",
			body: {
				fee: String(feeNanomina),
				publicKey: user
			}
		},
		memo: "",
		debug: {
			action,
			amount
		}
	})

const actionStateFromSeed = ({
	destination,
	seed,
	source,
	user
}: {
	destination: BridgeNetwork
	seed: BridgeDebugSeededOperation
	source: BridgeNetwork
	user: string
}): ActionState => ({
	index: seed.index,
	id: seed.id,
	recipient: seed.recipient ?? user,
	amount: seed.amount,
	cancelled: seed.cancelled,
	cancellable: seed.cancellable,
	timeoutSlot: seed.timeoutSlot,
	finalised: seed.finalised,
	bridgeVersion: 2,
	transaction: {
		timestampMs: seed.timestampMs,
		hash: seed.transactionHash
	},
	source,
	destination
})

export const createBridgeDebugBackendStore = ({
	storage = safeStorage()
}: CreateBridgeDebugBackendStoreOptions = {}): BridgeDebugBackendStore => {
	let state = readState(storage)
	const listeners = new Set<(state: BridgeDebugBackendState) => void>()

	const commit = (next: BridgeDebugBackendState) => {
		state = cloneState(next)
		persistState(storage, state)
		for (const listener of listeners) listener(cloneState(state))
	}

	const update: BridgeDebugBackendStore["update"] = (recipe) => {
		commit(recipe(cloneState(state)))
	}

	const consumeForcedError = (method: BridgeDebugWorkerMethod): BridgeDebugForcedError | null => {
		const forcedError = state.forcedError
		const scenarioError =
			state.scenario === "fee-too-low-retry" && method === "completeSdkSignature"
				? "fee-too-low"
				: state.scenario === "transient-worker-error"
					? "transient"
					: state.scenario === "terminal-worker-error"
						? "terminal"
						: null
		const error = forcedError ?? scenarioError
		if (!error) return null
		if (error === "fee-too-low" && method !== "completeSdkSignature") return null
		update((current) => ({
			...current,
			scenario: current.scenario === "fee-too-low-retry" ? "happy-path" : current.scenario,
			forcedError: current.forcedError === null ? null : null
		}))
		return error
	}

	return {
		advancePendingStatus: () => {
			update((current) => ({
				...current,
				currentSlot: current.currentSlot + 1,
				pendingAdvancements: current.pendingAdvancements + 1
			}))
		},
		clearLogs: () => {
			update((current) => ({
				...current,
				calls: [],
				signatureRequests: []
			}))
		},
		exportSnapshot: () => JSON.stringify(state, null, 2),
		forceNextError: (error) => {
			update((current) => ({ ...current, forcedError: error }))
		},
		getSnapshot: () => cloneState(state),
		recordCall: async (method, input, run) => {
			const callId = state.nextCallId
			update((current) => ({
				...current,
				nextCallId: current.nextCallId + 1,
				calls: [
					...current.calls,
					{
						id: callId,
						method,
						input: safeClone(input),
						createdAtMs: currentTimestampMs()
					}
				]
			}))
			try {
				const forcedError = consumeForcedError(method)
				if (forcedError) throw new Error(debugErrorMessage(forcedError))
				const output = await run()
				update((current) => ({
					...current,
					calls: current.calls.map((call) =>
						call.id === callId ? { ...call, output: safeClone(output) } : call
					)
				}))
				return output
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				update((current) => ({
					...current,
					calls: current.calls.map((call) =>
						call.id === callId ? { ...call, error: message } : call
					)
				}))
				throw error
			}
		},
		reset: () => {
			try {
				storage?.removeItem(BRIDGE_DEBUG_BACKEND_STORAGE_KEY)
			} catch {
				// Debug state persistence is best-effort only.
			}
			commit(defaultState())
		},
		seedRecoveredOperation: (kind, input = {}) => {
			const snapshot = cloneState(state)
			const index = snapshot.nextOperationIndex
			const seed: BridgeDebugSeededOperation = {
				kind,
				index,
				id: `debug-${kind}-${index}`,
				amount: input.amount ?? "1",
				cancelled: input.cancelled ?? false,
				cancellable: input.cancellable,
				timeoutSlot: input.timeoutSlot,
				finalised: input.finalised ?? false,
				recipient: input.recipient,
				transactionHash: fakeHash(index),
				timestampMs: currentTimestampMs()
			}
			commit({
				...snapshot,
				nextOperationIndex: index + 1,
				seededOperations: [...snapshot.seededOperations, seed]
			})
			return seed
		},
		setScenario: (scenario) => {
			update((current) => ({
				...current,
				scenario,
				pendingAdvancements: 0,
				forcedError:
					scenario === "fee-too-low-retry"
						? "fee-too-low"
						: scenario === "transient-worker-error"
							? "transient"
							: scenario === "terminal-worker-error"
								? "terminal"
								: current.forcedError
			}))
		},
		subscribe: (listener) => {
			listeners.add(listener)
			listener(cloneState(state))
			return () => {
				listeners.delete(listener)
			}
		},
		toggleCancellableDeposit: (cancellable) => {
			update((current) => {
				const firstDeposit = current.seededOperations.find((seed) => seed.kind === "deposit")
				if (!firstDeposit) return current
				const nextCancellable = cancellable ?? firstDeposit.cancellable !== true
				return {
					...current,
					seededOperations: current.seededOperations.map((seed) =>
						seed.id === firstDeposit.id ? { ...seed, cancellable: nextCancellable } : seed
					)
				}
			})
		},
		update
	}
}

const defaultStore = createBridgeDebugBackendStore()

const createSignatureRequest = ({
	action,
	amount,
	feeNanomina,
	store,
	user
}: {
	action: BridgeDebugSignatureRequest["action"]
	amount?: string
	feeNanomina?: number
	store: BridgeDebugBackendStore
	user: string
}): SdkSignatureRequest => {
	const snapshot = store.getSnapshot()
	const requestId = `debug-request-${snapshot.nextRequestId}`
	const resolvedFee = feeNanomina ?? 100_000_000
	const transaction = createUnsignedTransaction({
		action,
		amount,
		feeNanomina: resolvedFee,
		user
	})

	store.update((current) => ({
		...current,
		nextRequestId: current.nextRequestId + 1,
		signatureRequests: [
			...current.signatureRequests,
			{
				requestId,
				action,
				user,
				amount,
				feeNanomina: resolvedFee,
				transaction,
				completed: false,
				rejected: false,
				createdAtMs: currentTimestampMs()
			}
		]
	}))

	return { requestId, transaction }
}

export const getBridgeDebugBackendStore = () => defaultStore

export const createMockBridgeOperationsWorker = ({
	store = defaultStore
}: {
	store?: BridgeDebugBackendStore
} = {}): OperationsWorker => {
	const request = (
		action: BridgeDebugSignatureRequest["action"],
		input: { user: string; amount?: string; feeNanomina?: number }
	) =>
		createSignatureRequest({
			action,
			amount: input.amount,
			feeNanomina: input.feeNanomina,
			store,
			user: input.user
		})

	return {
		findPendingOperations: (input) =>
			store.recordCall("findPendingOperations", input, async () => {
				const snapshot = store.getSnapshot()
				const seededOperations = (() => {
					if (snapshot.seededOperations.length > 0) return snapshot.seededOperations
					if (snapshot.scenario === "recovered-pending-operations") {
						return [
							store.seedRecoveredOperation("deposit", { amount: "1" }),
							store.seedRecoveredOperation("withdrawal", { amount: "1" })
						]
					}
					if (snapshot.scenario === "repro-withdrawal-recovered-completed") {
						return [
							store.seedRecoveredOperation("withdrawal", {
								amount: "1",
								finalised: true
							})
						]
					}
					return snapshot.seededOperations
				})()
				return {
					deposits: seededOperations
						.filter((seed) => seed.kind === "deposit")
						.map((seed) =>
							actionStateFromSeed({
								seed,
								user: input.account,
								source: input.l1,
								destination: input.l2
							})
						),
					withdrawals: seededOperations
						.filter((seed) => seed.kind === "withdrawal")
						.map((seed) =>
							actionStateFromSeed({
								seed,
								user: input.account,
								source: input.l2,
								destination: input.l1
							})
						),
					currentSlot: String(store.getSnapshot().currentSlot)
				}
			}),
		submitDeposit: (input) =>
			store.recordCall("submitDeposit", input, async () =>
				request("submitDeposit", {
					user: input.user,
					amount: input.amount,
					feeNanomina: input.feeNanomina
				})
			),
		canFinalizeDeposit: (input) =>
			store.recordCall("canFinalizeDeposit", input, async () => {
				const snapshot = store.getSnapshot()
				if (
					snapshot.scenario === "delayed-deposit-finalization" &&
					snapshot.pendingAdvancements === 0
				) {
					return { available: false, reason: "Debug scenario: deposit pending" }
				}
				if (snapshot.scenario === "cancellable-deposit") {
					return { available: false, reason: "Debug scenario: deposit is cancellable" }
				}
				if (snapshot.scenario === "cancelled-deposit") {
					return { available: false, reason: "Debug scenario: deposit was cancelled" }
				}
				return { available: true, reason: null }
			}),
		finalizeDeposit: (input) =>
			store.recordCall("finalizeDeposit", input, async () =>
				request("finalizeDeposit", {
					user: input.user,
					feeNanomina: input.feeNanomina
				})
			),
		canCancelDeposit: (input) =>
			store.recordCall("canCancelDeposit", input, async () => {
				const snapshot = store.getSnapshot()
				return snapshot.scenario === "cancellable-deposit" ||
					snapshot.seededOperations.some(
						(seed) => seed.kind === "deposit" && seed.cancellable === true
					)
					? { available: true, reason: null }
					: { available: false, reason: "Debug scenario: deposit is not cancellable" }
			}),
		cancelDeposit: (input) =>
			store.recordCall("cancelDeposit", input, async () =>
				request("cancelDeposit", {
					user: input.user,
					feeNanomina: input.feeNanomina
				})
			),
		submitWithdrawal: (input) =>
			store.recordCall("submitWithdrawal", input, async () =>
				request("submitWithdrawal", {
					user: input.user,
					amount: input.amount,
					feeNanomina: input.feeNanomina
				})
			),
		canFinalizeWithdrawal: (input) =>
			store.recordCall("canFinalizeWithdrawal", input, async () => {
				const snapshot = store.getSnapshot()
				if (snapshot.scenario === "already-finalized-withdrawal") {
					return { available: false, reason: null, status: "alreadyFinalised" }
				}
				if (snapshot.scenario === "repro-withdrawal-already-finalised") {
					return {
						available: false,
						reason: withdrawalAlreadyFinalisedReason,
						status: "alreadyFinalised",
						index: 1
					}
				}
				if (snapshot.scenario === "repro-withdrawal-blocked-loop") {
					return {
						available: false,
						reason: blockedWithdrawalReason,
						status: "blocked"
					}
				}
				if (
					snapshot.scenario === "delayed-withdrawal-finalization" &&
					snapshot.pendingAdvancements === 0
				) {
					return {
						available: false,
						reason: "Debug scenario: withdrawal pending",
						status: "waiting"
					}
				}
				return { available: true, reason: null, status: "available" }
			}),
		finalizeWithdrawal: (input) =>
			store.recordCall("finalizeWithdrawal", input, async () =>
				request("finalizeWithdrawal", {
					user: input.user,
					feeNanomina: input.feeNanomina
				})
			),
		completeSdkSignature: (input) =>
			store.recordCall("completeSdkSignature", input, async () => {
				const snapshot = store.getSnapshot()
				const signatureRequest = snapshot.signatureRequests.find(
					(request) => request.requestId === input.requestId
				)
				if (!signatureRequest) {
					throw new Error(`No debug SDK signature request found for ${input.requestId}`)
				}
				const hash = fakeHash(snapshot.nextHashId)
				store.update((current) => ({
					...current,
					nextHashId: current.nextHashId + 1,
					signatureRequests: current.signatureRequests.map((request) =>
						request.requestId === input.requestId
							? {
									...request,
									completed: true,
									completedAtMs: currentTimestampMs(),
									hash,
									signedTransaction: safeClone(input.signedTransaction)
								}
							: request
					)
				}))
				return hash
			}),
		rejectSdkSignature: (input) =>
			store.recordCall("rejectSdkSignature", input, async () => {
				store.update((current) => ({
					...current,
					signatureRequests: current.signatureRequests.map((request) =>
						request.requestId === input.requestId
							? {
									...request,
									rejected: true,
									rejectionMessage: input.message ?? "Transaction signing failed"
								}
							: request
					)
				}))
			})
	}
}
