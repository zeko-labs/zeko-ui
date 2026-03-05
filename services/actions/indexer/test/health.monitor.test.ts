import { describe, expect, it } from "vitest"
import { computeHealthStatus, createDatabaseHealthMonitor } from "../src/health"

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
			indexerStatus: {
				isRunning: true,
				lastFetchedBlock: { outer: 1, inner: 1 },
				consecutiveErrors: 0
			},
			staleAfterMs: 500
		})

		expect(result.httpStatus).toBe(200)
		expect(result.response.status).toBe("healthy")
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
})
