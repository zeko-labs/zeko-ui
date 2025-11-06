import { Client, fetchExchange } from "@urql/core"
import { Repeater } from "graphql-yoga"
import { builder } from "../builder"
import type { BroadcastMessagePayload } from "../do"
import { getMaxBlockHeightL2 } from "../helpers/utils"

interface LeaderboardUpdateData {
	maxBlockHeight: number
	hasNewEntries: boolean
	timestamp: number
}

const LeaderboardUpdate = builder.objectRef<LeaderboardUpdateData>("LeaderboardUpdate").implement({
	fields: (t) => ({
		maxBlockHeight: t.exposeInt("maxBlockHeight", { nullable: false }),
		hasNewEntries: t.exposeBoolean("hasNewEntries", { nullable: false }),
		timestamp: t.exposeFloat("timestamp", { nullable: false })
	})
})

const client = new Client({
	url: "https://archive.testnet.zeko.io/graphql",
	exchanges: [fetchExchange]
})

builder.subscriptionType({
	fields: (t) => ({
		onNewTransaction: t.field({
			type: LeaderboardUpdate,
			subscribe: async (_root, _args, { env }) => {
				const userId = `subscriber-${crypto.randomUUID()}`

				console.log("[Subscription] Initializing UserDO for", userId)
				const userDoId = env.USER_DO.idFromName(userId)
				const userDoStub = env.USER_DO.get(userDoId)

				console.log("[Subscription] Attempting to connect to UserDO WebSocket...")
				const response = await userDoStub.fetch("http://do/websocket", {
					headers: { Upgrade: "websocket", "X-User-ID": userId }
				})

				const ws = response.webSocket
				if (!ws) throw new Error("No websocket connection")

				console.log("[Subscription] WebSocket connection established")
				ws.accept()
				const maxBlockHeight = await getMaxBlockHeightL2(client)
				return new Repeater<LeaderboardUpdateData>(async (push, stop) => {
					push({ maxBlockHeight, hasNewEntries: false, timestamp: Date.now() })
					ws.addEventListener("message", async (message) => {
						console.log(`[Subscription] ${userId} Received message:`, message.data.toString())
						try {
							const payload = JSON.parse(message.data.toString()) as BroadcastMessagePayload
							if (payload.type === "LEADERBOARD_UPDATE") {
								push({
									maxBlockHeight: payload.data.maxBlockHeight,
									hasNewEntries: payload.data.hasNewEntries,
									timestamp: payload.timestamp
								})
							}
						} catch (error) {
							console.error("[Subscription] Error parsing message:", error)
						}
					})

					ws.addEventListener("error", (error) => {
						console.error("[Subscription] WebSocket error:", error)
						stop(new Error("WebSocket error"))
					})

					ws.addEventListener("close", () => {
						console.log("[Subscription] WebSocket closed")
						stop()
					})

					await stop
					console.log("[Subscription] Closing WebSocket connection...")
					ws.close(1000)
				})
			},
			resolve: (update) => update
		})
	})
})
