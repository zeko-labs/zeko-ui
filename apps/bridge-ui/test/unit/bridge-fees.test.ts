import { describe, expect, it } from "vitest"
import inputsSource from "../../app/components/Inputs.vue?raw"

describe("bridge fee disclosure", () => {
	it("describes static and maximum first-operation fees for both directions", async () => {
		const { bridgeFeeDisclosure } = await import("../../app/components/bridgeFees")

		expect(bridgeFeeDisclosure.static).toEqual({
			requestMina: 0.1,
			claimMina: 0.1,
			totalMina: 0.2
		})
		expect(bridgeFeeDisclosure.deposit).toEqual({
			helperAccountCreationMina: 0.1,
			recipientAccountCreationMina: 0.1,
			maximumFirstOperationFeeMina: 0.4
		})
		expect(bridgeFeeDisclosure.withdrawal).toEqual({
			helperAccountCreationMina: 1,
			recipientAccountCreationMina: 1,
			maximumFirstOperationFeeMina: 2.2
		})
	})

	it("renders the fee disclosure from the input panel", () => {
		expect(inputsSource).toContain("BridgeFeeNotice")
		expect(inputsSource).toContain("bridgeFeeDisclosure")
	})
})
