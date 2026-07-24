import { describe, expect, it } from "vitest"
import { filterArchiveActionsToRange } from "../src/archive-range"

describe("archive action range filtering", () => {
	it("drops blocks outside the requested half-open range", () => {
		const actions = [
			{ blockInfo: { height: 2 }, actionData: [] },
			{ blockInfo: { height: 3 }, actionData: [] },
			{ blockInfo: { height: 4 }, actionData: [] },
			{ blockInfo: { height: 5 }, actionData: [] },
			{ blockInfo: null, actionData: [] }
		]

		expect(filterArchiveActionsToRange(actions, 3, 5)).toEqual(actions.slice(1, 3))
	})
})
