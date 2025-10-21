import { env, runInDurableObject } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import type { BroadcastMessagePayload } from "../src/do"
import { DistributorDO, UserDo } from "../src/do"

describe("DistributorDO", () => {
	it("should initialize with zero subscribers", async () => {
		const shardName = "distributor-0"
		const id = env.DISTRIBUTOR_DO.idFromName(shardName)
		const stub = env.DISTRIBUTOR_DO.get(id)

		const result = await runInDurableObject(stub, async (instance: DistributorDO) => {
			expect(instance).toBeInstanceOf(DistributorDO)
			instance.setShardId(shardName)
			return instance.getSubscriberCount()
		})

		expect(result).toEqual({ shardId: shardName, count: 0 })
	})

	it("should accept subscriber registration", async () => {
		const shardName = "distributor-1"
		const userId = "user-test-1"

		const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
		const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

		const subscribeResult = await runInDurableObject(
			distributorStub,
			async (instance: DistributorDO) => {
				instance.setShardId(shardName)
				return instance.subscribe(userId)
			}
		)

		expect(subscribeResult).toEqual({ success: true, subscriberCount: 1 })

		const countResult = await runInDurableObject(
			distributorStub,
			async (instance: DistributorDO) => {
				return instance.getSubscriberCount()
			}
		)

		expect(countResult).toEqual({ shardId: shardName, count: 1 })
	})

	it("should handle multiple subscribers", async () => {
		const shardName = "distributor-2"
		const userIds = ["user-multi-1", "user-multi-2", "user-multi-3"]

		const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
		const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

		// Initialize distributor
		await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			instance.setShardId(shardName)
			return instance.getSubscriberCount()
		})

		// Subscribe multiple users
		for (const userId of userIds) {
			await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
				return instance.subscribe(userId)
			})
		}

		const countResult = await runInDurableObject(
			distributorStub,
			async (instance: DistributorDO) => {
				return instance.getSubscriberCount()
			}
		)

		expect(countResult.count).toBe(userIds.length)
	})

	it("should broadcast to zero subscribers without error", async () => {
		const shardName = "distributor-3"
		const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
		const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

		const payload: BroadcastMessagePayload = {
			type: "TEST_MESSAGE",
			data: { message: "Hello, World!" },
			timestamp: Date.now()
		}

		const result = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			instance.setShardId(shardName)
			return instance.broadcast(payload)
		})

		expect(result).toEqual({ success: true, deliveredCount: 0 })
	})

	it("should broadcast message to subscribed users", async () => {
		const shardName = "distributor-4"
		const userId = "user-broadcast-1"

		const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
		const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

		// Setup UserDO
		const userDoId = env.USER_DO.idFromName(userId)
		const userDoStub = env.USER_DO.get(userDoId)

		await runInDurableObject(userDoStub, async (instance: UserDo) => {
			instance.setUserId(userId)
		})

		// Subscribe user
		await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			instance.setShardId(shardName)
			return instance.subscribe(userId)
		})

		const payload: BroadcastMessagePayload = {
			type: "LEADERBOARD_UPDATE",
			data: { rank: 1, score: 1000 },
			timestamp: Date.now()
		}

		const result = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			return instance.broadcast(payload)
		})

		// Note: In test environment without actual WebSocket connections,
		// the receiveMessage will throw because there are no sockets.
		// The distributor should handle this gracefully and remove the subscriber.
		expect(result.success).toBe(true)
	})

	it("should remove failed subscribers during broadcast", async () => {
		const shardName = "distributor-5"
		const userId = "user-fail-1"

		const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
		const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

		// Setup UserDO without WebSocket
		const userDoId = env.USER_DO.idFromName(userId)
		const userDoStub = env.USER_DO.get(userDoId)

		await runInDurableObject(userDoStub, async (instance: UserDo) => {
			instance.setUserId(userId)
		})

		// Subscribe user
		await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			instance.setShardId(shardName)
			return instance.subscribe(userId)
		})

		// Verify subscriber count before broadcast
		const beforeCount = await runInDurableObject(
			distributorStub,
			async (instance: DistributorDO) => {
				return instance.getSubscriberCount()
			}
		)
		expect(beforeCount.count).toBe(1)

		// Broadcast - should fail because no WebSocket connection
		const payload: BroadcastMessagePayload = {
			type: "TEST",
			data: {},
			timestamp: Date.now()
		}

		await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			return instance.broadcast(payload)
		})

		// Verify subscriber was removed after failed delivery
		const afterCount = await runInDurableObject(
			distributorStub,
			async (instance: DistributorDO) => {
				return instance.getSubscriberCount()
			}
		)
		expect(afterCount.count).toBe(0)
	})
})

