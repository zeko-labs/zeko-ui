import { beforeAll, describe, expect, it, vi } from "vitest"
import { outerActions } from "../../api/drizzle/schema"

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

describe("action index integrity", () => {
	let dbModule: Awaited<typeof import("../src/db")>

	beforeAll(async () => {
		vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/actions")
		vi.stubEnv("AUTH_TOKEN", "test")
		vi.stubEnv("L1_ARCHIVE_URL", "https://l1.example/graphql")
		vi.stubEnv("L2_ARCHIVE_URL", "https://l2.example/graphql")
		vi.stubEnv("OUTER_PK", "outer-pk")
		vi.stubEnv("INNER_PK", "inner-pk")

		dbModule = await import("../src/db")
	})

	it("detects sparse numeric action indexes", () => {
		const integrity = dbModule.analyzeActionIndexIntegrity({
			label: "outer",
			rows: [
				{ afterState: "a0", beforeState: null, index: 0 },
				{ afterState: "a2", beforeState: "a0", index: 2 }
			]
		})

		expect(integrity.count).toBe(2)
		expect(integrity.expectedCount).toBe(3)
		expect(integrity.isDense).toBe(false)
		expect(integrity.firstMissingIndex).toBe(1)
	})

	it("detects leading holes in zero-based action indexes", () => {
		const integrity = dbModule.analyzeActionIndexIntegrity({
			label: "outer",
			rows: [
				{ afterState: "a1", beforeState: null, index: 1 },
				{ afterState: "a2", beforeState: "a1", index: 2 }
			]
		})

		expect(integrity.count).toBe(2)
		expect(integrity.expectedCount).toBe(3)
		expect(integrity.isDense).toBe(false)
		expect(integrity.firstMissingIndex).toBe(0)
		expect(dbModule.getActionIndexRepairIndex(integrity)).toBe(0)
	})

	it("detects linked state rows with non-adjacent numeric indexes", () => {
		const integrity = dbModule.analyzeActionIndexIntegrity({
			label: "outer",
			rows: [
				{ afterState: "a0", beforeState: null, index: 0 },
				{ afterState: "a4", beforeState: "a0", index: 4 }
			]
		})

		expect(integrity.linkedGapCount).toBe(1)
		expect(integrity.linkedGapSample).toEqual([
			{
				afterState: "a4",
				beforeState: "a0",
				index: 4,
				expectedIndex: 1
			}
		])
		expect(integrity.linkedRepairIndex).toBe(1)
	})

	it("plans repair from the earliest broken action index", () => {
		const integrity = dbModule.analyzeActionIndexIntegrity({
			label: "outer",
			rows: [
				{ afterState: "a0", beforeState: null, index: 0 },
				{ afterState: "a4", beforeState: "a0", index: 4 },
				{ afterState: "a5", beforeState: "a4", index: 5 }
			]
		})

		expect(dbModule.getActionIndexRepairIndex(integrity)).toBe(1)
	})

	it("plans repair from linked gaps outside the diagnostic sample", () => {
		const rows = Array.from({ length: 102 }, (_, index) => ({
			afterState: `a${index}`,
			beforeState: index === 0 ? null : `a${index - 1}`,
			index
		}))
		const sampledGapIndexes = Array.from({ length: 10 }, (_, offset) => 50 + offset)
		const rowsWithGaps = rows.map((row) => {
			if (sampledGapIndexes.includes(row.index)) {
				return { ...row, beforeState: "a100" }
			}
			if (row.index === 80) {
				return { ...row, beforeState: "a1" }
			}
			return row
		})

		const integrity = dbModule.analyzeActionIndexIntegrity({
			label: "outer",
			rows: rowsWithGaps
		})

		expect(integrity.linkedGapCount).toBe(11)
		expect(integrity.linkedGapSample).toHaveLength(10)
		expect(integrity.linkedGapSample.some((gap) => gap.index === 80)).toBe(false)
		expect(integrity.linkedRepairIndex).toBe(2)
		expect(dbModule.getActionIndexRepairIndex(integrity)).toBe(2)
	})

	it("propagates insert conflicts instead of silently ignoring them", async () => {
		const insertError = new Error("duplicate key value violates unique constraint")
		const onConflictDoNothing = vi.fn(async () => undefined)
		const values = vi.fn(() => Object.assign(Promise.reject(insertError), { onConflictDoNothing }))
		const db = {
			insert: vi.fn(() => ({ values }))
		}

		await expect(
			dbModule.batchInsert({
				db: db as never,
				table: outerActions,
				values: [
					{
						afterState: "a0",
						beforeState: null,
						index: 1,
						kind: "witness",
						blockHeight: 101,
						timestamp: new Date("2026-06-08T00:00:00.000Z"),
						txnHash: "txn-a0-1",
						fields: ["1", "2", "3"],
						slotRangeLower: 1n,
						slotRangeUpper: 2n
					}
				]
			})
		).rejects.toThrow()

		expect(values).toHaveBeenCalledOnce()
		expect(onConflictDoNothing).not.toHaveBeenCalled()
	})
})
