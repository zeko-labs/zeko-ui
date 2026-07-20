import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { BridgeNetwork } from "../../machines/networks"
import {
	loadPendingBridgeTransactions,
	PENDING_BRIDGE_TRANSACTIONS_CHANGED_EVENT,
	reconcilePendingBridgeTransactions,
	savePendingBridgeTransaction,
	type PendingBridgeTransaction
} from "../../machines/pendingTransactions"

const mina = "mina:devnet" as BridgeNetwork
const zeko = "zeko:testnet" as BridgeNetwork
const mainnet = "mina:mainnet" as BridgeNetwork

type MemoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const createMemoryStorage = (): MemoryStorage => {
	const values = new Map<string, string>()
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key)
	}
}

let storage: MemoryStorage

const record = (overrides: Partial<PendingBridgeTransaction> = {}): PendingBridgeTransaction => ({
	schemaVersion: 1,
	walletAddress: "B62qwallet-1",
	l1: mina,
	l2: zeko,
	source: mina,
	destination: zeko,
	direction: "deposit",
	amount: "12.5",
	transactionHash: "5JpendingHash1",
	submittedAtMs: Date.parse("2026-07-01T00:00:00Z"),
	status: "awaiting-inclusion",
	...overrides
})

beforeEach(() => {
	storage = createMemoryStorage()
	vi.useFakeTimers()
	vi.setSystemTime(new Date("2026-07-02T00:00:00Z"))
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe("pending bridge transaction persistence", () => {
	it("saves and loads records scoped by wallet and bridge network pair", () => {
		savePendingBridgeTransaction(record(), { storage })
		savePendingBridgeTransaction(
			record({ walletAddress: "B62qwallet-2", transactionHash: "5JotherWallet" }),
			{ storage }
		)
		savePendingBridgeTransaction(record({ l1: mainnet, transactionHash: "5JotherNetwork" }), {
			storage
		})

		expect(
			loadPendingBridgeTransactions(
				{
					walletAddress: "B62qwallet-1",
					l1: mina,
					l2: zeko
				},
				{ storage }
			)
		).toEqual([record()])
	})

	it("does not write to storage when loading records", () => {
		const baseStorage = createMemoryStorage()
		const setItem = vi.fn(baseStorage.setItem)
		const storageWithSpy = { ...baseStorage, setItem }
		savePendingBridgeTransaction(record(), { storage: storageWithSpy })
		setItem.mockClear()

		expect(
			loadPendingBridgeTransactions(
				{ walletAddress: "B62qwallet-1", l1: mina, l2: zeko },
				{ storage: storageWithSpy }
			)
		).toEqual([record()])
		expect(setItem).not.toHaveBeenCalled()
	})

	it("normalizes duplicate records by scoped transaction hash", () => {
		const firstSubmittedAtMs = Date.parse("2026-07-01T00:00:00Z")
		const secondSubmittedAtMs = Date.parse("2026-07-01T00:00:01Z")
		savePendingBridgeTransaction(record({ submittedAtMs: firstSubmittedAtMs }), { storage })
		savePendingBridgeTransaction(record({ submittedAtMs: secondSubmittedAtMs }), { storage })

		expect(
			loadPendingBridgeTransactions(
				{ walletAddress: "B62qwallet-1", l1: mina, l2: zeko },
				{ storage }
			)
		).toEqual([record({ submittedAtMs: secondSubmittedAtMs })])
	})

	it("treats malformed storage as empty", () => {
		storage.setItem("zeko.bridge.pendingTransactions.v1", "not-json")

		expect(
			loadPendingBridgeTransactions(
				{ walletAddress: "B62qwallet-1", l1: mina, l2: zeko },
				{ storage }
			)
		).toEqual([])
	})

	it("drops records older than seven days", () => {
		savePendingBridgeTransaction(record({ submittedAtMs: Date.parse("2026-07-01T00:00:00Z") }), {
			storage
		})

		expect(
			loadPendingBridgeTransactions(
				{ walletAddress: "B62qwallet-1", l1: mina, l2: zeko },
				{ storage, nowMs: Date.parse("2026-07-09T00:00:00Z") }
			)
		).toEqual([])
	})

	it("reconciles matched pending records by transaction hash", () => {
		savePendingBridgeTransaction(record(), { storage })
		savePendingBridgeTransaction(record({ transactionHash: "5Junmatched" }), { storage })

		reconcilePendingBridgeTransactions(
			{
				walletAddress: "B62qwallet-1",
				l1: mina,
				l2: zeko,
				transactionHashes: ["5JpendingHash1"]
			},
			{ storage }
		)

		expect(
			loadPendingBridgeTransactions(
				{ walletAddress: "B62qwallet-1", l1: mina, l2: zeko },
				{ storage }
			)
		).toEqual([record({ transactionHash: "5Junmatched" })])
	})

	it("skips reconciliation writes when no records match", () => {
		const baseStorage = createMemoryStorage()
		const setItem = vi.fn(baseStorage.setItem)
		const storageWithSpy = { ...baseStorage, setItem }
		savePendingBridgeTransaction(record(), { storage: storageWithSpy })
		setItem.mockClear()

		reconcilePendingBridgeTransactions(
			{
				walletAddress: "B62qwallet-1",
				l1: mina,
				l2: zeko,
				transactionHashes: ["5JmissingHash"]
			},
			{ storage: storageWithSpy }
		)

		expect(setItem).not.toHaveBeenCalled()
	})

	it("notifies the current tab when pending storage changes", () => {
		const dispatchEvent = vi.fn(() => true)
		if (typeof window === "undefined") {
			vi.stubGlobal("window", { dispatchEvent })
		} else {
			vi.spyOn(window, "dispatchEvent").mockImplementation(dispatchEvent)
		}

		savePendingBridgeTransaction(record(), { storage })

		expect(dispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ type: PENDING_BRIDGE_TRANSACTIONS_CHANGED_EVENT })
		)
	})

	it("does not throw when storage writes fail", () => {
		const failingStorage: MemoryStorage = {
			getItem: () => null,
			setItem: () => {
				throw new Error("quota exceeded")
			},
			removeItem: () => undefined
		}

		expect(() => savePendingBridgeTransaction(record(), { storage: failingStorage })).not.toThrow()
	})
})
