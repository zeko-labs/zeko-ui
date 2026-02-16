import { describe, expect, it } from "vitest"
import {
	cancellationFlowStage,
	cancellationSteps,
	progressFromState,
	steps
} from "../../app/helpers"

describe("progressFromState", () => {
	it("maps states to the expected UI progress stage", () => {
		const cases = [
			{
				input: { state: "CAN_CANCEL" as const, step: 1 },
				expected: {
					flow: "cancellation" as const,
					steps: cancellationSteps,
					step: cancellationFlowStage.Confirming
				}
			},
			{
				input: { state: { CANCEL_DEPOSIT: "transaction" } as const, step: 1 },
				expected: {
					flow: "cancellation" as const,
					steps: cancellationSteps,
					step: cancellationFlowStage.Cancelling
				}
			},
			{
				input: {
					state: "WAITING_FOR_NETWORK" as const,
					returnTo: "CANCEL_DEPOSIT" as const,
					step: 1
				},
				expected: {
					flow: "cancellation" as const,
					steps: cancellationSteps,
					step: cancellationFlowStage.Cancelling
				}
			},
			{
				input: { state: "BRIDGE_OPERATION_CANCELLED_DONE" as const, step: 1 },
				expected: {
					flow: "cancellation" as const,
					steps: cancellationSteps,
					step: cancellationFlowStage.Cancelled
				}
			},
			{
				input: { state: "TO_FINALIZE" as const, step: 2 },
				expected: {
					flow: "default" as const,
					steps,
					step: 2
				}
			}
		]

		for (const { input, expected } of cases) {
			expect(progressFromState(input)).toEqual(expected)
		}
	})
})
