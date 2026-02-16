import { describe, expect, it } from "vitest"
import { cancellationSteps, progressFromState } from "../../app/helpers"

describe("progressFromState", () => {
	it("uses cancellation steps and maps CAN_CANCEL to confirming", () => {
		const progress = progressFromState({ state: "CAN_CANCEL", step: 1 })
		expect(progress).toEqual({
			steps: cancellationSteps,
			step: 1
		})
	})

	it("maps active cancellation transaction to cancelling", () => {
		const progress = progressFromState({
			state: { CANCEL_DEPOSIT: "transaction" },
			step: 1
		})
		expect(progress).toEqual({
			steps: cancellationSteps,
			step: 2
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
})
