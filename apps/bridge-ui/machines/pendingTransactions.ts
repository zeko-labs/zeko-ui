import type { BridgeNetwork } from "./networks"

export const PENDING_BRIDGE_TRANSACTIONS_STORAGE_KEY = "zeko.bridge.pendingTransactions.v1"
export const PENDING_BRIDGE_TRANSACTIONS_CHANGED_EVENT = "zeko:bridge:pending-transactions-changed"
export const PENDING_BRIDGE_TRANSACTION_SCHEMA_VERSION = 1
export const PENDING_BRIDGE_TRANSACTION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export type PendingBridgeTransactionDirection = "deposit" | "withdrawal"
export type PendingBridgeTransactionStatus = "awaiting-inclusion" | "awaiting-claim" | "finalizing"

export type PendingBridgeTransaction = {
	schemaVersion: typeof PENDING_BRIDGE_TRANSACTION_SCHEMA_VERSION
	walletAddress: string
	l1: BridgeNetwork
	l2: BridgeNetwork
	source: BridgeNetwork
	destination: BridgeNetwork
	direction: PendingBridgeTransactionDirection
	amount: string
	transactionHash: string
	submittedAtMs: number
	operationId?: string
	timeoutSlots?: number
	status: PendingBridgeTransactionStatus
}

type PendingBridgeTransactionStore = {
	version: typeof PENDING_BRIDGE_TRANSACTION_SCHEMA_VERSION
	records: PendingBridgeTransaction[]
}

export type PendingBridgeTransactionScope = {
	walletAddress: string
	l1: BridgeNetwork
	l2: BridgeNetwork
	direction?: PendingBridgeTransactionDirection
}

export type PendingBridgeTransactionReconciliation = PendingBridgeTransactionScope & {
	transactionHashes: readonly string[]
}

type PersistenceOptions = {
	storage?: StorageLike
	nowMs?: number
}

const getStorage = (storage?: StorageLike): StorageLike | null => {
	if (storage) return storage
	try {
		return globalThis.localStorage
	} catch {
		return null
	}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null

const isString = (value: unknown): value is string => typeof value === "string"

const isDirection = (value: unknown): value is PendingBridgeTransactionDirection =>
	value === "deposit" || value === "withdrawal"

const isStatus = (value: unknown): value is PendingBridgeTransactionStatus =>
	value === "awaiting-inclusion" || value === "awaiting-claim" || value === "finalizing"

const isPendingBridgeTransaction = (value: unknown): value is PendingBridgeTransaction => {
	if (!isRecord(value)) return false
	return (
		value.schemaVersion === PENDING_BRIDGE_TRANSACTION_SCHEMA_VERSION &&
		isString(value.walletAddress) &&
		isString(value.l1) &&
		isString(value.l2) &&
		isString(value.source) &&
		isString(value.destination) &&
		isDirection(value.direction) &&
		isString(value.amount) &&
		isString(value.transactionHash) &&
		typeof value.submittedAtMs === "number" &&
		Number.isFinite(value.submittedAtMs) &&
		(value.operationId === undefined || isString(value.operationId)) &&
		(value.timeoutSlots === undefined || typeof value.timeoutSlots === "number") &&
		isStatus(value.status)
	)
}

const isFreshRecord = (record: PendingBridgeTransaction, nowMs: number) =>
	nowMs - record.submittedAtMs <= PENDING_BRIDGE_TRANSACTION_RETENTION_MS

const scopedTransactionKey = (record: PendingBridgeTransaction) =>
	[record.walletAddress, record.l1, record.l2, record.direction, record.transactionHash].join("|")

const normalizeRecords = (records: readonly PendingBridgeTransaction[], nowMs: number) => [
	...records
		.filter((record) => isFreshRecord(record, nowMs))
		.reduce((byKey, record) => {
			const key = scopedTransactionKey(record)
			const current = byKey.get(key)
			if (!current || current.submittedAtMs <= record.submittedAtMs) byKey.set(key, record)
			return byKey
		}, new Map<string, PendingBridgeTransaction>())
		.values()
]

const readStore = ({ storage, nowMs = Date.now() }: PersistenceOptions = {}) => {
	const target = getStorage(storage)
	if (!target) return { target, records: [] as PendingBridgeTransaction[] }

	try {
		const stored = target.getItem(PENDING_BRIDGE_TRANSACTIONS_STORAGE_KEY)
		if (!stored) return { target, records: [] as PendingBridgeTransaction[] }
		const parsed = JSON.parse(stored) as unknown
		if (!isRecord(parsed) || parsed.version !== PENDING_BRIDGE_TRANSACTION_SCHEMA_VERSION)
			return { target, records: [] as PendingBridgeTransaction[] }
		const rawRecords = Array.isArray(parsed.records) ? parsed.records : []
		return {
			target,
			records: normalizeRecords(rawRecords.filter(isPendingBridgeTransaction), nowMs)
		}
	} catch {
		return { target, records: [] as PendingBridgeTransaction[] }
	}
}

const writeStore = (storage: StorageLike, records: readonly PendingBridgeTransaction[]) => {
	const store: PendingBridgeTransactionStore = {
		version: PENDING_BRIDGE_TRANSACTION_SCHEMA_VERSION,
		records: [...records]
	}
	storage.setItem(PENDING_BRIDGE_TRANSACTIONS_STORAGE_KEY, JSON.stringify(store))
}

const notifyPendingBridgeTransactionsChanged = () => {
	if (typeof window === "undefined") return
	window.dispatchEvent(new Event(PENDING_BRIDGE_TRANSACTIONS_CHANGED_EVENT))
}

const matchesScope = (scope: PendingBridgeTransactionScope) => (record: PendingBridgeTransaction) =>
	record.walletAddress === scope.walletAddress &&
	record.l1 === scope.l1 &&
	record.l2 === scope.l2 &&
	(scope.direction === undefined || record.direction === scope.direction)

export const loadPendingBridgeTransactions = (
	scope: PendingBridgeTransactionScope,
	options: PersistenceOptions = {}
): PendingBridgeTransaction[] => {
	const { target, records } = readStore(options)
	if (target) {
		try {
			writeStore(target, records)
		} catch {
			// Best-effort stale cleanup only.
		}
	}
	return records.filter(matchesScope(scope))
}

export const hasPendingBridgeTransactions = (
	scope: PendingBridgeTransactionScope,
	options: PersistenceOptions = {}
): boolean => readStore(options).records.some(matchesScope(scope))

export const savePendingBridgeTransaction = (
	record: PendingBridgeTransaction,
	options: PersistenceOptions = {}
): void => {
	const { target, records } = readStore(options)
	if (!target) return

	try {
		writeStore(target, normalizeRecords([...records, record], options.nowMs ?? Date.now()))
		notifyPendingBridgeTransactionsChanged()
	} catch {
		return
	}
}

export const reconcilePendingBridgeTransactions = (
	input: PendingBridgeTransactionReconciliation,
	options: PersistenceOptions = {}
): void => {
	const { target, records } = readStore(options)
	if (!target) return

	const matchedHashes = new Set(input.transactionHashes)
	const shouldRemove = (record: PendingBridgeTransaction) =>
		matchesScope(input)(record) && matchedHashes.has(record.transactionHash)

	const updatedRecords = records.filter((record) => !shouldRemove(record))
	if (updatedRecords.length === records.length) return

	try {
		writeStore(target, updatedRecords)
		notifyPendingBridgeTransactionsChanged()
	} catch {
		return
	}
}
