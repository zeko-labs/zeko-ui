import { describe, expect, it } from "vitest"
import { processArchiveBlocks } from "../src/action-processing/core"

describe("action-processing core interface", () => {
	it("exports processArchiveBlocks", () => {
		expect(typeof processArchiveBlocks).toBe("function")
	})
})
