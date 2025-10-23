import { actions, leaderboard } from "@leaderboard/api"
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest"
import { createTestDatabase, scoreConfig } from "../src/db"
import { Indexer } from "../src/indexer"

const { db, clean } = createTestDatabase()

beforeAll(async () => {
	await clean()
})

afterAll(async () => {
	await clean()
})

describe("Indexer", () => {
	let indexer: Indexer

	beforeEach(async () => {
		await clean()
		indexer = new Indexer(db)
	})

	test("should start and stop the indexer", () => {
		// Initially not running
		expect(indexer.getStatus().isRunning).toBe(false)

		// Start the indexer
		const startResult = indexer.start({ startingBlock: 0, intervalSeconds: 10 })
		expect(startResult.success).toBe(true)
		expect(indexer.getStatus().isRunning).toBe(true)
		expect(indexer.getStatus().config.intervalSeconds).toBe(10)

		// Stop the indexer
		const stopResult = indexer.stop()
		expect(stopResult.success).toBe(true)
		expect(indexer.getStatus().isRunning).toBe(false)
	})

	test("should not start if already running", () => {
		indexer.start()
		const result = indexer.start()
		expect(result.success).toBe(false)
		expect(result.message).toContain("already running")
		indexer.stop()
	})

	test("should not stop if not running", () => {
		const result = indexer.stop()
		expect(result.success).toBe(false)
		expect(result.message).toContain("not running")
	})

	describe("recalculate", () => {
		test("should rebuild leaderboard from existing actions", async () => {
			// Insert some actions manually
			await db.insert(actions).values([
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx1",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest1",
					actionType: "BRIDGE_MINA_TO_ZEKO",
					transactionHash: "tx2",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest2",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx3",
					timestamp: new Date()
				}
			])

			// Manually insert incorrect leaderboard data
			await db.insert(leaderboard).values([
				{ wallet: "B62qtest1", score: 999, updatedAt: new Date() },
				{ wallet: "B62qtest2", score: 1, updatedAt: new Date() }
			])

			// Verify incorrect state
			let leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(2)
			expect(leaderboardData.find((l) => l.wallet === "B62qtest1")?.score).toBe(999)

			// Perform recalculate
			const result = await indexer.recalculate()
			expect(result.success).toBe(true)
			if (result.success === true) {
				expect(result.actionsProcessed).toBe(3)
				expect(result.walletsUpdated).toBe(2)
			}

			// Verify correct state after recalculate
			leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(2)

			const wallet1 = leaderboardData.find((l) => l.wallet === "B62qtest1")
			const wallet2 = leaderboardData.find((l) => l.wallet === "B62qtest2")

			expect(wallet1?.score).toBe(
				scoreConfig.FAUCET_ZEKO_TMINA.points + scoreConfig.BRIDGE_MINA_TO_ZEKO.points
			)
			expect(wallet2?.score).toBe(scoreConfig.FAUCET_ZEKO_TMINA.points)
		})

		test("should handle recalculate with no actions", async () => {
			const result = await indexer.recalculate()
			expect(result.success).toBe(true)
			if (result.success === true) {
				expect(result.actionsProcessed).toBe(0)
				expect(result.walletsUpdated).toBe(0)
			}

			const leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(0)
		})

		test("should restart indexer after recalculate if it was running", async () => {
			// Start the indexer
			indexer.start({ startingBlock: 0, intervalSeconds: 10 })
			expect(indexer.getStatus().isRunning).toBe(true)

			// Perform recalculate
			const result = await indexer.recalculate()

			// Indexer should be restarted automatically
			expect(indexer.getStatus().isRunning).toBe(true)
			if (result.success === true) {
				expect(result.restarted).toBe(true)
			}

			// Clean up
			indexer.stop()
		})

		test("should not restart indexer after recalculate if it was not running", async () => {
			// Ensure indexer is not running
			expect(indexer.getStatus().isRunning).toBe(false)

			// Perform recalculate
			const result = await indexer.recalculate()

			// Indexer should remain stopped
			expect(indexer.getStatus().isRunning).toBe(false)
			if (result.success === true) {
				expect(result.restarted).toBe(false)
			}
		})

		test("should preserve actions table during recalculate", async () => {
			// Insert actions
			await db.insert(actions).values([
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx1",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest1",
					actionType: "BRIDGE_MINA_TO_ZEKO",
					transactionHash: "tx2",
					timestamp: new Date()
				}
			])

			// Verify actions exist
			const actionsBefore = await db.select().from(actions)
			expect(actionsBefore).toHaveLength(2)

			// Perform recalculate
			await indexer.recalculate()

			// Verify actions still exist
			const actionsAfter = await db.select().from(actions)
			expect(actionsAfter).toHaveLength(2)
			expect(actionsAfter[0].wallet).toBe("B62qtest1")
			expect(actionsAfter[1].wallet).toBe("B62qtest1")
		})

		test("should respect 'once' strategy during recalculate", async () => {
			// Insert multiple faucet claims (which has 'once' strategy with maxOccurrences=1)
			await db.insert(actions).values([
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx1",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx2",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx3",
					timestamp: new Date()
				}
			])

			await indexer.recalculate()

			const leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(1)

			// Should be capped at maxOccurrences=1
			expect(leaderboardData[0].score).toBe(scoreConfig.FAUCET_ZEKO_TMINA.points)
		})

		test("should respect 'daily' strategy during recalculate", async () => {
			const yesterday = new Date()
			yesterday.setUTCDate(yesterday.getUTCDate() - 1)

			// Insert swap actions (which has 'daily' strategy with maxOccurrences=10)
			// 3 from yesterday, 2 from today
			await db.insert(actions).values([
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx1",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx2",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx3",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx4",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx5",
					timestamp: new Date()
				}
			])

			await indexer.recalculate()

			const leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(1)

			// Daily strategy accumulates across ALL days
			// Yesterday: min(3, 10) * 1 = 3 points
			// Today: min(2, 10) * 1 = 2 points
			// Total: 5 points
			expect(leaderboardData[0].score).toBe(scoreConfig.LUMINA_SWAP_MINA_TZEKO.points * 5)
		})

		test("should handle mixed strategies during recalculate", async () => {
			const yesterday = new Date()
			yesterday.setUTCDate(yesterday.getUTCDate() - 1)

			// Insert mixed actions
			await db.insert(actions).values([
				// Faucet (once) - should count
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx1",
					timestamp: yesterday
				},
				// Bridge (once) - should count
				{
					wallet: "B62qtest1",
					actionType: "BRIDGE_MINA_TO_ZEKO",
					transactionHash: "tx2",
					timestamp: yesterday
				},
				// Swap (daily) - yesterday, should count
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx3",
					timestamp: yesterday
				},
				// Swap (daily) - today, should count
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx4",
					timestamp: new Date()
				}
			])

			await indexer.recalculate()

			const leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(1)

			// Faucet (once): 20 points
			// Bridge (once): 20 points
			// Swap yesterday: 1 point (capped at 10 per day)
			// Swap today: 1 point (capped at 10 per day)
			// Total: 42 points
			const expectedScore =
				scoreConfig.FAUCET_ZEKO_TMINA.points +
				scoreConfig.BRIDGE_MINA_TO_ZEKO.points +
				scoreConfig.LUMINA_SWAP_MINA_TZEKO.points * 2 // Both yesterday and today

			expect(leaderboardData[0].score).toBe(expectedScore)
		})

		test("should handle daily strategy with multiple days (3+ dates)", async () => {
			// Create timestamps for 4 different days
			const today = new Date()
			const yesterday = new Date()
			yesterday.setUTCDate(yesterday.getUTCDate() - 1)
			const twoDaysAgo = new Date()
			twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)
			const threeDaysAgo = new Date()
			threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3)

			// Insert swap actions (daily strategy with maxOccurrences=10) across multiple days
			// 2 from 3 days ago, 2 from 2 days ago, 3 from yesterday, 2 from today
			await db.insert(actions).values([
				// 3 days ago - 2 swaps (should count)
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-3d-1",
					timestamp: threeDaysAgo
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-3d-2",
					timestamp: threeDaysAgo
				},
				// 2 days ago - 2 swaps (should count)
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-2d-1",
					timestamp: twoDaysAgo
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-2d-2",
					timestamp: twoDaysAgo
				},
				// Yesterday - 3 swaps (should count)
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-1d-1",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-1d-2",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-1d-3",
					timestamp: yesterday
				},
				// Today - 2 swaps (should count)
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-today-1",
					timestamp: today
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx-today-2",
					timestamp: today
				}
			])

			await indexer.recalculate()

			const leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(1)

			// Daily strategy accumulates across ALL days, capped at 10 per day
			// 3 days ago: min(2, 10) * 1 = 2 points
			// 2 days ago: min(2, 10) * 1 = 2 points
			// Yesterday: min(3, 10) * 1 = 3 points
			// Today: min(2, 10) * 1 = 2 points
			// Total: 9 points
			const expectedScore = scoreConfig.LUMINA_SWAP_MINA_TZEKO.points * 9
			expect(leaderboardData[0].score).toBe(expectedScore)
		})

		test("should handle daily strategy with multiple wallets across multiple days", async () => {
			const today = new Date()
			const yesterday = new Date()
			yesterday.setUTCDate(yesterday.getUTCDate() - 1)
			const twoDaysAgo = new Date()
			twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)

			// Insert swap actions for 3 different wallets across 3 days
			await db.insert(actions).values([
				// Wallet 1: 1 from 2 days ago, 2 from yesterday, 3 from today
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w1-2d-1",
					timestamp: twoDaysAgo
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w1-1d-1",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w1-1d-2",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w1-0d-1",
					timestamp: today
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w1-0d-2",
					timestamp: today
				},
				{
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w1-0d-3",
					timestamp: today
				},

				// Wallet 2: 2 from yesterday, 1 from today
				{
					wallet: "B62qtest2",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w2-1d-1",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest2",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w2-1d-2",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest2",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w2-0d-1",
					timestamp: today
				},

				// Wallet 3: 4 from 2 days ago, 0 from today
				{
					wallet: "B62qtest3",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w3-2d-1",
					timestamp: twoDaysAgo
				},
				{
					wallet: "B62qtest3",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w3-2d-2",
					timestamp: twoDaysAgo
				},
				{
					wallet: "B62qtest3",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w3-2d-3",
					timestamp: twoDaysAgo
				},
				{
					wallet: "B62qtest3",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "w3-2d-4",
					timestamp: twoDaysAgo
				}
			])

			await indexer.recalculate()

			const leaderboardData = await db.select().from(leaderboard).orderBy(leaderboard.wallet)
			expect(leaderboardData).toHaveLength(3)

			// Wallet 1: 1 from 2 days ago + 2 from yesterday + 3 from today = 6 total
			expect(leaderboardData[0].wallet).toBe("B62qtest1")
			expect(leaderboardData[0].score).toBe(scoreConfig.LUMINA_SWAP_MINA_TZEKO.points * 6)

			// Wallet 2: 2 from yesterday + 1 from today = 3 total
			expect(leaderboardData[1].wallet).toBe("B62qtest2")
			expect(leaderboardData[1].score).toBe(scoreConfig.LUMINA_SWAP_MINA_TZEKO.points * 3)

			// Wallet 3: 4 from 2 days ago = 4 total (capped at 10 per day)
			expect(leaderboardData[2].wallet).toBe("B62qtest3")
			expect(leaderboardData[2].score).toBe(scoreConfig.LUMINA_SWAP_MINA_TZEKO.points * 4)
		})

		test("should handle multiple wallets during recalculate", async () => {
			await db.insert(actions).values([
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "tx1",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest2",
					actionType: "BRIDGE_MINA_TO_ZEKO",
					transactionHash: "tx2",
					timestamp: new Date()
				},
				{
					wallet: "B62qtest3",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: "tx3",
					timestamp: new Date()
				}
			])

			await indexer.recalculate()

			const leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(3)

			expect(leaderboardData.find((l) => l.wallet === "B62qtest1")?.score).toBe(
				scoreConfig.FAUCET_ZEKO_TMINA.points
			)
			expect(leaderboardData.find((l) => l.wallet === "B62qtest2")?.score).toBe(
				scoreConfig.BRIDGE_MINA_TO_ZEKO.points
			)
			expect(leaderboardData.find((l) => l.wallet === "B62qtest3")?.score).toBe(
				scoreConfig.LUMINA_SWAP_MINA_TZEKO.points
			)
		})

		test("PRODUCTION: should handle large dataset recalculate", async () => {
			// Create 100 wallets with various actions using Array.from
			const actionsToInsert = Array.from({ length: 100 }, (_, i) => {
				const wallet = `B62qtest${i.toString().padStart(3, "0")}`
				return [
					{
						wallet,
						actionType: "FAUCET_ZEKO_TMINA" as const,
						transactionHash: `faucet-${i}`,
						timestamp: new Date()
					},
					{
						wallet,
						actionType: "BRIDGE_MINA_TO_ZEKO" as const,
						transactionHash: `deposit-${i}`,
						timestamp: new Date()
					}
				]
			}).flat()

			await db.insert(actions).values(actionsToInsert)

			const result = await indexer.recalculate()
			expect(result.success).toBe(true)
			if (result.success === true) {
				expect(result.actionsProcessed).toBe(200)
				expect(result.walletsUpdated).toBe(100)
			}
			const leaderboardData = await db.select().from(leaderboard)
			expect(leaderboardData).toHaveLength(100)

			const expectedScore =
				scoreConfig.FAUCET_ZEKO_TMINA.points + scoreConfig.BRIDGE_MINA_TO_ZEKO.points
			// Verify all wallets have the expected score
			expect(leaderboardData.every((entry) => entry.score === expectedScore)).toBe(true)
		})
	})
})