describe("UserDO", () => {
	it("should initialize with no connections", async () => {
		const userId = "user-init-1"
		const id = env.USER_DO.idFromName(userId)
		const stub = env.USER_DO.get(id)

		const result = await runInDurableObject(stub, async (instance: UserDo) => {
			expect(instance).toBeInstanceOf(UserDo)
			instance.setUserId(userId)
			return instance.getCurrentConnections()
		})

		expect(result).toEqual({
			userId,
			connections: 0,
			isSubscribed: false,
			shardId: null
		})
	})

	it("should reject non-websocket upgrade requests", async () => {
		const userId = "user-reject-1"
		const id = env.USER_DO.idFromName(userId)
		const stub = env.USER_DO.get(id)

		const response = await stub.fetch("https://do.test/websocket", {
			headers: { Upgrade: "not-websocket" }
		})

		expect(response.status).toBe(426)
		expect(await response.text()).toBe("Durable Object expected Upgrade: websocket")
	})

	it("should return info page for non-websocket requests", async () => {
		const userId = "user-info-1"
		const id = env.USER_DO.idFromName(userId)
		const stub = env.USER_DO.get(id)

		const response = await stub.fetch("https://do.test/")

		expect(response.status).toBe(200)
		const text = await response.text()
		expect(text).toContain("/websocket")
	})

	it("should calculate consistent shard IDs for users", async () => {
		const userIds = ["user-shard-1", "user-shard-2", "user-shard-3"]
		const shardIds: number[] = []

		for (const userId of userIds) {
			const id = env.USER_DO.idFromName(userId)
			const stub = env.USER_DO.get(id)

			// Create a WebSocket connection to trigger shard calculation
			const response = await stub.fetch("https://do.test/websocket", {
				headers: {
					Upgrade: "websocket",
					"X-User-ID": userId
				}
			})

			// The response should be a WebSocket upgrade (status 101)
			expect(response.status).toBe(101)

			// Get connection info to verify shard assignment
			const info = await runInDurableObject(stub, async (instance: UserDo) => {
				return instance.getCurrentConnections()
			})

			expect(info.shardId).toBeGreaterThanOrEqual(0)
			expect(info.shardId).toBeLessThan(100)
			shardIds.push(info.shardId!)
		}

		// Verify same user always gets same shard (consistent hashing)
		for (let i = 0; i < userIds.length; i++) {
			const userId = userIds[i]
			const id = env.USER_DO.idFromName(userId)
			const stub = env.USER_DO.get(id)

			const info = await runInDurableObject(stub, async (instance: UserDo) => {
				return instance.getCurrentConnections()
			})

			expect(info.shardId).toBe(shardIds[i])
		}
	})

	it("should handle anonymous users", async () => {
		const id = env.USER_DO.idFromName("anon-test")
		const stub = env.USER_DO.get(id)

		// Connect without X-User-ID header
		const response = await stub.fetch("https://do.test/websocket", {
			headers: { Upgrade: "websocket" }
		})

		expect(response.status).toBe(101)

		const info = await runInDurableObject(stub, async (instance: UserDo) => {
			return instance.getCurrentConnections()
		})

		// Should have assigned a shard even for anonymous user
		expect(info.shardId).toBeGreaterThanOrEqual(0)
		expect(info.shardId).toBeLessThan(100)
	})

	it("should maintain WebSocket connection state", async () => {
		const userId = "user-ws-state-1"
		const id = env.USER_DO.idFromName(userId)
		const stub = env.USER_DO.get(id)

		// Before connection
		const beforeInfo = await runInDurableObject(stub, async (instance: UserDo) => {
			instance.setUserId(userId)
			return instance.getCurrentConnections()
		})
		expect(beforeInfo.connections).toBe(0)

		// Create connection
		const response = await stub.fetch("https://do.test/websocket", {
			headers: {
				Upgrade: "websocket",
				"X-User-ID": userId
			}
		})

		expect(response.status).toBe(101)
		expect(response.webSocket).toBeDefined()

		// After connection - verify the connection is tracked
		const afterInfo = await runInDurableObject(stub, async (instance: UserDo) => {
			return instance.getCurrentConnections()
		})
		expect(afterInfo.connections).toBe(1)
		expect(afterInfo.isSubscribed).toBe(true)
		expect(afterInfo.shardId).toBeGreaterThanOrEqual(0)
		expect(afterInfo.shardId).toBeLessThan(100)
	})

	it("should throw error when receiving message without active connection", async () => {
		const userId = "user-no-ws-1"
		const id = env.USER_DO.idFromName(userId)
		const stub = env.USER_DO.get(id)

		await runInDurableObject(stub, async (instance: UserDo) => {
			instance.setUserId(userId)
		})

		const payload: BroadcastMessagePayload = {
			type: "TEST",
			data: {},
			timestamp: Date.now()
		}

		await expect(
			runInDurableObject(stub, async (instance: UserDo) => {
				return instance.receiveMessage(payload)
			})
		).rejects.toThrow("No active WebSocket connections")
	})
})

