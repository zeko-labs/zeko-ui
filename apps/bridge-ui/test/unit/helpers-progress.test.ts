import { describe, expect, it } from "vitest"
import {
	operationProgressLabel,
	progressFromState,
	shouldShowCompletedOperationsLoading,
	steps
} from "../../app/helpers"
import { bridgeOperationProgress } from "../../machines/operationProgress"

describe("progressFromState", () => {
	it("always uses the default main-lane progress steps", () => {
		const cases = [
			{
				input: { step: 2 },
				expected: {
					steps,
					step: 2
				}
			},
			{
				input: { step: 1 },
				expected: {
					steps,
					step: 1
				}
			}
		]

		for (const { input, expected } of cases) {
			expect(progressFromState(input)).toEqual(expected)
		}
	})
})

describe("shouldShowCompletedOperationsLoading", () => {
	it("only shows loading when the bridge is not ready and there are no completed rows yet", () => {
		expect(
			shouldShowCompletedOperationsLoading({
				bridgeReady: false,
				operationCount: 0
			})
		).toBe(true)

		expect(
			shouldShowCompletedOperationsLoading({
				bridgeReady: false,
				operationCount: 3
			})
		).toBe(false)

		expect(
			shouldShowCompletedOperationsLoading({
				bridgeReady: true,
				operationCount: 0
			})
		).toBe(false)
	})
})

describe("operationProgressLabel", () => {
	it("formats discreet remaining progress text", () => {
		expect(operationProgressLabel({ confirmationsRemaining: 1 })).toBe("1 confirmation remaining")
		expect(operationProgressLabel({ confirmationsRemaining: 2 })).toBe("2 confirmations remaining")
		expect(operationProgressLabel(undefined)).toBeNull()
		expect(operationProgressLabel({ confirmationsRemaining: 0 })).toBeNull()
	})
})

describe("bridgeOperationProgress", () => {
	it("uses the action index and SDK progress index delta", () => {
		expect(bridgeOperationProgress({ actionIndex: 4, confirmedIndex: 3 })).toEqual({
			confirmationsRemaining: 1
		})
		expect(bridgeOperationProgress({ actionIndex: 4, confirmedIndex: 4 })).toBeUndefined()
		expect(bridgeOperationProgress({ actionIndex: 4, confirmedIndex: 5 })).toBeUndefined()
	})
})
