import { describe, expect, it } from "vitest"
import { runActionProcessingBench } from "../src/benchmark/action-processing-bench"

describe("action-processing bench workflow", () => {
	it("produces benchmark summary and bottleneck", async () => {
		const report = await runActionProcessingBench({
			blockCount: 120,
			actionsPerBlock: 12,
			fieldsPerAction: 6,
			iterations: 2
		})

		console.info("[action-processing-bench]", report)
		expect(report.workload.eventsPerRun).toBeGreaterThan(0)
		expect(report.main.avgMs).toBeGreaterThan(0)
		expect(report.bottleneck === "hashing" || report.bottleneck === "validation").toBe(true)
	}, 30000)
})
