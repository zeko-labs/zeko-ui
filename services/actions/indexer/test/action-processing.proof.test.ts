import { describe, expect, it } from "vitest"
import { runActionProcessingProof } from "../src/benchmark/action-processing-proof"

describe("action-processing proof", () => {
	it("returns reproducible proof summary with pass/fail", async () => {
		const proof = await runActionProcessingProof({
			blockCount: 20,
			actionsPerBlock: 6,
			fieldsPerAction: 4,
			warmupRuns: 1,
			sampleRuns: 2
		})

		expect(proof.summary.sampleRuns).toBe(2)
		expect(typeof proof.summary.speedupRatio).toBe("number")
		expect(typeof proof.passed).toBe("boolean")
	})
})
