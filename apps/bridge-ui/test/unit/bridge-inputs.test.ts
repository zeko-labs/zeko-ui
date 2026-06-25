import { MINA_NETWORKS, ZEKO_M_NETWORKS } from "@zeko/networks"
import { describe, expect, it } from "vitest"
import inputsSource from "../../app/components/Inputs.vue?raw"

describe("bridge input rules", () => {
	it("requires the selected route minimum before starting a bridge operation", async () => {
		const { amountIsBelowBridgeMinimum, canStartBridgeOperation, selectedBridgeMinimumAmountMina } =
			await import("../../app/utils/bridgeInputs")

		expect(
			selectedBridgeMinimumAmountMina({
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(5)
		expect(
			selectedBridgeMinimumAmountMina({
				source: ZEKO_M_NETWORKS.testnet,
				destination: MINA_NETWORKS.devnet
			})
		).toBe(3)

		expect(
			canStartBridgeOperation({
				loading: false,
				amount: undefined,
				address: "B62qtest-user",
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(false)
		expect(
			canStartBridgeOperation({
				loading: false,
				amount: 4.999,
				address: "B62qtest-user",
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(false)
		expect(
			canStartBridgeOperation({
				loading: false,
				amount: 5,
				address: "B62qtest-user",
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(true)
		expect(
			canStartBridgeOperation({
				loading: false,
				amount: 2.999,
				address: "B62qtest-user",
				source: ZEKO_M_NETWORKS.testnet,
				destination: MINA_NETWORKS.devnet
			})
		).toBe(false)
		expect(
			canStartBridgeOperation({
				loading: false,
				amount: 3,
				address: "B62qtest-user",
				source: ZEKO_M_NETWORKS.testnet,
				destination: MINA_NETWORKS.devnet
			})
		).toBe(true)
		expect(
			canStartBridgeOperation({
				loading: true,
				amount: 5,
				address: "B62qtest-user",
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(false)
		expect(
			canStartBridgeOperation({
				loading: false,
				amount: 5,
				address: "",
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(false)

		expect(
			amountIsBelowBridgeMinimum({
				amount: undefined,
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(false)
		expect(
			amountIsBelowBridgeMinimum({
				amount: 4.999,
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(true)
		expect(
			amountIsBelowBridgeMinimum({
				amount: 5,
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toBe(false)
		expect(
			amountIsBelowBridgeMinimum({
				amount: 2.999,
				source: ZEKO_M_NETWORKS.testnet,
				destination: MINA_NETWORKS.devnet
			})
		).toBe(true)
		expect(
			amountIsBelowBridgeMinimum({
				amount: "3" as never,
				source: ZEKO_M_NETWORKS.testnet,
				destination: MINA_NETWORKS.devnet
			})
		).toBe(false)
	})

	it("uses the shared minimum helper in Inputs.vue", () => {
		expect(inputsSource).toContain("canStartBridgeOperation")
		expect(inputsSource).toContain("amountIsBelowBridgeMinimum")
		expect(inputsSource).toContain("selectedBridgeMinimumAmountMina")
		expect(inputsSource).toContain(':invalid="amountIsBelowMinimum"')
		expect(inputsSource).toMatch(/\.Bottom\s*{[\s\S]*gap:\s*2rem/)
		expect(inputsSource).not.toMatch(/\.Bottom\s*{[\s\S]*margin-bottom:/)
	})

	it("keeps bridge input helpers outside the components directory", () => {
		expect(import.meta.glob("../../app/components/bridgeInputs.ts")).toEqual({})
		expect(import.meta.glob("../../app/utils/bridgeInputs.ts")).toHaveProperty(
			"../../app/utils/bridgeInputs.ts"
		)
	})
})
