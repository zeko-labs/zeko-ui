import { describe, expect, it } from "vitest"
import { statusFromState } from "../../app/helpers"

describe("statusFromState", () => {
	it("maps cancelled done state to cancelled status", () => {
		expect(statusFromState("BRIDGE_OPERATION_CANCELLED_DONE", "deposit")).toEqual({
			text: "Cancelled",
			kind: "cancelled"
		})
	})

	it("maps generic done state to completed status", () => {
		expect(statusFromState("BRIDGE_OPERATION_DONE", "deposit")).toEqual({
			text: "Deposit Completed",
			kind: "complete"
		})
	})
})
