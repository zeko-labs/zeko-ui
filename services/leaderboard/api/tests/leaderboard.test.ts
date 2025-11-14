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
			expect(result.totalEntries).toBeGreaterThan(TEST_ROW_COUNT * 0.99) // Allow for ~1% with score=0
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
			const wallets = Array.from({ length: 100 }, (_, i) => ({
				wallet: `search_wallet_${String(i + 1).padStart(3, "0")}`,
				score: 100 - i
			}))
			await db.insert(leaderboard).values(wallets)
		})

		it("should return leaderboard starting from searched wallet", async () => {
			// Search for wallet with rank 10 (score 91)
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_010",
				limit: 5,
				page: 1
			})

			// The FIRST entry should be the searched wallet
			expect(result.entries[0].wallet).toBe("search_wallet_010")
			expect(result.entries[0].rank).toBe(10)
			expect(result.entries[0].score).toBe(91)

			// The rest should be wallets that come after (ranks 11-14)
			expect(result.entries[1].wallet).toBe("search_wallet_011")
			expect(result.entries[1].rank).toBe(11)
			expect(result.entries[2].wallet).toBe("search_wallet_012")
			expect(result.entries[2].rank).toBe(12)
			expect(result.entries[3].wallet).toBe("search_wallet_013")
			expect(result.entries[3].rank).toBe(13)
			expect(result.entries[4].wallet).toBe("search_wallet_014")
			expect(result.entries[4].rank).toBe(14)
		})

		it("should show searched wallet as first result on page 1", async () => {
			// Search for wallet with rank 50 (score 51)
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_050",
				limit: 20,
				page: 1
			})

			// The FIRST entry MUST be the searched wallet
			expect(result.entries[0].wallet).toBe("search_wallet_050")
			expect(result.entries[0].rank).toBe(50)
			expect(result.entries[0].score).toBe(51)

			// The rest should be wallets that come after (ranks 51-69)
			expect(result.entries[1].rank).toBe(51)
			expect(result.entries[2].rank).toBe(52)
			expect(result.entries[19].rank).toBe(69)
		})

		it("should handle pagination after searched wallet", async () => {
			// Search for wallet at rank 50, get page 2
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_050",
				limit: 20,
				page: 2
			})

			// Page 2 should start at rank 70 (50 + 20)
			expect(result.entries[0].rank).toBe(70)
			expect(result.entries[0].wallet).toBe("search_wallet_070")
		})

		it("should return page starting from searched wallet", async () => {
			// Search for wallet at rank 60 (score 41), with limit 10
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_060",
				limit: 10,
				page: 1
			})

			// First entry should be the searched wallet
			expect(result.entries[0].wallet).toBe("search_wallet_060")
			expect(result.entries[0].rank).toBe(60)

			// Rest should be the 9 wallets after it (ranks 61-69)
			expect(result.entries[1].rank).toBe(61)
			expect(result.entries[9].rank).toBe(69)
		})

		it("should handle search for lowest score wallet", async () => {
			// Search for wallet with rank 100 (score 1)
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_100",
				limit: 10,
				page: 1
			})

			// First entry should be the searched wallet
			expect(result.entries[0].wallet).toBe("search_wallet_100")
			expect(result.entries[0].rank).toBe(100)
			expect(result.entries[0].score).toBe(1)

			// Should only have 1 entry (no wallets after it)
			expect(result.entries.length).toBe(1)
			expect(result.hasMore).toBe(false)
		})

		it("should handle search for middle score wallet", async () => {
			// Search for wallet at rank 50 (score 51)
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_050",
				limit: 10,
				page: 1
			})

			// First entry should be the searched wallet
			expect(result.entries[0].wallet).toBe("search_wallet_050")
			expect(result.entries[0].rank).toBe(50)

			// Should have 10 entries total (searched wallet + 9 after)
			expect(result.entries.length).toBe(10)
			expect(result.entries[9].rank).toBe(59)
		})

		it("should handle search for highest score wallet", async () => {
			// Search for wallet at rank 1 (score 100)
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_001",
				limit: 10,
				page: 1
			})

			// First entry should be the searched wallet
			expect(result.entries[0].wallet).toBe("search_wallet_001")
			expect(result.entries[0].rank).toBe(1)
			expect(result.entries[0].score).toBe(100)

			// Should have 10 entries (rank 1-10)
			expect(result.entries.length).toBe(10)
			expect(result.entries[9].rank).toBe(10)
		})

		it("should maintain proper ordering from searched wallet", async () => {
			// Search for wallet at rank 10
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_010",
				limit: 20,
				page: 1
			})

			// Verify ordering starts from searched wallet
			expect(result.entries[0].rank).toBe(10)

			// Verify sequential ordering
			for (let i = 0; i < result.entries.length - 1; i++) {
				const current = result.entries[i]
				const next = result.entries[i + 1]
				expect(next.rank).toBe(current.rank + 1)
			}
		})

		it("should return empty results for non-existent wallet", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "non_existent_wallet_xyz",
				limit: 50,
				page: 1
			})

			expect(result.entries).toHaveLength(0)
			expect(result.hasMore).toBe(false)
		})

		it("should respect limit parameter", async () => {
			const result = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_001",
				limit: 3,
				page: 1
			})

			expect(result.entries.length).toBeLessThanOrEqual(3)
		})

		it("should support pagination with search", async () => {
			// Page 1: search for wallet at rank 10
			const page1 = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_010",
				page: 1,
				limit: 10
			})

			// Page 1 should start with the searched wallet (rank 10)
			expect(page1.entries[0].wallet).toBe("search_wallet_010")
			expect(page1.entries[0].rank).toBe(10)
			expect(page1.entries.length).toBe(10)
			expect(page1.hasMore).toBe(true)

			// Page 2 should continue from rank 20
			const page2 = await queryLeaderboard(testDb, {
				searchWallet: "search_wallet_010",
				page: 2,
				limit: 10
			})

			expect(page2.entries[0].rank).toBe(20)
			expect(page2.entries.length).toBe(10)

			// Ensure no overlap between pages
			const page1Wallets = new Set(page1.entries.map((e) => e.wallet))
			const page2Wallets = page2.entries.map((e) => e.wallet)

			for (const wallet of page2Wallets) {
				expect(page1Wallets.has(wallet)).toBe(false)
			}
		})
	})

	describe("Realistic Data", () => {
		beforeAll(async () => {
			await clearDb(db)
			// Create a scenario similar to production: many wallets with score 20
			const wallets = [
				{ wallet: "B62qiaBUaRKdmHgisXcZm9cVtxAkUijphS7135C9GSSZQ8aHgGiCBHe", score: 20 },
				{ wallet: "B62qiaEz3tHYg9Tqha7nhustEYeyqjsoyHZgaGgFWW5U7TcXMhizzpq", score: 20 },
				{ wallet: "B62qibA4tjxouKcqsAPnGAX4hJEWy1eu8psdCC812PHNx1rvBTCqJQP", score: 20 },
				{ wallet: "B62qpLxXFg4rmhce762uiJjNRnp5Bzc9PnCEAcraeaMkVWkPi7kgsWV", score: 20 }, // The searched wallet
				{ wallet: "B62qz1anotherWallet1", score: 20 },
				{ wallet: "B62qz2anotherWallet2", score: 20 },
				{ wallet: "B62qz3anotherWallet3", score: 20 },
				{ wallet: "B62qz4anotherWallet4", score: 20 },
				{ wallet: "B62qz5anotherWallet5", score: 20 },
				{ wallet: "B62qz6anotherWallet6", score: 20 }
			]
			await db.insert(leaderboard).values(wallets)
		})

		it("should find exact wallet even when many wallets share same score", async () => {
			// Search for the specific wallet
			const result = await queryLeaderboard(testDb, {
				searchWallet: "B62qpLxXFg4rmhce762uiJjNRnp5Bzc9PnCEAcraeaMkVWkPi7kgsWV",
				limit: 5,
				page: 1
			})

			// The FIRST entry must be the searched wallet
			expect(result.entries[0].wallet).toBe(
				"B62qpLxXFg4rmhce762uiJjNRnp5Bzc9PnCEAcraeaMkVWkPi7kgsWV"
			)
			expect(result.entries[0].score).toBe(20)

			// All entries should have the same or lower scores
			for (const entry of result.entries) {
				expect(entry.score).toBeLessThanOrEqual(20)
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
		it("should return empty results when searching for wallet with score 0", async () => {
			await db.insert(leaderboard).values([{ wallet: "zero_score_search_test", score: 0 }])

			const result = await queryLeaderboard(testDb, {
				searchWallet: "zero_score_search_test",
				limit: 5,
				page: 1
			})

			expect(result.entries.length).toBe(0)
			expect(result.hasMore).toBe(false)
			expect(result.totalEntries).toBeGreaterThan(0)
			expect(result.totalPoints).toBeGreaterThan(0)
		})

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

			expect(result.totalEntries).toBe(countResult[0].count)
		})

		it("should return consistent total count across all pages", async () => {
			// Get the total from first page
			const firstPage = await queryLeaderboard(testDb, { page: 1, limit: 10 })
			const expectedTotal = firstPage.totalEntries

			// Verify total is consistent across multiple pages
			const secondPage = await queryLeaderboard(testDb, { page: 2, limit: 10 })
			expect(secondPage.totalEntries).toBe(expectedTotal)

			const thirdPage = await queryLeaderboard(testDb, { page: 3, limit: 10 })
			expect(thirdPage.totalEntries).toBe(expectedTotal)

			const lastPage = await queryLeaderboard(testDb, { page: 100, limit: 10 })
			expect(lastPage.totalEntries).toBe(expectedTotal)

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
			expect(smallPage.totalEntries).toBe(mediumPage.totalEntries)
			expect(mediumPage.totalEntries).toBe(largePage.totalEntries)

			// Verify against actual count
			const countResult = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(leaderboard)
				.where(sql`${leaderboard.score} > 0`)

			expect(smallPage.totalEntries).toBe(countResult[0].count)
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
			expect(searchResult.totalEntries).toBe(5)

			// But we should only get 3 entries back
			expect(searchResult.entries.length).toBe(3)
		})
	})
})
