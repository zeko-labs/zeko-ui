import { describe, expect, it } from "vitest"
import { statusFromState } from "../../app/helpers"

describe("statusFromState", () => {
	it("treats cancellation-ready deposits as pending instead of failed", () => {
		expect(statusFromState("CAN_CANCEL", "deposit")).toEqual({
			text: "Ready to cancel",
			kind: "pending"
		})

		expect(statusFromState("PAUSED", "deposit", { canCancel: true })).toEqual({
			text: "Ready to cancel",
			kind: "pending"
		})
	})
})
