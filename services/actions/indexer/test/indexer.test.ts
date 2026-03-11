import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { createTestDatabase } from "../src/db"
import { Indexer } from "../src/indexer"

describe("Actions Indexer basic tests", () => {
	let db: ReturnType<typeof createTestDatabase>["db"]
	let clean: ReturnType<typeof createTestDatabase>["clean"]

	beforeAll(async () => {
		const { db: testDb, clean: cleanDb } = createTestDatabase()
		await cleanDb()
		db = testDb
		clean = cleanDb
	})

	afterEach(async () => {
		await clean()
	})

	it("should create indexer and return status", () => {
		const indexer = new Indexer(db, { autostart: false })
		const s = indexer.getStatus()
		expect(s).toHaveProperty("isRunning")
		expect(s).toHaveProperty("config")
	})

	it("should start and stop indexer", async () => {
		const indexer = new Indexer(db, { autostart: false })
		const start = indexer.start({ intervalSeconds: 1 })
		expect(start.success).toBeTruthy()
		const stop = await indexer.stop()
		expect(stop.success).toBeTruthy()
	})
})
