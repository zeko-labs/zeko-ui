import { describe, expect, it } from "vitest"
import { progressFromState, shouldShowCompletedOperationsLoading, steps } from "../../app/helpers"

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
