import { describe, expect, it } from "vitest"
import { runActionProcessing } from "../src/action-processing/runtime"
import { generateSyntheticArchiveBlocks } from "../src/benchmark/action-processing-synthetic"

describe("action-processing runtime", () => {
	it("uses main strategy when worker path is disabled", async () => {
		const blocks = generateSyntheticArchiveBlocks({
			blockCount: 2,
			actionsPerBlock: 2,
			fieldsPerAction: 2,
			seed: 5
		})
		const result = await runActionProcessing({
			blocks,
			preferWorker: false
		})
		expect(result.stats.strategy).toBe("main")
	})

	it("surfaces worker failure when fallback is disabled", async () => {
		const blocks = generateSyntheticArchiveBlocks({
			blockCount: 2,
			actionsPerBlock: 2,
			fieldsPerAction: 2,
			seed: 13
		})
		await expect(
			runActionProcessing({
				blocks,
				preferWorker: true
			})
		).rejects.toThrow("action-processing process file not found")
	})
})
