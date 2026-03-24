import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterEach, describe, expect, it, vi } from "vitest"

const { logger } = vi.hoisted(() => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}))

vi.mock("../src/helper", () => ({
	logger
}))

vi.mock("../src/db", () => ({
	clearAllTables: vi.fn()
}))

vi.mock("../src/modules/inner", () => ({
	handler: vi.fn(),
	rebuild: vi.fn()
}))

vi.mock("../src/modules/outer", () => ({
	handler: vi.fn(),
	rebuild: vi.fn()
}))

import { Indexer, runIndexingLoop } from "../src/indexer"

describe("Actions Indexer basic tests", () => {
	const db = {} as PostgresJsDatabase

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should create indexer and return status", () => {
		const indexer = new Indexer(db, { autostart: false })
		const status = indexer.getStatus()

		expect(status).toHaveProperty("isRunning")
		expect(status).toHaveProperty("config")
	})

	it("should start and stop indexer", async () => {
		const indexer = new Indexer(db, {
			autostart: false,
			loopDeps: {
				outer: async () => ({ lastFetchedBlock: 1 }),
				inner: async () => ({ lastFetchedBlock: 2 }),
				wait: async () => {}
			}
		})

		const start = indexer.start({ intervalSeconds: 1 })
		expect(start.success).toBeTruthy()

		const stop = await indexer.stop()
		expect(stop.success).toBeTruthy()
	})

	it("keeps successful outer progress when inner fails", async () => {
		const waitCalls: number[] = []
		const state = {
			isRunning: true,
			lastRunTimestamp: null,
			lastFetchedBlock: { outer: 4, inner: 9 },
			consecutiveErrors: 2,
			config: { intervalSeconds: 3 }
		}
		const outer = vi.fn().mockResolvedValue({ lastFetchedBlock: 11 })
		const inner = vi.fn().mockRejectedValue(new Error("inner failed"))

		await runIndexingLoop(db, state, new AbortController().signal, {
			outer,
			inner,
			now: () => 123456,
			wait: async (seconds) => {
				waitCalls.push(seconds)
				state.isRunning = false
			}
		})

		expect(outer).toHaveBeenCalledOnce()
		expect(inner).toHaveBeenCalledOnce()
		expect(state.lastFetchedBlock).toEqual({ outer: 11, inner: 9 })
		expect(state.lastRunTimestamp).toBe(123456)
		expect(state.consecutiveErrors).toBe(0)
		expect(waitCalls).toEqual([3])
		expect(logger.warn).toHaveBeenCalledWith(
			"[runIndexingLoop] inner iteration failed: inner failed"
		)
		expect(logger.info).toHaveBeenCalledWith("runIndexingLoop: finished run (outer=11, inner=9)")
	})

	it("keeps successful inner progress when outer fails with missing parents", async () => {
		const waitCalls: number[] = []
		const state = {
			isRunning: true,
			lastRunTimestamp: null,
			lastFetchedBlock: { outer: 6, inner: 2 },
			consecutiveErrors: 1,
			config: { intervalSeconds: 5 }
		}
		const outerError = Object.assign(new Error("outer ordering failed"), {
			missingParents: ["a", "b", "c"]
		})
		const outer = vi.fn().mockRejectedValue(outerError)
		const inner = vi.fn().mockResolvedValue({ lastFetchedBlock: 14 })

		await runIndexingLoop(db, state, new AbortController().signal, {
			outer,
			inner,
			now: () => 654321,
			wait: async (seconds) => {
				waitCalls.push(seconds)
				state.isRunning = false
			}
		})

		expect(state.lastFetchedBlock).toEqual({ outer: 6, inner: 14 })
		expect(state.lastRunTimestamp).toBe(654321)
		expect(state.consecutiveErrors).toBe(0)
		expect(waitCalls).toEqual([5])
		expect(logger.error).toHaveBeenCalledWith("runIndexingLoop outer error:", outerError)
		expect(logger.warn).toHaveBeenCalledWith(
			"[runIndexingLoop] outer ordering failed; missing parents:",
			"3 (sample: a, b, c)"
		)
	})

	it("backs off only when both handlers fail", async () => {
		const waitCalls: number[] = []
		const state = {
			isRunning: true,
			lastRunTimestamp: null,
			lastFetchedBlock: { outer: 1, inner: 2 },
			consecutiveErrors: 0,
			config: { intervalSeconds: 4 }
		}
		const outer = vi.fn().mockRejectedValue(new Error("outer failed"))
		const inner = vi.fn().mockRejectedValue(new Error("inner failed"))

		await runIndexingLoop(db, state, new AbortController().signal, {
			outer,
			inner,
			now: () => 999999,
			wait: async (seconds) => {
				waitCalls.push(seconds)
				state.isRunning = false
			}
		})

		expect(state.lastFetchedBlock).toEqual({ outer: 1, inner: 2 })
		expect(state.lastRunTimestamp).toBeNull()
		expect(state.consecutiveErrors).toBe(1)
		expect(waitCalls).toEqual([5])
		expect(logger.info).toHaveBeenCalledWith("Linear backoff: retrying in 5s")
		expect(logger.warn).toHaveBeenCalledWith(
			"[runIndexingLoop] outer iteration failed: outer failed"
		)
		expect(logger.warn).toHaveBeenCalledWith(
			"[runIndexingLoop] inner iteration failed: inner failed"
		)
	})
})