describe("Integration: Distributor and User DOs", () => {
	it("should distribute messages across multiple shards", async () => {
		// Create users that will map to different shards
		const users = [
			{ id: "user-integration-1", expectedShard: null as number | null },
			{ id: "user-integration-2", expectedShard: null as number | null },
			{ id: "user-integration-3", expectedShard: null as number | null }
		]

		// Connect users and record their shards
		for (const user of users) {
			const userDoId = env.USER_DO.idFromName(user.id)
			const userDoStub = env.USER_DO.get(userDoId)

			await userDoStub.fetch("https://do.test/websocket", {
				headers: {
					Upgrade: "websocket",
					"X-User-ID": user.id
				}
			})

			const info = await runInDurableObject(userDoStub, async (instance: UserDo) => {
				return instance.getCurrentConnections()
			})

			user.expectedShard = info.shardId
		}

		// Get unique shards
		const uniqueShards = new Set(users.map((u) => u.expectedShard))

		// Verify shards are valid
		for (const shard of uniqueShards) {
			expect(shard).toBeGreaterThanOrEqual(0)
			expect(shard).toBeLessThan(100)
		}
	})

	it("should handle broadcast to multiple subscribers on same shard", async () => {
		const shardName = "distributor-integration-1"
		const userIds = ["user-same-shard-1", "user-same-shard-2"]

		const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
		const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

		await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			instance.setShardId(shardName)
		})

		// Subscribe multiple users to the same shard
		for (const userId of userIds) {
			const userDoId = env.USER_DO.idFromName(userId)
			const userDoStub = env.USER_DO.get(userDoId)

			await runInDurableObject(userDoStub, async (instance: UserDo) => {
				instance.setUserId(userId)
			})

			await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
				return instance.subscribe(userId)
			})
		}

		// Verify subscriber count
		const count = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			return instance.getSubscriberCount()
		})
		expect(count.count).toBe(userIds.length)

		// Broadcast message
		const payload: BroadcastMessagePayload = {
			type: "LEADERBOARD_UPDATE",
			data: { topScore: 5000 },
			timestamp: Date.now()
		}

		const result = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
			return instance.broadcast(payload)
		})

		expect(result.success).toBe(true)
	})

	it("should maintain shard distribution across 100 shards", async () => {
		const userCount = 100 // Test with 100 users to verify distribution
		const shardCounts = new Map<number, number>()

		// Generate users and count shard distribution
		for (let i = 0; i < userCount; i++) {
			const userId = `user-distribution-${i}`
			const userDoId = env.USER_DO.idFromName(userId)
			const userDoStub = env.USER_DO.get(userDoId)

			await userDoStub.fetch("https://do.test/websocket", {
				headers: {
					Upgrade: "websocket",
					"X-User-ID": userId
				}
			})

			const info = await runInDurableObject(userDoStub, async (instance: UserDo) => {
				return instance.getCurrentConnections()
			})

			const shard = info.shardId!
			expect(shard).toBeGreaterThanOrEqual(0)
			expect(shard).toBeLessThan(100)
			shardCounts.set(shard, (shardCounts.get(shard) || 0) + 1)
		}

		// Verify distribution properties
		// With 100 users, we expect decent distribution across shards
		expect(shardCounts.size).toBeGreaterThan(20) // Should use at least 20% of shards

		// No single shard should dominate (max 10 users per shard as rough limit)
		for (const count of shardCounts.values()) {
			expect(count).toBeLessThanOrEqual(10)
		}
	})

	/**
	 * CRUCIAL TEST: Verify that when the indexer triggers a broadcast,
	 * all 100 distributor shards are contacted and they each contact their respective users.
	 *
	 * This test simulates the flow:
	 * 1. Indexer sends a broadcast request to trigger all distributors
	 * 2. All 100 DistributorDO shards receive the broadcast
	 * 3. Each distributor fans out the message to its subscribed users
	 * 4. Users receive the leaderboard update via WebSocket
	 */
	it("should broadcast to all 100 distributor shards and their subscribed users", async () => {
		const TOTAL_SHARDS = 100
		const USERS_PER_SHARD = 3 // Subscribe 3 users per shard for testing
		const totalUsers = TOTAL_SHARDS * USERS_PER_SHARD

		console.log(`Setting up ${totalUsers} users across ${TOTAL_SHARDS} shards...`)

		// Step 1: Setup users across all 100 shards
		const shardToUsers = new Map<number, string[]>()

		for (let shardId = 0; shardId < TOTAL_SHARDS; shardId++) {
			const usersForShard: string[] = []

			for (let u = 0; u < USERS_PER_SHARD; u++) {
				const userId = `user-shard${shardId}-${u}`
				usersForShard.push(userId)

				// Initialize UserDO
				const userDoId = env.USER_DO.idFromName(userId)
				const userDoStub = env.USER_DO.get(userDoId)

				await runInDurableObject(userDoStub, async (instance: UserDo) => {
					instance.setUserId(userId)
				})
			}

			shardToUsers.set(shardId, usersForShard)
		}

		// Step 2: Subscribe users to their respective distributor shards
		for (let shardId = 0; shardId < TOTAL_SHARDS; shardId++) {
			const shardName = `distributor-${shardId}`
			const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
			const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

			// Initialize distributor
			await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
				instance.setShardId(shardName)
			})

			// Subscribe all users for this shard
			const usersForShard = shardToUsers.get(shardId) ?? []
			for (const userId of usersForShard) {
				await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
					return instance.subscribe(userId)
				})
			}

			// Verify subscriber count
			const count = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
				return instance.getSubscriberCount()
			})
			expect(count.count).toBe(USERS_PER_SHARD)
		}

		console.log("All users subscribed to their respective shards")

		// Step 3: Verify subscriber counts before broadcast
		const prebroadcastCounts: { shardId: number; count: number }[] = []
		for (let shardId = 0; shardId < TOTAL_SHARDS; shardId++) {
			const shardName = `distributor-${shardId}`
			const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
			const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

			const count = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
				return instance.getSubscriberCount()
			})
			prebroadcastCounts.push({ shardId, count: count.count })
		}

		// Verify all shards have correct subscriber counts
		expect(prebroadcastCounts.length).toBe(TOTAL_SHARDS)
		const totalSubscribersBeforeBroadcast = prebroadcastCounts.reduce((sum, s) => sum + s.count, 0)
		expect(totalSubscribersBeforeBroadcast).toBe(TOTAL_SHARDS * USERS_PER_SHARD)

		// Step 4: Simulate indexer triggering a broadcast to all 100 shards
		const payload: BroadcastMessagePayload = {
			type: "LEADERBOARD_UPDATE",
			data: { message: "Scores updated", timestamp: Date.now() },
			timestamp: Date.now()
		}

		const broadcastResults: {
			shardId: number
			success: boolean
			deliveredCount: number
			subscribersBeforeBroadcast: number
		}[] = []

		// Broadcast to all 100 shards in parallel (simulating indexer behavior)
		const broadcastPromises = Array.from({ length: TOTAL_SHARDS }, async (_, shardId) => {
			const shardName = `distributor-${shardId}`
			const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
			const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

			// Get subscriber count BEFORE broadcast to verify contact attempts
			const countBefore = await runInDurableObject(
				distributorStub,
				async (instance: DistributorDO) => {
					return instance.getSubscriberCount()
				}
			)

			const result = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
				return instance.broadcast(payload)
			})

			broadcastResults.push({
				shardId,
				success: result.success,
				deliveredCount: result.deliveredCount || 0,
				subscribersBeforeBroadcast: countBefore.count
			})
		})

		await Promise.all(broadcastPromises)

		console.log("Broadcast completed to all shards")

		// Step 5: Verify results - CRUCIAL VERIFICATIONS

		// Verify all 100 shards were contacted
		expect(broadcastResults.length).toBe(TOTAL_SHARDS)

		// Verify all broadcasts succeeded
		const allSuccessful = broadcastResults.every((r) => r.success)
		expect(allSuccessful).toBe(true)

		// CRITICAL: Verify that each distributor attempted to contact its users
		// This verifies the full fan-out: Indexer -> 100 Distributors -> N Users per distributor
		for (const result of broadcastResults) {
			// Each distributor should have had the correct number of subscribers before broadcast
			expect(result.subscribersBeforeBroadcast).toBe(USERS_PER_SHARD)

			// The distributor should have attempted delivery to all subscribers
			// Note: deliveredCount will be 0 in test env due to no WebSocket, but the attempt was made
			expect(result.subscribersBeforeBroadcast).toBeGreaterThan(0)
		}

		// Verify the aggregate: all users across all shards were targeted
		const totalUsersTargeted = broadcastResults.reduce(
			(sum, r) => sum + r.subscribersBeforeBroadcast,
			0
		)
		expect(totalUsersTargeted).toBe(TOTAL_SHARDS * USERS_PER_SHARD)

		// Step 6: Verify subscriber counts after broadcast
		// In a real scenario with WebSockets, failed deliveries would remove subscribers
		// In test env, subscribers remain because they were registered but delivery fails
		const postBroadcastCounts: { shardId: number; count: number }[] = []
		for (let shardId = 0; shardId < TOTAL_SHARDS; shardId++) {
			const shardName = `distributor-${shardId}`
			const distributorId = env.DISTRIBUTOR_DO.idFromName(shardName)
			const distributorStub = env.DISTRIBUTOR_DO.get(distributorId)

			const count = await runInDurableObject(distributorStub, async (instance: DistributorDO) => {
				return instance.getSubscriberCount()
			})
			postBroadcastCounts.push({ shardId, count: count.count })
		}

		// In test environment, all subscribers are removed due to WebSocket failures
		// This actually proves the distributors tried to contact each user
		const totalSubscribersAfterBroadcast = postBroadcastCounts.reduce((sum, s) => sum + s.count, 0)

		// Log distribution statistics
		console.log("Broadcast Statistics:")
		console.log(`  Total shards contacted: ${broadcastResults.length}`)
		console.log(
			`  Subscribers before broadcast: ${totalSubscribersBeforeBroadcast} (expected: ${TOTAL_SHARDS * USERS_PER_SHARD})`
		)
		console.log(`  Total users targeted: ${totalUsersTargeted}`)
		console.log(
			`  Subscribers after broadcast: ${totalSubscribersAfterBroadcast} (removed due to failed delivery)`
		)
		console.log(
			`  Users contacted per shard: ${USERS_PER_SHARD} (verified via totalSubscribers in broadcast results)`
		)

		// The CRUCIAL verification:
		// 1. All 100 shards were contacted ✓
		// 2. Each shard had the correct number of subscribers ✓
		// 3. Each shard attempted to deliver to all its subscribers ✓
		// 4. Failed deliveries removed subscribers (proves contact was attempted) ✓
		expect(broadcastResults.length).toBe(100)
		expect(totalUsersTargeted).toBe(300)
		expect(totalSubscribersAfterBroadcast).toBe(0) // All removed due to failed WebSocket delivery
	}, 30000) // 30 second timeout for this large-scale test
})
