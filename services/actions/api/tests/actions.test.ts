import { drizzle } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { actions, commitActions, witnessActions } from "../drizzle/schema"
import type { Database } from "../src/db"
import { checkDatabaseConnectionString } from "../src/helpers/utils"
import {
	queryActions,
	queryCommitAsePastWithdrawalDelay,
	queryWitnessesFromAuxes
} from "../src/schema/actions"

const clearDb = async (db: ReturnType<Database>["drizzle"]) => {
	await db.delete(witnessActions)
	await db.delete(commitActions)
	await db.delete(actions)
	console.log("✓ Test data cleaned up")
}

describe("Actions API - schema queries", () => {
	let client: Sql
	let db: ReturnType<Database>["drizzle"]
	let testDb: ReturnType<Database>

	beforeAll(async () => {
		client = postgres(checkDatabaseConnectionString(), { max: 1, fetch_types: false })
		db = drizzle(client, { logger: false })
		testDb = { drizzle: db, client } as ReturnType<Database>
		await clearDb(db)

		// Insert a small chain of actions for testing
		// action1: first action (beforeState = null) - COMMIT
		// action2: witness (aux = 'aux-1') after action1
		// action3: commit after action2

		await db.insert(actions).values([
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

		// Insert commit for action1 and action3
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

		// Insert witness for action2
		await db.insert(witnessActions).values([{ afterState: "a2", aux: "aux-1" }])
	})

	afterAll(async () => {
		await clearDb(db)
		await client.end()
		console.log("✓ Test data cleaned up")
	})

	describe("queryWitnessesFromAuxes", () => {
		it("returns the witness corresponding to aux", async () => {
			const result = await queryWitnessesFromAuxes(testDb, ["aux-1"])

			expect(result).toHaveLength(1)
			expect(result[0].afterState).toBe("a2")
			expect(result[0].kind).toBe("WITNESS")
			expect(result[0].aux).toBe("aux-1")
		})
	})

	describe("queryActions", () => {
		it("returns actions after a given beforeState", async () => {
			const result = await queryActions(testDb, { beforeState: "a1" })

			expect(result.length).toBeGreaterThanOrEqual(2)
			// Should start with a2
			expect(result[0].afterState).toBe("a2")
			expect(result[0].kind).toBe("WITNESS")

			// Next should be a3 and be a commit
			expect(result[1].afterState).toBe("a3")
			expect(result[1].kind).toBe("COMMIT")
		})

		it("handles the special first-action input (null before state) correctly", async () => {
			// The queryActions function checks a specific number to indicate the first action (null before state)
			const FIRST_ACTION_INDICATOR =
				"2965377540200775924504968637505084669999360240500907972788072774778139588064"

			const result = await queryActions(testDb, { beforeState: FIRST_ACTION_INDICATOR })

			// When querying from the first action, it should include a1 (which is a commit)
			expect(result[0].afterState).toBe("a1")
			expect(result[0].kind).toBe("COMMIT")
		})

		it("supports afterState parameter to limit results", async () => {
			// After state a2 should limit results to a2 only when beforeState=a1
			const result = await queryActions(testDb, { beforeState: "a1", afterState: "a2" })

			expect(result.length).toBe(1)
			expect(result[0].afterState).toBe("a2")
			expect(result[0].kind).toBe("WITNESS")
		})

		it("returns empty array when beforeState does not exist", async () => {
			const result = await queryActions(testDb, { beforeState: "nonexistent_state_123" })

			expect(result).toHaveLength(0)
		})
	})

	describe("queryCommitAsePastWithdrawalDelay", () => {
		it("returns last commit with slotRangeUpper < slot and ASE since that commit", async () => {
			// Given slot 12, commit a1 has slotRangeUpper 5 < 12, commit a3 has slotRangeUpper 15 which is not < 12
			const result = await queryCommitAsePastWithdrawalDelay(testDb, 12)

			// Commit should be a1
			expect(result.commit).not.toBeNull()
			expect(result.commit?.afterState).toBe("a1")
			expect(result.commit?.kind).toBe("COMMIT")

			// ASE (actions since commit index) should include action a2 and a3
			expect(result.ase.length).toBeGreaterThanOrEqual(2)
			expect(result.ase[0].afterState).toBe("a2")
			expect(result.ase[1].afterState).toBe("a3")
		})

		it("returns commit=null and empty ase when no commit slotRangeUpper < slot", async () => {
			// Given slot 4, there is no commit with slotRangeUpper < 4
			const result = await queryCommitAsePastWithdrawalDelay(testDb, 4)

			expect(result.commit).toBeNull()
			expect(result.ase).toHaveLength(0)
		})

		it("returns last commit a3 and empty ase when slot > all commits and no actions after commit", async () => {
			// Given slot 20, commit a3 has slotRangeUpper 15 < 20 and there are no actions after index 3
			const result = await queryCommitAsePastWithdrawalDelay(testDb, 20)

			expect(result.commit).not.toBeNull()
			expect(result.commit?.afterState).toBe("a3")
			expect(result.ase).toHaveLength(0)
		})
	})
})
