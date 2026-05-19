import { describe, expect, it } from "vitest"
import { filterBridgeVersionOperations } from "~~/machines/bridgeVersions"

describe("filterBridgeVersionOperations", () => {
	it("keeps bridge version 2 operations and removes legacy bridge version 1 operations", () => {
		const operations = [
			{ id: "legacy-deposit", bridgeVersion: 1 },
			{ id: "current-deposit", bridgeVersion: 2 },
			{ id: "current-withdrawal", bridgeVersion: 2 }
		] as const

		expect(filterBridgeVersionOperations(operations).map((operation) => operation.id)).toEqual([
			"current-deposit",
			"current-withdrawal"
		])
	})
})
