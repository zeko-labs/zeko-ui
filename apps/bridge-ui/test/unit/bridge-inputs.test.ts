import { describe, expect, it } from "vitest"
import inputsSource from "../../app/components/Inputs.vue?raw"

describe("bridge input rules", () => {
	it("requires a 2 MINA minimum before starting a bridge operation", async () => {
		const { canStartBridgeOperation, BRIDGE_MINIMUM_AMOUNT_MINA } = await import(
			"../../app/components/bridgeInputs"
		)

		expect(BRIDGE_MINIMUM_AMOUNT_MINA).toBe(2)
		expect(
			canStartBridgeOperation({ loading: false, amount: undefined, address: "B62qtest-user" })
		).toBe(false)
		expect(canStartBridgeOperation({ loading: false, amount: 0, address: "B62qtest-user" })).toBe(
			false
		)
		expect(
			canStartBridgeOperation({ loading: false, amount: 1.999, address: "B62qtest-user" })
		).toBe(false)
		expect(canStartBridgeOperation({ loading: false, amount: 2, address: "B62qtest-user" })).toBe(
			true
		)
		expect(canStartBridgeOperation({ loading: true, amount: 2, address: "B62qtest-user" })).toBe(
			false
		)
		expect(canStartBridgeOperation({ loading: false, amount: 2, address: "" })).toBe(false)
	})

	it("uses the shared minimum helper in Inputs.vue", () => {
		expect(inputsSource).toContain("canStartBridgeOperation")
		expect(inputsSource).toContain("BRIDGE_MINIMUM_AMOUNT_MINA")
	})
})
