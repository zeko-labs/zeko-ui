import { describe, expect, it } from "vitest"
import bridgeSource from "../../app/components/Bridge.vue?raw"

describe("bridge current operation rendering", () => {
	it("keys the current operation by actor id so actor swaps remount subscriptions", () => {
		const normalizedBridgeSource = bridgeSource.replace(/\s+/g, " ")

		expect(normalizedBridgeSource).toMatch(
			/<CurrentOperation v-else :key="currentOperation\.id" :operation="currentOperation" \/>/
		)
	})
})
