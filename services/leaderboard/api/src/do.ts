/*
 * DistributorDO and UserDo
 * There are 100 DistributorDO shards and many UserDOs.
 * Each user will be assigned a random ID and will connect to a unique DO instance.
 * Each UserDO subscribes to one of the 100 DistributorDO shards using consistent hashing.
 * The DistributorDO will broadcast updates to all subscribed UserDOs via RPC.
 */

import { DurableObject } from "cloudflare:workers"

/**
 * Payload structure for broadcast messages
 */
export interface BroadcastMessagePayload {
	type: string
	data: unknown
	timestamp?: number
}

/**
 * DistributorDO - Fixed pool of 100 shards for fan-out distribution
 * Each shard maintains a list of subscribed UserDOs and broadcasts messages to them.
 */
export class DistributorDO extends DurableObject<Env> {
	#subscribers: Map<string, DurableObjectStub<UserDo>>
	#shardId: string | null = null

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.#subscribers = new Map()
	}

	/**
	 * Set the shard ID for this distributor.
	 * Should be called once when the DO is first accessed.
	 */
	setShardId(shardId: string) {
		this.#shardId = shardId
	}

	/**
	 * Subscribe a UserDO to this distributor shard.
	 * Called via RPC from UserDO when a user connects.
	 * The distributor creates its own stub to the UserDO.
	 */
	async subscribe(userId: string) {
		const userDoId = this.env.USER_DO.idFromName(userId)
		const userDoStub = this.env.USER_DO.get(userDoId)

		this.#subscribers.set(userId, userDoStub)
		console.log(
			`[DistributorDO:${this.#shardId}] User ${userId} subscribed. Total subscribers: ${this.#subscribers.size}`
		)
		return { success: true, subscriberCount: this.#subscribers.size }
	}

	/**
	 * Broadcast a message to all subscribed UserDOs.
	 * Called via RPC from the Indexing Service.
	 * Fans out to all subscribers in parallel.
	 * Automatically removes failed/disconnected subscribers.
	 */
	async broadcast(payload: BroadcastMessagePayload) {
		if (this.#subscribers.size === 0) {
			console.log(`[DistributorDO:${this.#shardId}] No subscribers to broadcast to`)
			return { success: true, deliveredCount: 0 }
		}

		console.log(
			`[DistributorDO:${this.#shardId}] Broadcasting to ${this.#subscribers.size} subscribers`
		)

		const promises = Array.from(this.#subscribers.entries()).map(([userId, stub]) =>
			stub.receiveMessage(payload).catch((error) => {
				console.error(
					`[DistributorDO:${this.#shardId}] Failed to deliver to user ${userId}:`,
					error
				)
				this.#subscribers.delete(userId)
				return null
			})
		)

		const results = await Promise.allSettled(promises)
		const deliveredCount = results.filter(
			(r) => r.status === "fulfilled" && r.value !== null
		).length
		const totalSubscribers = this.#subscribers.size
		console.log(
			`[DistributorDO:${this.#shardId}] Broadcast complete. Delivered: ${deliveredCount}/${totalSubscribers}`
		)

		return { success: true, deliveredCount, totalSubscribers }
	}

	/**
	 * Get the current number of subscribers.
	 * Useful for monitoring and debugging.
	 */
	async getSubscriberCount() {
		return { shardId: this.#shardId, count: this.#subscribers.size }
	}
}

/**
 * UserDO - One instance per connected user
 * Manages the WebSocket connection to the API Service and subscribes to a DistributorDO shard.
 */
export class UserDo extends DurableObject<Env> {
	#userId: string | null = null
	#distributorShardId: number | null = null
	#isSubscribed = false

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)

		// hibernation
		const sockets = this.ctx.getWebSockets()
		if (sockets.length > 0) {
			const attachment = sockets[0].deserializeAttachment()
			if (attachment?.userId) {
				this.#userId = attachment.userId
				this.#distributorShardId = attachment.shardId
				this.#isSubscribed = attachment.isSubscribed
			}
		}
	}

	/**
	 * Set the user ID for this UserDO.
	 * Should be called once when the DO is first accessed.
	 */
	setUserId(userId: string) {
		this.#userId = userId
	}

	/**
	 * HTTP fetch handler for WebSocket upgrade requests from the API Service.
	 */
	async fetch(request: Request) {
		if (request.url.endsWith("/websocket")) {
			const upgradeHeader = request.headers.get("Upgrade")
			if (!upgradeHeader || upgradeHeader !== "websocket") {
				return new Response("Durable Object expected Upgrade: websocket", { status: 426 })
			}

			const userId = request.headers.get("X-User-ID") ?? `anon-${crypto.randomUUID()}`

			return this.createWebSocketClientResponse(userId)
		}
		return new Response(`
        - /websocket : Creates a WebSocket connection. Optionally provide X-User-ID header.
      `)
	}

	/**
	 * Create a WebSocket client with an Hibernating DO and returns it.
	 * The fetch handler is still needed as trying to use this directly over RPC will result in an error :
	 * Could not serialize object of type "WebSocket". This type does not support serialization.
	 */
	createWebSocketClientResponse(userId: string) {
		const webSocketPair = new WebSocketPair()
		const [client, server] = Object.values(webSocketPair)
		if (!client || !server) throw new Error("Failed to create WebSocket pair.")

		const distributorShardId = this.calculateShardId(userId)
		this.#distributorShardId = distributorShardId

		// hibernation
		server.serializeAttachment({
			userId,
			shardId: distributorShardId,
			isSubscribed: false
		})
		this.ctx.acceptWebSocket(server)

		this.subscribeToDistributor(userId).catch((error) => {
			console.error(`[UserDO:${userId}] Failed to subscribe to distributor:`, error)
		})

		return new Response(null, { status: 101, webSocket: client })
	}

	/**
	 * Subscribe this UserDO to its assigned DistributorDO shard.
	 * Uses consistent hashing to determine which shard to subscribe to.
	 */
	private async subscribeToDistributor(userId: string) {
		if (this.#isSubscribed || this.#distributorShardId === null) return

		const distributorName = `distributor-${this.#distributorShardId}`

		const distributorId = this.env.DISTRIBUTOR_DO.idFromName(distributorName)
		const distributorStub = this.env.DISTRIBUTOR_DO.get(distributorId)
		distributorStub.setShardId(distributorName)

		await distributorStub.subscribe(userId)
		this.#isSubscribed = true

		console.log(`[UserDO:${userId}] Subscribed to distributor shard ${this.#distributorShardId}`)
	}

	/**
	 * Calculate which DistributorDO shard this user belongs to (0-99).
	 * Uses a simple hash function for consistent distribution.
	 */
	private calculateShardId(userId: string): number {
		let hash = 0
		for (let i = 0; i < userId.length; i++) {
			const char = userId.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return Math.abs(hash) % 100
	}

	/**
	 * RPC method called by DistributorDO to deliver a broadcast message.
	 * This forwards the message to the connected WebSocket client.
	 * If the WebSocket is closed, this will throw an error, causing the
	 * DistributorDO to automatically remove this subscriber.
	 */
	async receiveMessage(payload: BroadcastMessagePayload) {
		const sockets = this.ctx.getWebSockets()
		if (sockets.length === 0) {
			console.warn(`[UserDO:${this.#userId}] No active WebSocket connections`)
			throw new Error("No active WebSocket connections")
		}

		const message = JSON.stringify(payload)
		for (const ws of sockets) {
			try {
				ws.send(message)
			} catch (error) {
				console.error(`[UserDO:${this.#userId}] Failed to send message:`, error)
				throw error
			}
		}

		return { success: true, deliveredTo: sockets.length }
	}

	// The WebSocket is server-to-client only for broadcasts.
	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		const attachment = ws.deserializeAttachment()
		const userId = attachment?.userId ?? "unknown"
		console.log(`[UserDO:${userId}] Client message received (unexpected):`, { message })
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		const attachment = ws.deserializeAttachment()
		const userId = attachment?.userId ?? "unknown"
		console.log(`[UserDO:${userId}] WebSocket closed:`, {
			code,
			reason,
			wasClean,
			remainingConnections: this.ctx.getWebSockets().length
		})

		ws.close(code, "Durable Object is closing WebSocket")
	}

	/**
	 * Return the number of currently connected WebSocket clients.
	 * Useful for monitoring and debugging.
	 */
	async getCurrentConnections() {
		return {
			userId: this.#userId,
			connections: this.ctx.getWebSockets().length,
			isSubscribed: this.#isSubscribed,
			shardId: this.#distributorShardId
		}
	}
}
