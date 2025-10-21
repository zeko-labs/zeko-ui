import { actions, leaderboard } from "@leaderboard/api"
import { sql } from "drizzle-orm"
import type { Entries, RequireAtLeastOne } from "type-fest"
import { beforeAll, beforeEach, describe, expect, test } from "vitest"
import {
	type ActionToInsert,
	type ActionType,
	batchInsertActionsAndUpdateLeaderboard,
	createTestDatabase,
	scoreConfig
} from "../src/db"

const { db, clean } = createTestDatabase()

// Clean database once before all tests start
beforeAll(async () => {
	await clean()
})

type ActionCounts = Record<ActionType, number>
// Helper to calculate expected score
const calculateExpectedScore = (actionCounts: RequireAtLeastOne<ActionCounts>) => {
	return (Object.entries(actionCounts) as Entries<ActionCounts>).reduce(
		(total, [actionType, count]) => {
			const config = scoreConfig[actionType]
			if (!config) return total
			return total + Math.min(count, config.maxOccurrences) * config.points
		},
		0
	)
}

describe("batchInsertActionsAndUpdateLeaderboard", () => {
	beforeEach(async () => {
		await clean()
	})

	test("should handle empty actions array", async () => {
		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert: [] })

		const allActions = await db.select().from(actions)
		const allLeaderboard = await db.select().from(leaderboard)

		expect(allActions).toHaveLength(0)
		expect(allLeaderboard).toHaveLength(0)
	})

	test("should insert single action and calculate score correctly", async () => {
		const actionsToInsert: ActionToInsert[] = [
			{
				wallet: "B62qtest1",
				actionType: "FAUCET_ZEKO_TMINA",
				transactionHash: "tx1"
			}
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allActions = await db.select().from(actions)
		const allLeaderboard = await db.select().from(leaderboard)

		expect(allActions).toHaveLength(1)
		expect(allActions[0].wallet).toBe("B62qtest1")
		expect(allActions[0].actionType).toBe("FAUCET_ZEKO_TMINA")

		expect(allLeaderboard).toHaveLength(1)
		expect(allLeaderboard[0].wallet).toBe("B62qtest1")
		expect(allLeaderboard[0].score).toBe(calculateExpectedScore({ FAUCET_ZEKO_TMINA: 1 }))
	})

	test("should respect maxOccurrences cap with 'once' strategy", async () => {
		const actionsToInsert: ActionToInsert[] = Array.from({ length: 3 }, (_, i) => ({
			wallet: "B62qtest1",
			actionType: "FAUCET_ZEKO_TMINA" as const,
			transactionHash: `tx${i + 1}`
		}))

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allActions = await db.select().from(actions)
		const allLeaderboard = await db.select().from(leaderboard)

		expect(allActions).toHaveLength(3)
		expect(allLeaderboard).toHaveLength(1)
		// Capped at maxOccurrences from config
		expect(allLeaderboard[0].score).toBe(calculateExpectedScore({ FAUCET_ZEKO_TMINA: 3 }))
	})

	test("should handle multiple action types for same wallet", async () => {
		const actionsToInsert: ActionToInsert[] = [
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" },
			{ wallet: "B62qtest1", actionType: "BRIDGE_MINA_TO_ZEKO", transactionHash: "tx2" },
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx3" },
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx4" }
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allLeaderboard = await db.select().from(leaderboard)

		expect(allLeaderboard).toHaveLength(1)
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({
				FAUCET_ZEKO_TMINA: 1,
				BRIDGE_MINA_TO_ZEKO: 1,
				LUMINA_SWAP_MINA_TZEKO: 2
			})
		)
	})

	test("should handle multiple wallets in batch", async () => {
		const actionsToInsert: ActionToInsert[] = [
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" },
			{ wallet: "B62qtest2", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx2" },
			{ wallet: "B62qtest3", actionType: "BRIDGE_MINA_TO_ZEKO", transactionHash: "tx3" }
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allLeaderboard = await db.select().from(leaderboard).orderBy(leaderboard.wallet)

		expect(allLeaderboard).toHaveLength(3)
		expect(allLeaderboard[0].wallet).toBe("B62qtest1")
		expect(allLeaderboard[0].score).toBe(scoreConfig.FAUCET_ZEKO_TMINA.points)
		expect(allLeaderboard[1].wallet).toBe("B62qtest2")
		expect(allLeaderboard[1].score).toBe(scoreConfig.FAUCET_ZEKO_TMINA.points)
		expect(allLeaderboard[2].wallet).toBe("B62qtest3")
		expect(allLeaderboard[2].score).toBe(scoreConfig.BRIDGE_MINA_TO_ZEKO.points)
	})

	test("should ignore duplicate transaction hashes", async () => {
		const actionsToInsert: ActionToInsert[] = [
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" },
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" } // Duplicate
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allActions = await db.select().from(actions)
		expect(allActions).toHaveLength(1) // Only one inserted
	})

	test("should handle cross-batch duplicates (restart from block 0 scenario)", async () => {
		// Simulate first run: insert some actions (including multiple swaps to test cap)
		const firstBatch: ActionToInsert[] = [
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" },
			{ wallet: "B62qtest1", actionType: "BRIDGE_MINA_TO_ZEKO", transactionHash: "tx2" },
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx3" },
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx4" },
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx5" },
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx6" },
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx7" },
			{ wallet: "B62qtest3", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx11" }
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert: firstBatch })

		// Verify initial state
		const initialActions = await db.select().from(actions)
		const initialLeaderboard = await db.select().from(leaderboard).orderBy(leaderboard.wallet)

		expect(initialActions).toHaveLength(8)
		expect(initialLeaderboard).toHaveLength(3)
		expect(initialLeaderboard[0].wallet).toBe("B62qtest1")
		expect(initialLeaderboard[0].score).toBe(
			calculateExpectedScore({
				FAUCET_ZEKO_TMINA: 1,
				BRIDGE_MINA_TO_ZEKO: 1,
				LUMINA_SWAP_MINA_TZEKO: 3
			})
		)
		expect(initialLeaderboard[1].wallet).toBe("B62qtest2")
		expect(initialLeaderboard[1].score).toBe(calculateExpectedScore({ LUMINA_SWAP_MINA_TZEKO: 2 }))
		expect(initialLeaderboard[2].wallet).toBe("B62qtest3")
		expect(initialLeaderboard[2].score).toBe(calculateExpectedScore({ LUMINA_SWAP_MINA_TZEKO: 1 }))

		// Simulate service restart from block 0: try to insert the same actions again + some new ones
		const secondBatch: ActionToInsert[] = [
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" }, // Duplicate
			{ wallet: "B62qtest1", actionType: "BRIDGE_MINA_TO_ZEKO", transactionHash: "tx2" }, // Duplicate
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx3" }, // Duplicate
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx4" }, // Duplicate
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx5" }, // Duplicate
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx6" }, // Duplicate
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx7" }, // Duplicate
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx8" }, // New
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx9" }, // New
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx10" }, // New (should exceed cap)
			{ wallet: "B62qtest3", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx11" }, // Duplicate
			{ wallet: "B62qtest3", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx12" }, // New (below cap)
			{ wallet: "B62qtest3", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx13" } // New (below cap)
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert: secondBatch })

		// Verify final state: only 5 new actions inserted, scores updated correctly with caps applied
		const finalActions = await db.select().from(actions)
		const finalLeaderboard = await db.select().from(leaderboard).orderBy(leaderboard.wallet)

		expect(finalActions).toHaveLength(13) // 8 original + 5 new
		expect(finalLeaderboard).toHaveLength(3) // Still 3 wallets

		// Wallet 1 score should remain unchanged (no new actions for this wallet)
		expect(finalLeaderboard[0].wallet).toBe("B62qtest1")
		expect(finalLeaderboard[0].score).toBe(
			calculateExpectedScore({
				FAUCET_ZEKO_TMINA: 1,
				BRIDGE_MINA_TO_ZEKO: 1,
				LUMINA_SWAP_MINA_TZEKO: 3
			})
		)

		// Wallet 2 score should increase but be capped (5 total swaps, capped by maxOccurrences)
		expect(finalLeaderboard[1].wallet).toBe("B62qtest2")
		expect(finalLeaderboard[1].score).toBe(
			calculateExpectedScore({ LUMINA_SWAP_MINA_TZEKO: 5 }) // 5 swaps total, respects cap
		)

		// Wallet 3 score should increase correctly (3 total swaps, below cap, no double-counting)
		expect(finalLeaderboard[2].wallet).toBe("B62qtest3")
		expect(finalLeaderboard[2].score).toBe(
			calculateExpectedScore({ LUMINA_SWAP_MINA_TZEKO: 3 }) // 1 from first batch + 2 new, no duplicate
		)
	})

	test("should update existing leaderboard entry", async () => {
		// First batch
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert: [
				{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" }
			]
		})

		let allLeaderboard = await db.select().from(leaderboard)
		expect(allLeaderboard[0].score).toBe(scoreConfig.FAUCET_ZEKO_TMINA.points)

		// Second batch with new action
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert: [
				{ wallet: "B62qtest1", actionType: "BRIDGE_MINA_TO_ZEKO", transactionHash: "tx2" }
			]
		})

		allLeaderboard = await db.select().from(leaderboard)
		expect(allLeaderboard).toHaveLength(1) // Still one entry
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({ FAUCET_ZEKO_TMINA: 1, BRIDGE_MINA_TO_ZEKO: 1 })
		)
	})

	test("should handle daily strategy - count only today's actions", async () => {
		// Insert an old action manually (simulate yesterday)
		const yesterday = new Date()
		yesterday.setUTCDate(yesterday.getUTCDate() - 1)

		await db.insert(actions).values({
			wallet: "B62qtest1",
			actionType: "FAUCET_ZEKO_TMINA",
			transactionHash: "tx_old",
			timestamp: yesterday
		})

		// Now insert today's actions via batch
		const actionsToInsert: ActionToInsert[] = [
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1" },
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx2" }
		]

		// Use custom config with daily strategy for this specific test
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert,
			config: {
				FAUCET_ZEKO_TMINA: { points: 10, maxOccurrences: 3, strategy: "daily" }
			}
		})

		const allActions = await db.select().from(actions).where(sql`wallet = 'B62qtest1'`)
		const allLeaderboard = await db.select().from(leaderboard)

		expect(allActions).toHaveLength(3) // 1 old + 2 new
		expect(allLeaderboard).toHaveLength(1)
		// Daily strategy: only count today's 2 actions, capped at maxOccurrences=3
		// 2 * 10 = 20
		expect(allLeaderboard[0].score).toBe(20)
	})

	test("should handle mixed strategies - once and daily", async () => {
		const yesterday = new Date()
		yesterday.setUTCDate(yesterday.getUTCDate() - 1)

		// Insert old actions
		await db.insert(actions).values([
			{
				wallet: "B62qtest1",
				actionType: "FAUCET_ZEKO_TMINA",
				transactionHash: "tx_faucet_old",
				timestamp: yesterday
			},
			{
				wallet: "B62qtest1",
				actionType: "LUMINA_SWAP_MINA_TZEKO",
				transactionHash: "tx_swap_old_1",
				timestamp: yesterday
			},
			{
				wallet: "B62qtest1",
				actionType: "LUMINA_SWAP_MINA_TZEKO",
				transactionHash: "tx_swap_old_2",
				timestamp: yesterday
			}
		])
		// Insert today's actions
		const actionsToInsert: ActionToInsert[] = [
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx_faucet_new" }, // Should be ignored (maxOccurrences=1 with 'once')
			{
				wallet: "B62qtest1",
				actionType: "LUMINA_SWAP_MINA_TZEKO",
				transactionHash: "tx_swap_new_1"
			},
			{
				wallet: "B62qtest1",
				actionType: "LUMINA_SWAP_MINA_TZEKO",
				transactionHash: "tx_swap_new_2"
			},
			{
				wallet: "B62qtest1",
				actionType: "LUMINA_SWAP_MINA_TZEKO",
				transactionHash: "tx_swap_new_3"
			}
		]

		// Use custom mixed config for this specific test
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert,
			config: {
				FAUCET_ZEKO_TMINA: { points: 10, maxOccurrences: 1, strategy: "once" },
				LUMINA_SWAP_MINA_TZEKO: { points: 5, maxOccurrences: 10, strategy: "daily" }
			}
		})

		const allLeaderboard = await db.select().from(leaderboard)

		expect(allLeaderboard).toHaveLength(1)
		// FAUCET (once): min(2 total, 1) * 10 = 10
		// SWAP (daily): min(3 today, 10) * 5 = 15
		// Total: 25
		expect(allLeaderboard[0].score).toBe(25)
	})

	test("should handle complex scenario with multiple wallets and strategies", async () => {
		const yesterday = new Date()
		yesterday.setUTCDate(yesterday.getUTCDate() - 1)

		// Wallet 1: Has old faucet claim
		await db.insert(actions).values({
			wallet: "B62qtest1",
			actionType: "FAUCET_ZEKO_TMINA",
			transactionHash: "tx1_old",
			timestamp: yesterday
		})

		// Batch insert new actions
		const actionsToInsert: ActionToInsert[] = [
			// Wallet 1: Try to claim faucet again (should not count due to 'once' strategy)
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx1_new" },
			// Wallet 1: Swaps today
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx1_swap1" },
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx1_swap2" },
			// Wallet 2: First faucet claim
			{ wallet: "B62qtest2", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "tx2_faucet" },
			// Wallet 2: Swaps today
			{ wallet: "B62qtest2", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "tx2_swap1" }
		]

		// Use custom mixed config for this specific test
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert,
			config: {
				FAUCET_ZEKO_TMINA: { points: 10, maxOccurrences: 1, strategy: "once" },
				LUMINA_SWAP_MINA_TZEKO: { points: 5, maxOccurrences: 10, strategy: "daily" }
			}
		})

		const allLeaderboard = await db.select().from(leaderboard).orderBy(leaderboard.wallet)

		expect(allLeaderboard).toHaveLength(2)

		// Wallet 1: FAUCET (once, already claimed) = 10, SWAP (daily, 2 today) = 10 => 20
		expect(allLeaderboard[0].wallet).toBe("B62qtest1")
		expect(allLeaderboard[0].score).toBe(20)

		// Wallet 2: FAUCET (once, 1) = 10, SWAP (daily, 1 today) = 5 => 15
		expect(allLeaderboard[1].wallet).toBe("B62qtest2")
		expect(allLeaderboard[1].score).toBe(15)
	})

	test("PRODUCTION: should enforce 'once' strategy caps even with excessive actions", async () => {
		// User tries to game the system by submitting many faucet/bridge transactions
		const actionsToInsert: ActionToInsert[] = [
			...Array.from({ length: 10 }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "FAUCET_ZEKO_TMINA" as const,
				transactionHash: `faucet_${i}`
			})),
			...Array.from({ length: 10 }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "BRIDGE_MINA_TO_ZEKO" as const,
				transactionHash: `deposit_${i}`
			})),
			...Array.from({ length: 10 }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "BRIDGE_ZEKO_TO_MINA" as const,
				transactionHash: `withdrawal_${i}`
			}))
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allLeaderboard = await db.select().from(leaderboard)

		expect(allLeaderboard).toHaveLength(1)
		// Despite excessive actions, capped by maxOccurrences
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({
				FAUCET_ZEKO_TMINA: 10,
				BRIDGE_MINA_TO_ZEKO: 10,
				BRIDGE_ZEKO_TO_MINA: 10
			})
		)
	})

	test("PRODUCTION: should enforce 'daily' strategy caps even with excessive actions", async () => {
		const actionsToInsert: ActionToInsert[] = [
			...Array.from({ length: 50 }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
				transactionHash: `swap_${i}`
			})),
			...Array.from({ length: 20 }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO" as const,
				transactionHash: `liquidity_${i}`
			}))
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allLeaderboard = await db.select().from(leaderboard)

		expect(allLeaderboard).toHaveLength(1)
		// Daily caps enforced
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({
				LUMINA_SWAP_MINA_TZEKO: 50,
				LUMINA_ADD_LIQUIDITY_MINA_TZEKO: 20
			})
		)
	})

	test("PRODUCTION: should calculate max possible score correctly", async () => {
		const actionsToInsert: ActionToInsert[] = [
			// All 'once' actions
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "faucet" },
			{ wallet: "B62qtest1", actionType: "BRIDGE_MINA_TO_ZEKO", transactionHash: "deposit" },
			{ wallet: "B62qtest1", actionType: "BRIDGE_ZEKO_TO_MINA", transactionHash: "withdrawal" },
			// Max daily swaps
			...Array.from({ length: scoreConfig.LUMINA_SWAP_MINA_TZEKO.maxOccurrences }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
				transactionHash: `swap_${i}`
			})),
			// Max daily liquidity
			...Array.from(
				{ length: scoreConfig.LUMINA_ADD_LIQUIDITY_MINA_TZEKO.maxOccurrences },
				(_, i) => ({
					wallet: "B62qtest1" as const,
					actionType: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO" as const,
					transactionHash: `liquidity_${i}`
				})
			)
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allLeaderboard = await db.select().from(leaderboard)

		expect(allLeaderboard).toHaveLength(1)
		// Maximum possible score
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({
				FAUCET_ZEKO_TMINA: 1,
				BRIDGE_MINA_TO_ZEKO: 1,
				BRIDGE_ZEKO_TO_MINA: 1,
				LUMINA_SWAP_MINA_TZEKO: scoreConfig.LUMINA_SWAP_MINA_TZEKO.maxOccurrences,
				LUMINA_ADD_LIQUIDITY_MINA_TZEKO: scoreConfig.LUMINA_ADD_LIQUIDITY_MINA_TZEKO.maxOccurrences
			})
		)
	})

	test("PRODUCTION: daily reset - user can earn points again next day", async () => {
		const yesterday = new Date()
		yesterday.setUTCDate(yesterday.getUTCDate() - 1)

		const maxSwaps = scoreConfig.LUMINA_SWAP_MINA_TZEKO.maxOccurrences

		// User maxed out swaps yesterday
		await Promise.all(
			Array.from({ length: maxSwaps }, (_, i) =>
				db.insert(actions).values({
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: `swap_yesterday_${i}`,
					timestamp: yesterday
				})
			)
		)

		// User does swaps again today
		const actionsToInsert = Array.from({ length: maxSwaps }, (_, i) => ({
			wallet: "B62qtest1" as const,
			actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
			transactionHash: `swap_today_${i}`
		}))

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allActions = await db.select().from(actions).where(sql`wallet = 'B62qtest1'`)
		const allLeaderboard = await db.select().from(leaderboard)

		expect(allActions).toHaveLength(maxSwaps * 2)
		expect(allLeaderboard).toHaveLength(1)
		// Should count only today's swaps
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({ LUMINA_SWAP_MINA_TZEKO: maxSwaps })
		)
	})

	test("PRODUCTION: once strategy persists across days", async () => {
		const yesterday = new Date()
		yesterday.setUTCDate(yesterday.getUTCDate() - 1)

		// User claimed faucet yesterday
		await db.insert(actions).values({
			wallet: "B62qtest1",
			actionType: "FAUCET_ZEKO_TMINA",
			transactionHash: "faucet_yesterday",
			timestamp: yesterday
		})

		// User tries to claim again today - should not get more points
		const actionsToInsert = Array.from({ length: 2 }, (_, i) => ({
			wallet: "B62qtest1" as const,
			actionType: "FAUCET_ZEKO_TMINA" as const,
			transactionHash: `faucet_today_${i + 1}`
		}))

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allActions = await db.select().from(actions).where(sql`wallet = 'B62qtest1'`)
		const allLeaderboard = await db.select().from(leaderboard)

		expect(allActions).toHaveLength(3) // All 3 actions recorded
		expect(allLeaderboard).toHaveLength(1)
		// Capped by maxOccurrences for 'once' strategy
		expect(allLeaderboard[0].score).toBe(calculateExpectedScore({ FAUCET_ZEKO_TMINA: 3 }))
	})

	test("PRODUCTION: multiple batches throughout the day", async () => {
		// Batch 1: Morning - user does some swaps
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert: Array.from({ length: 3 }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
				transactionHash: `swap_${i + 1}`
			}))
		})

		const leaderboard1 = await db.select().from(leaderboard)
		expect(leaderboard1[0].score).toBe(calculateExpectedScore({ LUMINA_SWAP_MINA_TZEKO: 3 }))

		// Batch 2: Afternoon - user does more swaps and claims faucet
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert: [
				...Array.from({ length: 2 }, (_, i) => ({
					wallet: "B62qtest1" as const,
					actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
					transactionHash: `swap_${i + 4}`
				})),
				{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "faucet_1" }
			]
		})
		const leaderboard2 = await db.select().from(leaderboard)
		expect(leaderboard2[0].score).toBe(
			calculateExpectedScore({ LUMINA_SWAP_MINA_TZEKO: 5, FAUCET_ZEKO_TMINA: 1 })
		)

		// Batch 3: Evening - user exceeds swap cap and adds liquidity
		await batchInsertActionsAndUpdateLeaderboard({
			db,
			actionsToInsert: [
				...Array.from({ length: 7 }, (_, i) => ({
					wallet: "B62qtest1" as const,
					actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
					transactionHash: `swap_${i + 6}`
				})),
				...Array.from({ length: 2 }, (_, i) => ({
					wallet: "B62qtest1" as const,
					actionType: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO" as const,
					transactionHash: `liquidity_${i + 1}`
				}))
			]
		})
		const leaderboard3 = await db.select().from(leaderboard)
		// Swaps capped at max, faucet + liquidity
		expect(leaderboard3[0].score).toBe(
			calculateExpectedScore({
				LUMINA_SWAP_MINA_TZEKO: 12, // Will be capped
				FAUCET_ZEKO_TMINA: 1,
				LUMINA_ADD_LIQUIDITY_MINA_TZEKO: 2
			})
		)
	})

	test("PRODUCTION: large batch with many wallets", async () => {
		const walletCount = 100

		const actionsToInsert = Array.from({ length: walletCount }, (_, i) => {
			const wallet = `B62qtest${i.toString().padStart(3, "0")}`
			return [
				{ wallet, actionType: "FAUCET_ZEKO_TMINA" as const, transactionHash: `faucet_${i}` },
				{ wallet, actionType: "BRIDGE_MINA_TO_ZEKO" as const, transactionHash: `deposit_${i}` },
				...Array.from({ length: 3 }, (_, j) => ({
					wallet,
					actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
					transactionHash: `swap_${i}_${j + 1}`
				}))
			]
		}).flat()

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allLeaderboard = await db.select().from(leaderboard)

		expect(allLeaderboard).toHaveLength(walletCount)

		const expectedScore = calculateExpectedScore({
			FAUCET_ZEKO_TMINA: 1,
			BRIDGE_MINA_TO_ZEKO: 1,
			LUMINA_SWAP_MINA_TZEKO: 3
		})

		for (const entry of allLeaderboard) {
			expect(entry.score).toBe(expectedScore)
		}
	})

	test("PRODUCTION: handles partial success - some wallets exceed caps", async () => {
		const actionsToInsert: ActionToInsert[] = [
			// Wallet 1: Normal usage
			{ wallet: "B62qtest1", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "w1_faucet" },
			{ wallet: "B62qtest1", actionType: "LUMINA_SWAP_MINA_TZEKO", transactionHash: "w1_swap_1" },
			// Wallet 2: Exceeds swap cap
			{ wallet: "B62qtest2", actionType: "FAUCET_ZEKO_TMINA", transactionHash: "w2_faucet" },
			...Array.from({ length: 15 }, (_, i) => ({
				wallet: "B62qtest2" as const,
				actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
				transactionHash: `w2_swap_${i}`
			})),
			// Wallet 3: Only bridge actions
			{ wallet: "B62qtest3", actionType: "BRIDGE_MINA_TO_ZEKO", transactionHash: "w3_deposit" },
			{ wallet: "B62qtest3", actionType: "BRIDGE_ZEKO_TO_MINA", transactionHash: "w3_withdrawal" }
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allLeaderboard = await db.select().from(leaderboard).orderBy(leaderboard.wallet)

		expect(allLeaderboard).toHaveLength(3)

		expect(allLeaderboard[0].wallet).toBe("B62qtest1")
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({ FAUCET_ZEKO_TMINA: 1, LUMINA_SWAP_MINA_TZEKO: 1 })
		)

		expect(allLeaderboard[1].wallet).toBe("B62qtest2")
		expect(allLeaderboard[1].score).toBe(
			calculateExpectedScore({ FAUCET_ZEKO_TMINA: 1, LUMINA_SWAP_MINA_TZEKO: 15 })
		)

		expect(allLeaderboard[2].wallet).toBe("B62qtest3")
		expect(allLeaderboard[2].score).toBe(
			calculateExpectedScore({ BRIDGE_MINA_TO_ZEKO: 1, BRIDGE_ZEKO_TO_MINA: 1 })
		)
	})

	test("PRODUCTION: cross-day boundary behavior", async () => {
		const yesterday = new Date()
		yesterday.setUTCDate(yesterday.getUTCDate() - 1)

		const twoDaysAgo = new Date()
		twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)

		const maxSwaps = scoreConfig.LUMINA_SWAP_MINA_TZEKO.maxOccurrences
		const maxLiquidity = scoreConfig.LUMINA_ADD_LIQUIDITY_MINA_TZEKO.maxOccurrences

		// Two days ago: maxed out daily actions
		await Promise.all([
			...Array.from({ length: maxSwaps }, (_, i) =>
				db.insert(actions).values({
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: `swap_day1_${i}`,
					timestamp: twoDaysAgo
				})
			),
			...Array.from({ length: maxLiquidity }, (_, i) =>
				db.insert(actions).values({
					wallet: "B62qtest1",
					actionType: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO",
					transactionHash: `liquidity_day1_${i}`,
					timestamp: twoDaysAgo
				})
			)
		])
		// Yesterday: maxed out again + did once actions
		await Promise.all([
			...Array.from({ length: maxSwaps }, (_, i) =>
				db.insert(actions).values({
					wallet: "B62qtest1",
					actionType: "LUMINA_SWAP_MINA_TZEKO",
					transactionHash: `swap_day2_${i}`,
					timestamp: yesterday
				})
			),
			db.insert(actions).values([
				{
					wallet: "B62qtest1",
					actionType: "FAUCET_ZEKO_TMINA",
					transactionHash: "faucet_day2",
					timestamp: yesterday
				},
				{
					wallet: "B62qtest1",
					actionType: "BRIDGE_MINA_TO_ZEKO",
					transactionHash: "deposit_day2",
					timestamp: yesterday
				}
			])
		])
		// Today: new daily actions
		const actionsToInsert = [
			...Array.from({ length: 5 }, (_, i) => ({
				wallet: "B62qtest1" as const,
				actionType: "LUMINA_SWAP_MINA_TZEKO" as const,
				transactionHash: `swap_today_${i}`
			})),
			{
				wallet: "B62qtest1" as const,
				actionType: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO" as const,
				transactionHash: "liquidity_today"
			}
		]

		await batchInsertActionsAndUpdateLeaderboard({ db, actionsToInsert })

		const allActions = await db.select().from(actions).where(sql`wallet = 'B62qtest1'`)
		const allLeaderboard = await db.select().from(leaderboard)

		expect(allActions).toHaveLength(maxSwaps * 2 + maxLiquidity + 2 + 5 + 1)
		expect(allLeaderboard).toHaveLength(1)

		// 'once' actions from any day + 'daily' actions from today only
		expect(allLeaderboard[0].score).toBe(
			calculateExpectedScore({
				FAUCET_ZEKO_TMINA: 1,
				BRIDGE_MINA_TO_ZEKO: 1,
				LUMINA_SWAP_MINA_TZEKO: 5,
				LUMINA_ADD_LIQUIDITY_MINA_TZEKO: 1
			})
		)
	})
})
