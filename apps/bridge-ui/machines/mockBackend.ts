import type { ActionState, OperationsWorker, SdkSignatureRequest } from "./operations.worker"
import type { BridgeNetwork } from "./networks"

export const BRIDGE_DEBUG_BACKEND_STORAGE_KEY = "bridgeDebugBackendState"

export const bridgeDebugBackendScenarios = [
	"happy-path",
	"repro-first-withdrawal-too-small",
	"repro-claim-failure",
	"repro-unindexed-withdrawal-completion"
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
	finaliseAfterFindPendingCalls?: number
}

export type BridgeDebugBackendState = {
	scenario: BridgeDebugBackendScenario
	currentSlot: number
	pendingAdvancements: number
	nextCallId: number
	nextRequestId: number
	nextHashId: number
	nextOperationIndex: number
	findPendingOperationsCount: number
	forcedError: BridgeDebugForcedError | null
	calls: BridgeDebugWorkerCall[]
	signatureRequests: BridgeDebugSignatureRequest[]
	seededOperations: BridgeDebugSeededOperation[]
}

type BridgeDebugBackendStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

type CreateBridgeDebugBackendStoreOptions = {
	storage?: BridgeDebugBackendStorage | null
}

type BridgeDebugBackendStorageState = {
	scenario?: unknown
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
	findPendingOperationsCount: 0,
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
		const parsed = JSON.parse(raw) as BridgeDebugBackendStorageState
		const fallback = defaultState()
		return {
			...fallback,
			scenario: isBridgeDebugBackendScenario(parsed.scenario) ? parsed.scenario : fallback.scenario
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
		storage?.setItem(
			BRIDGE_DEBUG_BACKEND_STORAGE_KEY,
			JSON.stringify({ scenario: state.scenario } satisfies BridgeDebugBackendStorageState)
		)
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

const firstWithdrawalTooSmallMessage = (recipient: string) =>
	`First Zeko->Mina withdrawal amount is too small: recipient ${recipient} requires 0.2 MINA bridge fees, 1 MINA helper account creation, and 1 MINA recipient account creation on Mina, so the transfer amount must be at least 2.2 MINA.`

const firstWithdrawalTooSmallMinimumMina = 2.2

const amountIsBelowFirstWithdrawalMinimum = (amount: string): boolean => {
	const amountMina = Number(amount)
	return Number.isFinite(amountMina) && amountMina < firstWithdrawalTooSmallMinimumMina
}

const currentTimestampMs = () => Date.now()

const fakeHash = (id: number) => `5Jdebug${String(id).padStart(6, "0")}`

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

const updateSeededOperationsAfterSignature = ({
	hash,
	request,
	state
}: {
	hash: string
	request: BridgeDebugSignatureRequest
	state: BridgeDebugBackendState
}): BridgeDebugBackendState => {
	const timestampMs = currentTimestampMs()
	const addSubmittedOperation = (
		kind: BridgeDebugOperationKind,
		amount: string
	): BridgeDebugBackendState => {
		const index = state.nextOperationIndex
		const seed: BridgeDebugSeededOperation = {
			kind,
			index,
			id: `debug-${kind}-${index}`,
			amount,
			cancelled: false,
			finalised: false,
			recipient: request.user,
			transactionHash: hash,
			timestampMs
		}
		return {
			...state,
			nextOperationIndex: index + 1,
			seededOperations: [...state.seededOperations, seed]
		}
	}

	const updateFirstPendingOperation = (
		kind: BridgeDebugOperationKind,
		recipe: (seed: BridgeDebugSeededOperation) => BridgeDebugSeededOperation
	): BridgeDebugBackendState => {
		const index = state.seededOperations.findIndex(
			(seed) => seed.kind === kind && seed.cancelled === false && seed.finalised === false
		)
		if (index === -1) return state
		return {
			...state,
			seededOperations: state.seededOperations.map((seed, seedIndex) =>
				seedIndex === index ? recipe(seed) : seed
			)
		}
	}

	if (request.action === "submitDeposit") {
		return addSubmittedOperation("deposit", request.amount ?? "1")
	}
	if (request.action === "submitWithdrawal") {
		return addSubmittedOperation("withdrawal", request.amount ?? "1")
	}
	if (request.action === "finalizeDeposit") {
		return updateFirstPendingOperation("deposit", (seed) => ({ ...seed, finalised: true }))
	}
	if (request.action === "finalizeWithdrawal") {
		return updateFirstPendingOperation("withdrawal", (seed) =>
			state.scenario === "repro-unindexed-withdrawal-completion"
				? {
						...seed,
						finaliseAfterFindPendingCalls: state.findPendingOperationsCount + 2
					}
				: { ...seed, finalised: true }
		)
	}
	if (request.action === "cancelDeposit") {
		return updateFirstPendingOperation("deposit", (seed) => ({ ...seed, cancelled: true }))
	}
	return state
}

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
		const error = state.forcedError
		if (!error) return null
		if (error === "fee-too-low" && method !== "completeSdkSignature") return null
		update((current) => ({
			...current,
			forcedError: null
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
			const hashId = snapshot.nextHashId
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
				transactionHash: fakeHash(hashId),
				timestampMs: currentTimestampMs()
			}
			commit({
				...snapshot,
				nextHashId: hashId + 1,
				nextOperationIndex: index + 1,
				seededOperations: [...snapshot.seededOperations, seed]
			})
			return seed
		},
		setScenario: (scenario) => {
			update((current) => ({
				...current,
				scenario,
				pendingAdvancements: 0
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
				store.update((current) => {
					const findPendingOperationsCount = current.findPendingOperationsCount + 1
					return {
						...current,
						findPendingOperationsCount,
						seededOperations: current.seededOperations.map((seed) =>
							seed.finaliseAfterFindPendingCalls !== undefined &&
							seed.finaliseAfterFindPendingCalls <= findPendingOperationsCount
								? {
										...seed,
										finalised: true,
										finaliseAfterFindPendingCalls: undefined
									}
								: seed
						)
					}
				})
				const snapshot = store.getSnapshot()
				return {
					deposits: snapshot.seededOperations
						.filter((seed) => seed.kind === "deposit")
						.map((seed) =>
							actionStateFromSeed({
								seed,
								user: input.account,
								source: input.l1,
								destination: input.l2
							})
						),
					withdrawals: snapshot.seededOperations
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
				const firstPendingDeposit = snapshot.seededOperations.find(
					(seed) => seed.kind === "deposit" && seed.cancelled === false && seed.finalised === false
				)
				return firstPendingDeposit
					? { available: true, reason: null, index: firstPendingDeposit.index }
					: { available: true, reason: null }
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
				return snapshot.seededOperations.some(
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
				const firstPendingWithdrawal = snapshot.seededOperations.find(
					(seed) =>
						seed.kind === "withdrawal" && seed.cancelled === false && seed.finalised === false
				)
				if (
					snapshot.scenario === "repro-first-withdrawal-too-small" &&
					firstPendingWithdrawal &&
					amountIsBelowFirstWithdrawalMinimum(firstPendingWithdrawal.amount)
				) {
					throw new Error(firstWithdrawalTooSmallMessage(input.user))
				}
				return firstPendingWithdrawal
					? {
							available: true,
							reason: null,
							status: "available",
							index: firstPendingWithdrawal.index
						}
					: { available: true, reason: null, status: "available" }
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
				if (
					snapshot.scenario === "repro-claim-failure" &&
					(signatureRequest.action === "finalizeDeposit" ||
						signatureRequest.action === "finalizeWithdrawal")
				) {
					throw new Error("Debug scenario: claim failed")
				}
				const hash = fakeHash(snapshot.nextHashId)
				store.update((current) => ({
					...updateSeededOperationsAfterSignature({
						hash,
						request: signatureRequest,
						state: current
					}),
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
