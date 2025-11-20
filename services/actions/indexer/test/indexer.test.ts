import { describe, expect, it } from "vitest"
import { createTestDatabase } from "../src/db"
import { Indexer } from "../src/indexer"

describe("Actions Indexer basic tests", () => {
	it("should create indexer and return status", () => {
		const { db, clean } = createTestDatabase()
		const indexer = new Indexer(db)
		const s = indexer.getStatus()
		expect(s).toHaveProperty("isRunning")
		expect(s).toHaveProperty("config")
		// Clean up DB
		clean()
	})

	it("should start and stop indexer", () => {
		const { db, clean } = createTestDatabase()
		const indexer = new Indexer(db)
		// stop auto-start so we can test start behavior
		indexer.stop()
		const start = indexer.start({ intervalSeconds: 1 })
		expect(start.success).toBeTruthy()
		const stop = indexer.stop()
		expect(stop.success).toBeTruthy()
		clean()
	})
})
