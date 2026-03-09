import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { createTestDatabase } from "../src/db"
import { Indexer } from "../src/indexer"

describe("Actions Indexer basic tests", () => {
	let db: ReturnType<typeof createTestDatabase>["db"]
	let clean: ReturnType<typeof createTestDatabase>["clean"]

	beforeAll(() => {
		const { db: _db, clean: _clean } = createTestDatabase()
		_clean()
		db = _db
		clean = _clean
	})

	afterEach(() => {
		clean()
	})

	it("should create indexer and return status", () => {
		const indexer = new Indexer(db)
		const s = indexer.getStatus()
		expect(s).toHaveProperty("isRunning")
		expect(s).toHaveProperty("config")
	})

	it("should start and stop indexer", async () => {
		const indexer = new Indexer(db)
		// stop auto-start so we can test start behavior
		await indexer.stop()
		const start = indexer.start({ intervalSeconds: 1 })
		expect(start.success).toBeTruthy()
		const stop = await indexer.stop()
		expect(stop.success).toBeTruthy()
	})
})
