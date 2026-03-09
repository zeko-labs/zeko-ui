import { describe, expect, it } from "vitest"
import { runActionProcessingStress } from "../src/benchmark/action-processing-stress"

describe("action-processing stress workflow", () => {
	it("runs stress scenario and reports event loop lag", async () => {
		const report = await runActionProcessingStress({
			durationSeconds: 2,
			blockCount: 80,
			actionsPerBlock: 8,
			fieldsPerAction: 6,
			preferWorker: true
		})

		console.info("[action-processing-stress]", report)
		expect(report.runs).toBeGreaterThan(0)
		expect(report.avgRunMs).toBeGreaterThan(0)
	})
})
