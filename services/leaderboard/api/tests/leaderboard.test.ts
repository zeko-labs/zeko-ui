import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/postgres-js"
import { seed } from "drizzle-seed"
import postgres, { type Sql } from "postgres"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { leaderboard } from "../drizzle/schema"
import type { Database } from "../src/db"
import { checkDatabaseConnectionString } from "../src/helpers/utils"
import { queryLeaderboard } from "../src/schema/leaderboard"

const TEST_ROW_COUNT = 10_000

describe("queryLeaderboard", () => {
	let client: Sql
	let db: ReturnType<Database>["drizzle"]
	let testDb: ReturnType<Database>

	beforeAll(async () => {
		client = postgres(checkDatabaseConnectionString(), { max: 1, fetch_types: false })
		db = drizzle(client, { logger: false })
		testDb = { drizzle: db, client } as ReturnType<Database>

		await db.delete(leaderboard)

		const startSeed = performance.now()

		// Suppress drizzle-seed console output
		const originalLog = console.log
		console.log = () => {}

		try {
			await seed(db, { leaderboard }, { count: TEST_ROW_COUNT }).refine((f) => ({
				leaderboard: {
					columns: {
						wallet: f.valuesFromArray({
							values: Array.from(
								{ length: TEST_ROW_COUNT },
								(_, i) => `B62qk${i.toString().padStart(50, "0")}`
							),
							isUnique: true
						}),
						score: f.int({ minValue: 0, maxValue: 10_000 })
					}
				}
			}))
		} finally {
			console.log = originalLog
			console.log(
				`✓ Database seeded with ${TEST_ROW_COUNT} entries in ${Math.round(performance.now() - startSeed)}ms`
			)
		}
	})

	afterAll(async () => {
		await db.delete(leaderboard)
		await client.end()
		console.log("✓ Test data cleaned up")
	})

	describe("pagination", () => {
		it("should return first page with correct limit", async () => {
			const result = await queryLeaderboard(testDb, { limit: 5 })

			expect(result.entries).toHaveLength(5)
			expect(result.total).toBeGreaterThan(TEST_ROW_COUNT * 0.99) // Allow for ~1% with score=0
			expect(result.hasMore).toBe(true) // We have more than 5 entries
		})

		it("should return entries in descending score order with wallet as tiebreaker", async () => {
			const result = await queryLeaderboard(testDb, { limit: 100 })

			for (let i = 0; i < result.entries.length - 1; i++) {
				const current = result.entries[i]
				const next = result.entries[i + 1]

				if (current.score === next.score) {
					expect(current.wallet.localeCompare(next.wallet)).toBeLessThan(0)
				} else {
					expect(current.score).toBeGreaterThan(next.score)
				}
			}
		})

		it("should paginate correctly using cursor", async () => {
			const firstPage = await queryLeaderboard(testDb, { limit: 5 })

			expect(firstPage.entries.length).toBeGreaterThan(0)
			expect(firstPage.entries.length).toBeLessThanOrEqual(5)
			expect(firstPage.hasMore).toBe(true)

			const lastEntry = firstPage.entries[firstPage.entries.length - 1]
			const secondPage = await queryLeaderboard(testDb, {
				cursorScore: lastEntry.score,
				cursorWallet: lastEntry.wallet,
				limit: 5
			})

			expect(secondPage.entries.length).toBeGreaterThan(0)

			const firstPageWallets = new Set(firstPage.entries.map((e) => e.wallet))
			const secondPageWallets = secondPage.entries.map((e) => e.wallet)

			for (const wallet of secondPageWallets) {
				expect(firstPageWallets.has(wallet)).toBe(false)
			}

			const lastOfFirst = firstPage.entries[firstPage.entries.length - 1]
			const firstOfSecond = secondPage.entries[0]

			if (lastOfFirst.score === firstOfSecond.score) {
				expect(lastOfFirst.wallet.localeCompare(firstOfSecond.wallet)).toBeLessThan(0)
			} else {
				expect(lastOfFirst.score).toBeGreaterThan(firstOfSecond.score)
			}
		})

		it("should correctly indicate hasMore=false on last page", async () => {
			await db.insert(leaderboard).values([
				{ wallet: "test_wallet_1", score: 9_999 },
				{ wallet: "test_wallet_2", score: 9_998 },
				{ wallet: "test_wallet_3", score: 9_997 }
			])

			const result = await queryLeaderboard(testDb, { limit: 10_000 }) // Should get all entries without hasMore
			expect(result.hasMore).toBe(false)
			expect(result.entries.length).toBeLessThanOrEqual(10_000)
		})

		it("should handle ranks correctly", async () => {
			const result = await queryLeaderboard(testDb, { limit: 100 })

			for (let i = 0; i < result.entries.length; i++) {
				expect(result.entries[i].rank).toBe(i + 1)
			}
		})
	})

	describe("searchWallet", () => {
		beforeAll(async () => {
			await db.insert(leaderboard).values([
				{ wallet: "search_test_top", score: 15_000 },
				{ wallet: "search_test_middle", score: 5_000 },
				{ wallet: "search_test_bottom", score: 10 }
			])
		})

		it("should center results around searched wallet", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_test_middle",
				limit: 5
			})

			expect(result.entries.length).toBe(5)
			const targetIndex = result.entries.findIndex((e) => e.wallet === "search_test_middle")
			expect(targetIndex).toBeGreaterThanOrEqual(1) // Should not be first
			expect(targetIndex).toBeLessThan(4) // Should not be last
		})

		it("should return correct rank for searched wallet", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_test_top",
				limit: 50
			})

			const targetEntry = result.entries.find((e) => e.wallet === "search_test_top")
			expect(targetEntry).toBeDefined()
			expect(targetEntry?.rank).toBe(1) // Should be rank 1 with score 100,000
		})

		it("should return empty results for non-existent wallet", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "non_existent_wallet_xyz",
				limit: 50
			})

			expect(result.entries).toHaveLength(0)
			expect(result.hasMore).toBe(false)
		})

		it("should handle wallet at the top of leaderboard", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_test_top",
				limit: 50
			})

			expect(result.entries[0].wallet).toBe("search_test_top")
			expect(result.entries[0].rank).toBe(1)
		})

		it("should handle wallet at the bottom of leaderboard", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_test_bottom",
				limit: 50
			})

			const targetEntry = result.entries.find((e) => e.wallet === "search_test_bottom")
			expect(targetEntry).toBeDefined()
			expect(targetEntry?.rank).toBeGreaterThan(1)
		})
	})

	describe("performance", () => {
		it("should handle first page query in under 100ms", async () => {
			const start = performance.now()

			await queryLeaderboard(testDb, { limit: 50 })

			const duration = performance.now() - start
			expect(duration).toBeLessThan(100)
		})

		it("should handle paginated query in under 100ms", async () => {
			const firstPage = await queryLeaderboard(testDb, { limit: 50 })

			const lastEntry = firstPage.entries[firstPage.entries.length - 1]

			const start = performance.now()

			await queryLeaderboard(testDb, {
				cursorScore: lastEntry.score,
				cursorWallet: lastEntry.wallet,
				limit: 50
			})

			const duration = performance.now() - start
			expect(duration).toBeLessThan(100)
		})

		it("should handle search query in under 150ms", async () => {
			const start = performance.now()

			await queryLeaderboard(testDb, {
				searchWallet: "search_test_middle",
				limit: 50
			})

			const duration = performance.now() - start
			expect(duration).toBeLessThan(150)
		})

		it("should execute multiple queries efficiently", async () => {
			const start = performance.now()

			await Promise.all([
				queryLeaderboard(testDb, { limit: 50 }),
				queryLeaderboard(testDb, { limit: 50 }),
				queryLeaderboard(testDb, { limit: 50 })
			])

			const duration = performance.now() - start
			expect(duration).toBeLessThan(300) // Should complete all 3 in reasonable time
		})
	})

	describe("edge cases", () => {
		it("should handle entries with score of 0", async () => {
			await db.insert(leaderboard).values([
				{ wallet: "zero_score_1", score: 0 },
				{ wallet: "zero_score_2", score: 0 }
			])

			const result = await queryLeaderboard(testDb, { limit: 10_000 })

			const zeroScoreEntries = result.entries.filter((e) => e.score === 0)
			expect(zeroScoreEntries).toHaveLength(0)
		})

		it("should handle duplicate scores correctly", async () => {
			await db.insert(leaderboard).values([
				{ wallet: "dup_score_a", score: 12_345 },
				{ wallet: "dup_score_b", score: 12_345 },
				{ wallet: "dup_score_c", score: 12_345 }
			])

			const result = await queryLeaderboard(testDb, { limit: 10_000 })

			const duplicateScoreEntries = result.entries.filter((e) => e.score === 12_345)
			expect(duplicateScoreEntries.length).toBe(3)

			expect(duplicateScoreEntries[0].wallet).toBe("dup_score_a")
			expect(duplicateScoreEntries[1].wallet).toBe("dup_score_b")
			expect(duplicateScoreEntries[2].wallet).toBe("dup_score_c")
		})

		it("should return correct total count", async () => {
			const result = await queryLeaderboard(testDb, { limit: 50 })

			const countResult = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(leaderboard)
				.where(sql`${leaderboard.score} > 0`)

			expect(result.total).toBe(countResult[0].count)
		})
	})
})
