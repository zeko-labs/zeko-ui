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

	it("applies the same half-open range to archive event pages", () => {
		const events = [
			{ blockInfo: { height: 9 }, eventData: [] },
			{ blockInfo: { height: 10 }, eventData: [] },
			{ blockInfo: { height: 11 }, eventData: [] },
			{ blockInfo: { height: 12 }, eventData: [] }
		]

		expect(filterArchiveActionsToRange(events, 10, 12)).toEqual(events.slice(1, 3))
	})
})
