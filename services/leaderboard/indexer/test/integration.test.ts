import { treaty } from "@elysiajs/eden"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { createTestDatabase } from "../src/db"
import { server } from "../src/server"

const { clean } = createTestDatabase()
const authToken = process.env.AUTH_TOKEN || "admin"

beforeAll(async () => {
	await clean()
})

afterAll(async () => {
	await clean()
})

describe("Elysia Server Integration", () => {
	const client = treaty(server)

	describe("Authentication", () => {
		test("should reject requests without bearer token", async () => {
			const { status, error } = await client.status.get()

			expect(status).toBe(401)
			expect(error).toBeDefined()
		})

		test("should reject requests with invalid bearer token", async () => {
			const { status, error } = await client.status.get({
				headers: {
					Authorization: "Bearer wrong-token"
				}
			})

			expect(status).toBe(401)
			expect(error?.value).toMatchObject({
				success: false,
				message: "Unauthorized"
			})
		})

		test("should accept requests with valid bearer token", async () => {
			const { status, error, data } = await client.status.get({
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			})

			expect(status).toBe(200)
			expect(error).toBeNull()
			expect(data).toBeDefined()
		})
	})

	describe("Endpoints", () => {
		test("GET /status should return indexer status", async () => {
			const { data, status } = await client.status.get({
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			})

			expect(status).toBe(200)
			expect(data).toHaveProperty("isRunning")
			expect(data).toHaveProperty("config")
			expect(typeof data?.isRunning).toBe("boolean")
		})

		test("POST /start should start the indexer with config", async () => {
			const { data, status } = await client.start.post(
				{
					startingBlock: 0,
					intervalSeconds: 60
				},
				{
					headers: {
						Authorization: `Bearer ${authToken}`
					}
				}
			)

			expect(status).toBe(200)
			expect(data?.success).toBe(true)
		})

		test("POST /stop should stop the running indexer", async () => {
			const { data, status } = await client.stop.post(undefined, {
				headers: {
					Authorization: `Bearer ${authToken}`
				}
			})

			expect(status).toBe(200)
			expect(data).toHaveProperty("success")
			expect(data?.success).toBe(true)
		})
	})
})
