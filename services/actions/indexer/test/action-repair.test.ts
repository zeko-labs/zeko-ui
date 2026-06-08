import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { ActionIndexIntegrity } from "../src/db"

const { logger } = vi.hoisted(() => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}))

vi.mock("../src/helper", () => ({
	logger
}))

const sparseIntegrity: ActionIndexIntegrity = {
	label: "outer",
	count: 2,
	minIndex: 0,
	maxIndex: 2,
	expectedCount: 3,
	isDense: false,
	firstMissingIndex: 1,
	linkedGapCount: 1,
	linkedRepairIndex: 1,
	linkedGapSample: [
		{
			afterState: "a2",
			beforeState: "a0",
			index: 2,
			expectedIndex: 1
		}
	]
}

describe("action repair", () => {
	let repairActionIndexDrift: Awaited<
		typeof import("../src/action-repair")
	>["repairActionIndexDrift"]
	let checkAndRepairActionIndexDrift: Awaited<
		typeof import("../src/action-repair")
	>["checkAndRepairActionIndexDrift"]
	let shouldCheckActionIndexIntegrity: Awaited<
		typeof import("../src/action-repair")
	>["shouldCheckActionIndexIntegrity"]

	beforeAll(async () => {
		const actionRepair = await import("../src/action-repair")
		repairActionIndexDrift = actionRepair.repairActionIndexDrift
		checkAndRepairActionIndexDrift = actionRepair.checkAndRepairActionIndexDrift
		shouldCheckActionIndexIntegrity = actionRepair.shouldCheckActionIndexIntegrity
	})

	it("checks integrity on first run and then throttles steady-state scans", () => {
		expect(shouldCheckActionIndexIntegrity({ lastCheckedAt: null, now: 1_000 })).toBe(true)
		expect(shouldCheckActionIndexIntegrity({ lastCheckedAt: 1_000, now: 1_000 + 60_000 })).toBe(
			false
		)
		expect(shouldCheckActionIndexIntegrity({ lastCheckedAt: 1_000, now: 1_000 + 300_000 })).toBe(
			true
		)
	})

	it("does not check or advance the throttle inside the steady-state window", async () => {
		const db = {} as PostgresJsDatabase
		const getIntegrity = vi.fn()

		await expect(
			checkAndRepairActionIndexDrift(db, {
				lastCheckedAt: 1_000,
				now: 2_000,
				getIntegrity,
				getRepairAnchor: vi.fn(),
				fetchActions: vi.fn(),
				build: vi.fn(),
				deleteFromIndex: vi.fn(),
				insert: vi.fn()
			})
		).resolves.toEqual({
			checked: false,
			lastCheckedAt: 1_000,
			repairResult: {
				repaired: false,
				repairIndex: null,
				lastFetchedBlock: null
			}
		})

		expect(getIntegrity).not.toHaveBeenCalled()
	})

	it("advances the throttle after a successful dense no-op check", async () => {
		const db = {} as PostgresJsDatabase
		const denseIntegrity: ActionIndexIntegrity = {
			...sparseIntegrity,
			count: 3,
			expectedCount: 3,
			isDense: true,
			firstMissingIndex: null,
			linkedGapCount: 0,
			linkedRepairIndex: null,
			linkedGapSample: []
		}
		const fetchActions = vi.fn()

		await expect(
			checkAndRepairActionIndexDrift(db, {
				lastCheckedAt: null,
				now: 5_000,
				getIntegrity: async () => denseIntegrity,
				getRepairAnchor: vi.fn(),
				fetchActions,
				build: vi.fn(),
				deleteFromIndex: vi.fn(),
				insert: vi.fn()
			})
		).resolves.toEqual({
			checked: true,
			lastCheckedAt: 5_000,
			repairResult: {
				repaired: false,
				repairIndex: null,
				lastFetchedBlock: null
			}
		})

		expect(fetchActions).not.toHaveBeenCalled()
	})

	it("propagates repair failures before returning an advanced throttle", async () => {
		const archiveError = new Error("archive unavailable")
		const db = {
			transaction: vi.fn()
		} as unknown as PostgresJsDatabase
		const deleteFromIndex = vi.fn()
		const insert = vi.fn()

		await expect(
			checkAndRepairActionIndexDrift(db, {
				lastCheckedAt: null,
				now: 5_000,
				getIntegrity: async () => sparseIntegrity,
				getRepairAnchor: async () => ({
					repairIndex: 1,
					previousAfterState: "a0",
					startBlock: 100
				}),
				fetchActions: async () => {
					throw archiveError
				},
				build: (items: { beforeState: string | null }[]) => ({ items }),
				deleteFromIndex,
				insert
			})
		).rejects.toThrow("archive unavailable")

		expect(db.transaction).not.toHaveBeenCalled()
		expect(deleteFromIndex).not.toHaveBeenCalled()
		expect(insert).not.toHaveBeenCalled()
	})

	it("does not mutate indexed tables when archive fetch fails", async () => {
		const archiveError = new Error("archive unavailable")
		const db = {
			transaction: vi.fn()
		} as unknown as PostgresJsDatabase
		const deleteFromIndex = vi.fn()
		const insert = vi.fn()

		await expect(
			repairActionIndexDrift(db, {
				integrity: sparseIntegrity,
				getRepairAnchor: async () => ({
					repairIndex: 1,
					previousAfterState: "a0",
					startBlock: 100
				}),
				fetchActions: async () => {
					throw archiveError
				},
				build: (items: { beforeState: string | null }[]) => ({ items }),
				deleteFromIndex,
				insert
			})
		).rejects.toThrow("archive unavailable")

		expect(db.transaction).not.toHaveBeenCalled()
		expect(deleteFromIndex).not.toHaveBeenCalled()
		expect(insert).not.toHaveBeenCalled()
	})

	it("repairs the broken tail transactionally after archive data is fetched", async () => {
		const tx = {} as PostgresJsDatabase
		const db = {
			transaction: vi.fn(async (run: (tx: PostgresJsDatabase) => Promise<void>) => run(tx))
		} as unknown as PostgresJsDatabase
		const deleteFromIndex = vi.fn(async () => {})
		const insert = vi.fn(async () => {})

		const result = await repairActionIndexDrift(db, {
			integrity: sparseIntegrity,
			getRepairAnchor: async () => ({
				repairIndex: 1,
				previousAfterState: "a0",
				startBlock: 100
			}),
			fetchActions: async () => ({
				lastFetchedBlock: 120,
				data: [{ beforeState: "older" }, { beforeState: "a0" }, { beforeState: "a1" }]
			}),
			build: (items: { beforeState: string | null }[], currIndex: number) => ({
				items,
				currIndex
			}),
			deleteFromIndex,
			insert
		})

		expect(result).toEqual({
			repaired: true,
			repairIndex: 1,
			lastFetchedBlock: 120
		})
		expect(db.transaction).toHaveBeenCalledOnce()
		expect(deleteFromIndex).toHaveBeenCalledWith(tx, 1)
		expect(insert).toHaveBeenCalledWith(tx, {
			currIndex: 1,
			items: [{ beforeState: "a0" }, { beforeState: "a1" }]
		})
	})
})
