import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { innerActions, outerActions } from "../../api/drizzle/schema"

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

import {
	createTestDatabase,
	getCanonicalProgressSnapshot,
	getLastFinalInnerAction,
	getLastFinalOuterAction,
	promoteInnerCanonicalActions,
	promoteOuterCanonicalActions
} from "../src/db"

describe("canonical progress", () => {
	let db: ReturnType<typeof createTestDatabase>["db"]
	let clean: ReturnType<typeof createTestDatabase>["clean"]

	beforeAll(async () => {
		const { db: testDb, clean: cleanDb } = createTestDatabase()
		await cleanDb()
		db = testDb
		clean = cleanDb
	})

	afterEach(async () => {
		await clean()
	})

	it("promotes existing outer actions to canonical and advances progress", async () => {
		await db.insert(outerActions).values([
			{
				afterState: "outer-final",
				kind: "witness",
				beforeState: null,
				index: 0,
				blockHeight: 100,
				timestamp: new Date("2026-03-10T00:00:00.000Z"),
				txnHash: "txn-0",
				fields: ["0", "1", "2", "3", "4"],
				slotRangeLower: 0n,
				slotRangeUpper: 1n,
				markedAsCanonicalAt: new Date("2026-03-10T00:00:00.000Z")
			},
			{
				afterState: "outer-pending",
				kind: "witness",
				beforeState: "outer-final",
				index: 1,
				blockHeight: 101,
				timestamp: new Date("2026-03-10T00:01:00.000Z"),
				txnHash: "txn-1",
				fields: ["0", "1", "2", "3", "4"],
				slotRangeLower: 1n,
				slotRangeUpper: 2n,
				markedAsCanonicalAt: null
			}
		])

		const beforeProgress = await getCanonicalProgressSnapshot(db)
		expect(beforeProgress.outer.lastFinalIndex).toBe(0)
		expect(beforeProgress.outer.nonCanonicalTailCount).toBe(1)

		const promotedCount = await promoteOuterCanonicalActions(db, [
			"outer-pending",
			"outer-pending",
			"missing-outer"
		])

		expect(promotedCount).toBe(1)

		const lastFinal = await getLastFinalOuterAction(db)
		expect(lastFinal?.afterState).toBe("outer-pending")
		expect(lastFinal?.index).toBe(1)

		const afterProgress = await getCanonicalProgressSnapshot(db)
		expect(afterProgress.outer.lastFinalIndex).toBe(1)
		expect(afterProgress.outer.lastFinalBlockHeight).toBe(101)
		expect(afterProgress.outer.nonCanonicalTailCount).toBe(0)
	})

	it("promotes outer canonical actions without exceeding the Postgres parameter limit", async () => {
		await db.insert(outerActions).values({
			afterState: "outer-pending",
			kind: "witness",
			beforeState: null,
			index: 0,
			blockHeight: 100,
			timestamp: new Date("2026-03-10T00:00:00.000Z"),
			txnHash: "txn-0",
			fields: ["0", "1", "2", "3", "4"],
			slotRangeLower: 0n,
			slotRangeUpper: 1n,
			markedAsCanonicalAt: null
		})

		const afterStates = [
			"outer-pending",
			...Array.from({ length: 65_533 }, (_, index) => `missing-outer-${index}`)
		]

		const promotedCount = await promoteOuterCanonicalActions(db, afterStates)

		expect(promotedCount).toBe(1)
		expect((await getLastFinalOuterAction(db))?.afterState).toBe("outer-pending")
	})

	it("promotes existing inner actions to canonical and advances progress", async () => {
		await db.insert(innerActions).values([
			{
				afterState: "inner-final",
				beforeState: null,
				index: 0,
				blockHeight: 200,
				timestamp: new Date("2026-03-10T00:00:00.000Z"),
				txnHash: "inner-txn-0",
				fields: ["9", "10"],
				markedAsCanonicalAt: new Date("2026-03-10T00:00:00.000Z"),
				aux: "aux-0"
			},
			{
				afterState: "inner-pending",
				beforeState: "inner-final",
				index: 1,
				blockHeight: 201,
				timestamp: new Date("2026-03-10T00:01:00.000Z"),
				txnHash: "inner-txn-1",
				fields: ["11", "12"],
				markedAsCanonicalAt: null,
				aux: "aux-1"
			}
		])

		const beforeProgress = await getCanonicalProgressSnapshot(db)
		expect(beforeProgress.inner.lastFinalIndex).toBe(0)
		expect(beforeProgress.inner.nonCanonicalTailCount).toBe(1)

		const promotedCount = await promoteInnerCanonicalActions(db, ["inner-pending"])
		expect(promotedCount).toBe(1)

		const lastFinal = await getLastFinalInnerAction(db)
		expect(lastFinal?.afterState).toBe("inner-pending")
		expect(lastFinal?.index).toBe(1)

		const afterProgress = await getCanonicalProgressSnapshot(db)
		expect(afterProgress.inner.lastFinalIndex).toBe(1)
		expect(afterProgress.inner.lastFinalBlockHeight).toBe(201)
		expect(afterProgress.inner.nonCanonicalTailCount).toBe(0)
	})
})
