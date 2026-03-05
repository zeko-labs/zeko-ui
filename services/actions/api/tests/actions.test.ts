// @vitest-environment node
// @vitest-pool forks
import { drizzle } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { commitActions, innerActions, outerActions, witnessActions } from "../drizzle/schema"
import type { Database } from "../src/db"
import { GENESIS_BEFORE_STATE } from "../src/helpers/utils"
import { queryInnerWitnessesFromAuxes } from "../src/schema/inner"
import {
	queryCommitAsePastSlot,
	queryOuterActions,
	queryOuterWitnessesFromAuxes
} from "../src/schema/outer"

const clearDb = async (db: ReturnType<Database>["drizzle"]) => {
	await db.delete(witnessActions)
	await db.delete(commitActions)
	await db.delete(outerActions)
	await db.delete(innerActions)
}

const testDatabaseUrl =
	process.env.ACTIONS_API_TEST_DATABASE_URL ??
	"postgresql://postgres:postgres@localhost:5434/actions"

describe("Actions API - schema queries", () => {
	let client: Sql
	let db: ReturnType<Database>["drizzle"]
	let testDb: ReturnType<Database>

	beforeAll(async () => {
		client = postgres(testDatabaseUrl, { max: 1, fetch_types: false })
		db = drizzle({ client, logger: false })
		testDb = { drizzle: db, client } as ReturnType<Database>
		await clearDb(db)

		await db.insert(outerActions).values([
			{
				afterState: "a1",
				beforeState: null,
				index: 1,
				kind: "commit",
				blockHeight: 100,
				timestamp: new Date(),
				txnHash: "tx1",
				fields: ["field1"],
				slotRangeLower: BigInt(1),
				slotRangeUpper: BigInt(5)
			},
			{
				afterState: "a2",
				beforeState: "a1",
				index: 2,
				kind: "witness",
				blockHeight: 101,
				timestamp: new Date(),
				txnHash: "tx2",
				fields: ["field2"],
				slotRangeLower: BigInt(6),
				slotRangeUpper: BigInt(10)
			},
			{
				afterState: "a3",
				beforeState: "a2",
				index: 3,
				kind: "commit",
				blockHeight: 102,
				timestamp: new Date(),
				txnHash: "tx3",
				fields: ["field3"],
				slotRangeLower: BigInt(11),
				slotRangeUpper: BigInt(15)
			}
		])

		await db.insert(commitActions).values([
			{
				afterState: "a1",
				ledger: "ledger1",
				innerActionState: "inner1",
				innerActionStateLength: 1,
				synchronizedOuterActionState: "sync1",
				synchronizedOuterActionStateLength: 1
			},
			{
				afterState: "a3",
				ledger: "ledger3",
				innerActionState: "inner3",
				innerActionStateLength: 1,
				synchronizedOuterActionState: "sync3",
				synchronizedOuterActionStateLength: 1
			}
		])

		await db.insert(witnessActions).values([{ afterState: "a2", aux: "aux-1" }])

		await db.insert(innerActions).values([
			{
				afterState: "i1",
				beforeState: null,
				index: 1,
				blockHeight: 200,
				timestamp: new Date(),
				txnHash: "itx1",
				fields: ["ifield1"],
				aux: "iaux-1"
			}
		])
	})

	afterAll(async () => {
		await clearDb(db)
		await client.end()
	})

	describe("queryOuterWitnessesFromAuxes", () => {
		it("returns the witness corresponding to aux", async () => {
			const result = await queryOuterWitnessesFromAuxes(testDb, ["aux-1"])

			expect(result).toHaveLength(1)
			expect(result[0].afterState).toBe("a2")
			expect(result[0].kind).toBe("WITNESS")
			expect(result[0].aux).toBe("aux-1")
		})
	})

	describe("queryInnerWitnessesFromAuxes", () => {
		it("returns inner witness row by aux", async () => {
			const result = await queryInnerWitnessesFromAuxes(testDb, ["iaux-1"])

			expect(result).toHaveLength(1)
			expect(result[0].afterState).toBe("i1")
			expect(result[0].aux).toBe("iaux-1")
		})
	})

	describe("queryOuterActions", () => {
		it("returns actions after a given beforeState", async () => {
			const result = await queryOuterActions(testDb, { beforeState: "a1" })

			expect(result.length).toBeGreaterThanOrEqual(2)
			expect(result[0].afterState).toBe("a2")
			expect(result[0].kind).toBe("WITNESS")
			expect(result[1].afterState).toBe("a3")
			expect(result[1].kind).toBe("COMMIT")
		})

		it("handles the special genesis before-state indicator", async () => {
			const result = await queryOuterActions(testDb, { beforeState: GENESIS_BEFORE_STATE })
			expect(result[0].afterState).toBe("a1")
			expect(result[0].kind).toBe("COMMIT")
		})

		it("supports afterState parameter to limit results", async () => {
			const result = await queryOuterActions(testDb, { beforeState: "a1", afterState: "a2" })
			expect(result.length).toBe(1)
			expect(result[0].afterState).toBe("a2")
			expect(result[0].kind).toBe("WITNESS")
		})

		it("returns empty array when beforeState does not exist", async () => {
			const result = await queryOuterActions(testDb, { beforeState: "nonexistent_state_123" })
			expect(result).toHaveLength(0)
		})
	})

	describe("queryCommitAsePastSlot", () => {
		it("returns last commit with slotRangeUpper < slot and ASE since that commit", async () => {
			const result = await queryCommitAsePastSlot(testDb, 12)

			expect(result.commit).not.toBeNull()
			expect(result.commit?.afterState).toBe("a1")
			expect(result.commit?.kind).toBe("COMMIT")
			expect(result.ase.length).toBeGreaterThanOrEqual(2)
			expect(result.ase[0].afterState).toBe("a2")
			expect(result.ase[1].afterState).toBe("a3")
		})

		it("returns commit=null and empty ase when no commit slotRangeUpper < slot", async () => {
			const result = await queryCommitAsePastSlot(testDb, 4)
			expect(result.commit).toBeNull()
			expect(result.ase).toHaveLength(0)
		})

		it("returns latest commit and empty ase when no actions follow", async () => {
			const result = await queryCommitAsePastSlot(testDb, 20)
			expect(result.commit).not.toBeNull()
			expect(result.commit?.afterState).toBe("a3")
			expect(result.ase).toHaveLength(0)
		})
	})
})
