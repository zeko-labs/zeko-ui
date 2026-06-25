import { describe, expect, it } from "vitest"
import inputsSource from "../../app/components/Inputs.vue?raw"

describe("bridge input rules", () => {
	it("requires a 2 MINA minimum before starting a bridge operation", async () => {
		const { canStartBridgeOperation, amountIsBelowBridgeMinimum, BRIDGE_MINIMUM_AMOUNT_MINA } =
			await import("../../app/components/bridgeInputs")

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
		expect(
			canStartBridgeOperation({
				loading: false,
				amount: "2" as never,
				address: "B62qtest-user"
			})
		).toBe(true)
		expect(
			canStartBridgeOperation({
				loading: false,
				amount: "1.999" as never,
				address: "B62qtest-user"
			})
		).toBe(false)
		expect(canStartBridgeOperation({ loading: true, amount: 2, address: "B62qtest-user" })).toBe(
			false
		)
		expect(canStartBridgeOperation({ loading: false, amount: 2, address: "" })).toBe(false)
		expect(amountIsBelowBridgeMinimum(undefined)).toBe(false)
		expect(amountIsBelowBridgeMinimum(1.999)).toBe(true)
		expect(amountIsBelowBridgeMinimum(2)).toBe(false)
		expect(amountIsBelowBridgeMinimum("1.999" as never)).toBe(true)
		expect(amountIsBelowBridgeMinimum("2" as never)).toBe(false)
	})

	it("uses the shared minimum helper in Inputs.vue", () => {
		expect(inputsSource).toContain("canStartBridgeOperation")
		expect(inputsSource).toContain("amountIsBelowBridgeMinimum")
		expect(inputsSource).toContain("BRIDGE_MINIMUM_AMOUNT_MINA")
		expect(inputsSource).toContain(':invalid="amountIsBelowMinimum"')
		expect(inputsSource).toMatch(/\.Bottom\s*{[\s\S]*gap:\s*2rem/)
	})
})
