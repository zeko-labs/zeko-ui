import { describe, expect, it } from "vitest"
import { runActionProcessingBench } from "../src/benchmark/action-processing-bench"

describe("action-processing bench workflow", () => {
	it("exposes benchmark runner", () => {
		expect(typeof runActionProcessingBench).toBe("function")
	})
})
