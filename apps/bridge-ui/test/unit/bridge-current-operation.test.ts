import { describe, expect, it } from "vitest"
import bridgeSource from "../../app/components/Bridge.vue?raw"
import currentOperationSource from "../../app/components/CurrentOperation.vue?raw"

describe("bridge current operation rendering", () => {
	it("keys the current operation by actor id so actor swaps remount subscriptions", () => {
		const normalizedBridgeSource = bridgeSource.replace(/\s+/g, " ")

		expect(normalizedBridgeSource).toMatch(
			/<CurrentOperation v-else :key="currentOperation\.id" :operation="currentOperation" \/>/
		)
	})

	it("watches operation errors through a reactive source for visible feedback", () => {
		const normalizedCurrentOperationSource = currentOperationSource.replace(/\s+/g, " ")

		expect(normalizedCurrentOperationSource).toMatch(
			/watch\( ?\(\) => machine\.value\.context\.errors/
		)
		expect(normalizedCurrentOperationSource).toContain("const latestErrorMessage = computed")
		expect(normalizedCurrentOperationSource).toContain("<p>{{ latestErrorMessage }}</p>")
		expect(normalizedCurrentOperationSource).toContain("errorToaster.create")
	})
})
