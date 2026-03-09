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

	it("falls back to main when worker process script is unavailable", async () => {
		const blocks = generateSyntheticArchiveBlocks({
			blockCount: 2,
			actionsPerBlock: 2,
			fieldsPerAction: 2,
			seed: 9
		})
		const result = await runActionProcessing({
			blocks,
			preferWorker: true,
			fallbackToMain: true
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
				preferWorker: true,
				fallbackToMain: false
			})
		).rejects.toThrow("action-processing process file not found")
	})
})
