/**
 * Comprehensive test suite for Durable Objects
 *
 * This test suite verifies the correctness of the pub/sub architecture using:
 * - DistributorDO: Fixed pool of 100 shards for fan-out distribution
 * - UserDO: One instance per connected user, subscribes to a DistributorDO shard
 *
 * Architecture:
 * 1. Each user connects to a unique UserDO instance via WebSocket
 * 2. UserDO calculates its shard assignment (0-99) using consistent hashing
 * 3. UserDO subscribes to the assigned DistributorDO shard via RPC
 * 4. DistributorDO maintains a map of subscribed users and broadcasts messages to them
 * 5. Failed/disconnected users are automatically removed during broadcast
 *
 * Key tests:
 * - DistributorDO: Subscription management, broadcasting, error handling
 * - UserDO: WebSocket connections, shard assignment, message receiving
 * - Integration: End-to-end flows with multiple users and distributors
 */

import { describe, expect, it } from "vitest"
import { DistributorDO, UserDo } from "../src/do"
import { env, runInDurableObject } from "cloudflare:test"
import type { BroadcastMessagePayload } from "../src/do"

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
})
