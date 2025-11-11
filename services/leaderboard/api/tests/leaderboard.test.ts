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

const clearDb = async (db: ReturnType<Database>["drizzle"]) => {
	await db.delete(leaderboard)
	console.log("✓ Test data cleaned up")
}

const seedDb = async (db: ReturnType<Database>["drizzle"]) => {
	// Suppress drizzle-seed console output
	const originalLog = console.log
	console.log = () => {}
	await clearDb(db)

	const startSeed = performance.now()

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
}
describe("queryLeaderboard", () => {
	let client: Sql
	let db: ReturnType<Database>["drizzle"]
	let testDb: ReturnType<Database>

	beforeAll(async () => {
		client = postgres(checkDatabaseConnectionString(), { max: 1, fetch_types: false })
		db = drizzle(client, { logger: false })
		testDb = { drizzle: db, client } as ReturnType<Database>
		await seedDb(db)
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

		it("should paginate correctly using page numbers", async () => {
			const firstPage = await queryLeaderboard(testDb, { page: 1, limit: 5 })

			expect(firstPage.entries.length).toBeGreaterThan(0)
			expect(firstPage.entries.length).toBeLessThanOrEqual(5)
			expect(firstPage.hasMore).toBe(true)

			const secondPage = await queryLeaderboard(testDb, { page: 2, limit: 5 })

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

		it("should handle page 3 correctly", async () => {
			const page3 = await queryLeaderboard(testDb, { page: 3, limit: 10 })

			expect(page3.entries.length).toBeGreaterThan(0)
			expect(page3.entries[0].rank).toBe(21) // First entry on page 3 should be rank 21
		})
	})

	describe("searchWallet", () => {
		beforeAll(async () => {
			await clearDb(db)
			await db.insert(leaderboard).values([
				{ wallet: "search_a", score: 10 },
				{ wallet: "search_b", score: 100 },
				{ wallet: "search_c", score: 1_000 },
				{ wallet: "search_d", score: 10_000 },
				{ wallet: "search_e", score: 1 }
			])
		})

		it("should return leaderboard from searched wallet downwards (excluding higher scores)", async () => {
			// Search for b (score 100): should get wallets with score <= 100
			const resultB = await queryLeaderboard(testDb, {
				searchWallet: "search_b",
				limit: 10
			})

			const wallets = resultB.entries.map((e) => e.wallet)
			expect(wallets).toContain("search_b")
			expect(wallets).toContain("search_a")
			expect(wallets).toContain("search_e")
			expect(wallets).not.toContain("search_d") // higher score
			expect(wallets).not.toContain("search_c") // higher score

			// All entries should have score <= 100
			for (const entry of resultB.entries) {
				expect(entry.score).toBeLessThanOrEqual(100)
			}
		})

		it("should handle search for lowest score wallet", async () => {
			// Search for e (score 1): should only get wallets with score <= 1
			const resultE = await queryLeaderboard(testDb, {
				searchWallet: "search_e",
				limit: 10
			})

			const wallets = resultE.entries.map((e) => e.wallet)
			expect(wallets).toContain("search_e")
			expect(wallets).not.toContain("search_a") // higher score
			expect(wallets).not.toContain("search_b") // higher score
			expect(wallets).not.toContain("search_c") // higher score
			expect(wallets).not.toContain("search_d") // higher score

			// All entries should have score <= 1
			for (const entry of resultE.entries) {
				expect(entry.score).toBeLessThanOrEqual(1)
			}
		})

		it("should handle search for middle score wallet", async () => {
			// Search for c (score 1000): should get wallets with score <= 1000
			const resultC = await queryLeaderboard(testDb, {
				searchWallet: "search_c",
				limit: 10
			})

			const wallets = resultC.entries.map((e) => e.wallet)
			expect(wallets).toContain("search_c")
			expect(wallets).toContain("search_b")
			expect(wallets).toContain("search_a")
			expect(wallets).toContain("search_e")
			expect(wallets).not.toContain("search_d") // higher score (10,000)

			// All entries should have score <= 1000
			for (const entry of resultC.entries) {
				expect(entry.score).toBeLessThanOrEqual(1_000)
			}
		})

		it("should handle search for highest score wallet", async () => {
			// Search for d (score 10000): should get all wallets
			const resultD = await queryLeaderboard(testDb, {
				searchWallet: "search_d",
				limit: 10
			})

			const wallets = resultD.entries.map((e) => e.wallet)
			expect(wallets).toContain("search_d")
			expect(wallets).toContain("search_c")
			expect(wallets).toContain("search_b")
			expect(wallets).toContain("search_a")
			expect(wallets).toContain("search_e")

			// All entries should have score <= 10000
			for (const entry of resultD.entries) {
				expect(entry.score).toBeLessThanOrEqual(10_000)
			}
		})

		it("should maintain proper ordering in subset", async () => {
			// Search for c: results should be ordered by score DESC
			const resultC = await queryLeaderboard(testDb, {
				searchWallet: "search_c",
				limit: 10
			})

			const searchWallets = resultC.entries.filter((e) =>
				["search_a", "search_b", "search_c", "search_e"].includes(e.wallet)
			)

			expect(searchWallets.length).toBe(4)
			expect(searchWallets[0].wallet).toBe("search_c") // 1000
			expect(searchWallets[1].wallet).toBe("search_b") // 100
			expect(searchWallets[2].wallet).toBe("search_a") // 10
			expect(searchWallets[3].wallet).toBe("search_e") // 1
		})

		it("should return empty results for non-existent wallet", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "non_existent_wallet_xyz",
				limit: 50
			})

			expect(result.entries).toHaveLength(0)
			expect(result.hasMore).toBe(false)
		})

		it("should respect limit parameter", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_d",
				limit: 3
			})

			expect(result.entries.length).toBeLessThanOrEqual(3)
		})

		it("should support pagination with search", async () => {
			// Page 1 of search results
			const page1 = await queryLeaderboard(testDb, {
				searchWallet: "search_d",
				page: 1,
				limit: 2
			})

			expect(page1.entries.length).toBe(2)
			expect(page1.hasMore).toBe(true)

			// Page 2 of search results
			const page2 = await queryLeaderboard(testDb, {
				searchWallet: "search_d",
				page: 2,
				limit: 2
			})

			expect(page2.entries.length).toBe(2)

			// Ensure no overlap between pages
			const page1Wallets = new Set(page1.entries.map((e) => e.wallet))
			const page2Wallets = page2.entries.map((e) => e.wallet)

			for (const wallet of page2Wallets) {
				expect(page1Wallets.has(wallet)).toBe(false)
			}

			// Verify ordering continues correctly
			const lastOfPage1 = page1.entries[page1.entries.length - 1]
			const firstOfPage2 = page2.entries[0]

			if (lastOfPage1.score === firstOfPage2.score) {
				expect(lastOfPage1.wallet.localeCompare(firstOfPage2.wallet)).toBeLessThan(0)
			} else {
				expect(lastOfPage1.score).toBeGreaterThan(firstOfPage2.score)
			}
		})
	})

	describe("performance", () => {
		beforeAll(async () => {
			await seedDb(db)
		})
		it("should handle first page query in under 100ms", async () => {
			const start = performance.now()

			await queryLeaderboard(testDb, { limit: 50 })

			const duration = performance.now() - start
			expect(duration).toBeLessThan(100)
		})

		it("should handle paginated query in under 100ms", async () => {
			const start = performance.now()

			await queryLeaderboard(testDb, { page: 2, limit: 50 })

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

		it("should return consistent total count across all pages", async () => {
			// Get the total from first page
			const firstPage = await queryLeaderboard(testDb, { page: 1, limit: 10 })
			const expectedTotal = firstPage.total

			// Verify total is consistent across multiple pages
			const secondPage = await queryLeaderboard(testDb, { page: 2, limit: 10 })
			expect(secondPage.total).toBe(expectedTotal)

			const thirdPage = await queryLeaderboard(testDb, { page: 3, limit: 10 })
			expect(thirdPage.total).toBe(expectedTotal)

			const lastPage = await queryLeaderboard(testDb, { page: 100, limit: 10 })
			expect(lastPage.total).toBe(expectedTotal)

			// Verify total matches actual database count
			const countResult = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(leaderboard)
				.where(sql`${leaderboard.score} > 0`)

			expect(expectedTotal).toBe(countResult[0].count)
		})

		it("should return correct total count with different page sizes", async () => {
			// Get total with different limits
			const smallPage = await queryLeaderboard(testDb, { limit: 5 })
			const mediumPage = await queryLeaderboard(testDb, { limit: 50 })
			const largePage = await queryLeaderboard(testDb, { limit: 500 })

			// All should return the same total regardless of page size
			expect(smallPage.total).toBe(mediumPage.total)
			expect(mediumPage.total).toBe(largePage.total)

			// Verify against actual count
			const countResult = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(leaderboard)
				.where(sql`${leaderboard.score} > 0`)

			expect(smallPage.total).toBe(countResult[0].count)
		})

		it("should return correct total even when search filters results", async () => {
			await clearDb(db)
			await db.insert(leaderboard).values([
				{ wallet: "total_test_a", score: 1000 },
				{ wallet: "total_test_b", score: 900 },
				{ wallet: "total_test_c", score: 800 },
				{ wallet: "total_test_d", score: 700 },
				{ wallet: "total_test_e", score: 600 }
			])

			// Search for middle wallet - this filters to 3 wallets (c, d, e)
			const searchResult = await queryLeaderboard(testDb, {
				searchWallet: "total_test_c",
				limit: 10
			})

			// Total should still be 5 (all entries), not 3 (filtered entries)
			expect(searchResult.total).toBe(5)

			// But we should only get 3 entries back
			expect(searchResult.entries.length).toBe(3)
		})
	})
})
