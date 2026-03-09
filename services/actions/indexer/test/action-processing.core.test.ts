import { describe, expect, it } from "vitest"
import { processArchiveBlocks } from "../src/action-processing/core"
import { generateSyntheticArchiveBlocks } from "../src/benchmark/action-processing-synthetic"

describe("action-processing core", () => {
	it("produces deterministic event count for valid blocks", () => {
		const blocks = generateSyntheticArchiveBlocks({
			blockCount: 3,
			actionsPerBlock: 4,
			fieldsPerAction: 3,
			seed: 7
		})

		const result = processArchiveBlocks({ blocks, strategy: "main" })

		expect(result.events).toHaveLength(12)
		expect(result.stats.blocks).toBe(3)
		expect(result.stats.events).toBe(12)
		expect(result.stats.strategy).toBe("main")
	})

	it("throws when a block action state does not match computed hash chain", () => {
		const blocks = generateSyntheticArchiveBlocks({
			blockCount: 2,
			actionsPerBlock: 2,
			fieldsPerAction: 2,
			seed: 11
		})
		blocks[0].actionState.actionStateOne = "0"

		expect(() => processArchiveBlocks({ blocks, strategy: "main" })).toThrow(
			"invalid actions sequence in block"
		)
	})
})
