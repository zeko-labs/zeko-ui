import { describe, expect, it } from "vitest"
import { cancellationSteps, progressFromState, steps } from "../../app/helpers"

describe("progressFromState", () => {
	it("uses cancellation steps when cancellation flow is active", () => {
		const progress = progressFromState({ state: "CAN_CANCEL", step: 1 })
		expect(progress).toEqual({
			steps: cancellationSteps,
			step: 1
		})
	})

	it("marks cancellation as fully completed in terminal cancelled states", () => {
		const progress = progressFromState({
			state: "BRIDGE_OPERATION_CANCELLED_DONE",
			step: 1
		})
		expect(progress).toEqual({
			steps: cancellationSteps,
			step: cancellationSteps.length
		})
	})

	it("keeps default progress steps for non-cancellation states", () => {
		const progress = progressFromState({ state: "TO_FINALIZE", step: 2 })
		expect(progress).toEqual({
			steps,
			step: 2
		})
	})
})
