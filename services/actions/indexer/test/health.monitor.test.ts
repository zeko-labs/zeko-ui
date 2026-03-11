import { describe, expect, it } from "vitest"
import {
	computeHealthStatus,
	createCanonicalProgressMonitor,
	createDatabaseHealthMonitor
} from "../src/health"

describe("health monitor", () => {
	it("returns healthy when snapshot is stale but indexer is running", () => {
		const now = 2_000
		const result = computeHealthStatus({
			now,
			dbHealth: {
				healthy: false,
				latency: 10,
				checkedAt: 1,
				error: "timeout"
			},
			canonicalProgress: {
				checkedAt: 1,
				outer: {
					lastFinalIndex: 10,
					lastFinalBlockHeight: 100,
					nonCanonicalTailCount: 2
				},
				inner: {
					lastFinalIndex: 5,
					lastFinalBlockHeight: 50,
					nonCanonicalTailCount: 1
				}
			},
			indexerStatus: {
				isRunning: true,
				lastFetchedBlock: { outer: 1, inner: 1 },
				consecutiveErrors: 0
			},
			staleAfterMs: 500
		})

		expect(result.httpStatus).toBe(200)
		expect(result.response.status).toBe("healthy")
		expect(result.response.indexer.canonicalProgress.outer.nonCanonicalTailCount).toBe(2)
	})

	it("returns cached snapshot immediately while refresh is pending", () => {
		const monitor = createDatabaseHealthMonitor({
			refreshIntervalMs: 10_000,
			check: async () => {
				await new Promise((resolve) => setTimeout(resolve, 100))
				return { healthy: true, latency: 5 }
			}
		})

		monitor.start()
		const startedAt = Date.now()
		const snapshot = monitor.getSnapshot()
		const elapsed = Date.now() - startedAt
		monitor.stop()

		expect(elapsed).toBeLessThan(20)
		expect(snapshot.checkedAt).toBeNull()
		expect(snapshot.error).toBe("health check pending")
	})

	it("returns cached canonical progress immediately while refresh is pending", () => {
		const monitor = createCanonicalProgressMonitor({
			refreshIntervalMs: 10_000,
			check: async () => {
				await new Promise((resolve) => setTimeout(resolve, 100))
				return {
					outer: {
						lastFinalIndex: 10,
						lastFinalBlockHeight: 100,
						nonCanonicalTailCount: 1
					},
					inner: {
						lastFinalIndex: 5,
						lastFinalBlockHeight: 50,
						nonCanonicalTailCount: 0
					}
				}
			}
		})

		monitor.start()
		const startedAt = Date.now()
		const snapshot = monitor.getSnapshot()
		const elapsed = Date.now() - startedAt
		monitor.stop()

		expect(elapsed).toBeLessThan(20)
		expect(snapshot.checkedAt).toBeNull()
		expect(snapshot.error).toBe("canonical progress pending")
		expect(snapshot.outer.nonCanonicalTailCount).toBe(0)
	})

	it("returns defensive copies for canonical progress snapshots", () => {
		const monitor = createCanonicalProgressMonitor({
			refreshIntervalMs: 10_000,
			check: async () => ({
				outer: {
					lastFinalIndex: 10,
					lastFinalBlockHeight: 100,
					nonCanonicalTailCount: 1
				},
				inner: {
					lastFinalIndex: 5,
					lastFinalBlockHeight: 50,
					nonCanonicalTailCount: 0
				}
			})
		})

		const first = monitor.getSnapshot()
		first.outer.nonCanonicalTailCount = 99

		const second = monitor.getSnapshot()
		expect(second.outer.nonCanonicalTailCount).toBe(0)
	})

	it("does not expose canonical progress references in health responses", () => {
		const canonicalProgress = {
			checkedAt: 1,
			outer: {
				lastFinalIndex: 10,
				lastFinalBlockHeight: 100,
				nonCanonicalTailCount: 2
			},
			inner: {
				lastFinalIndex: 5,
				lastFinalBlockHeight: 50,
				nonCanonicalTailCount: 1
			}
		}

		const result = computeHealthStatus({
			now: 2_000,
			dbHealth: {
				healthy: true,
				latency: 10,
				checkedAt: 1
			},
			canonicalProgress,
			indexerStatus: {
				isRunning: true,
				lastFetchedBlock: { outer: 1, inner: 1 },
				consecutiveErrors: 0
			},
			staleAfterMs: 500
		})

		result.response.indexer.canonicalProgress.outer.nonCanonicalTailCount = 42
		result.response.indexer.lastFetchedBlock.outer = 99

		expect(canonicalProgress.outer.nonCanonicalTailCount).toBe(2)
		expect(canonicalProgress.inner.nonCanonicalTailCount).toBe(1)
	})
})
