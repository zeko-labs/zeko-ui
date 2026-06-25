import { describe, expect, it } from "vitest"
import { ZEKO_M_NETWORKS } from "@zeko/networks"
import currentOperationSource from "../../app/components/CurrentOperation.vue?raw"
import inputsSource from "../../app/components/Inputs.vue?raw"
import { formatBridgeNetworkLabel } from "../../machines/networks"

describe("bridge UI copy", () => {
	it("builds the Ledger note from the shared network display helper", () => {
		const networkLabel = formatBridgeNetworkLabel(ZEKO_M_NETWORKS.mainnet)
		const normalizedInputsSource = inputsSource.replace(/\s+/g, " ")

		expect(normalizedInputsSource).toMatch(
			/const ledgerUnsupportedNetworkLabel = formatBridgeNetworkLabel\( ?ZEKO_M_NETWORKS\.mainnet ?\)/
		)
		expect(normalizedInputsSource).toContain(
			"Ledger hardware wallets are not yet supported by {{ ledgerUnsupportedNetworkLabel }}."
		)
		expect(inputsSource).not.toContain('<ol class="BridgeSteps">')
		expect(inputsSource).toContain("Send from origin")
		expect(inputsSource).toContain("claim on destination")
		expect(inputsSource).toContain("<BridgeFeeNotice")
		expect(inputsSource).toContain(':fees="selectedFeeDisclosure"')
		expect(inputsSource).not.toContain(networkLabel)
		expect(normalizedInputsSource.indexOf("claim on destination")).toBeLessThan(
			normalizedInputsSource.indexOf("Ledger hardware wallets")
		)
		expect(normalizedInputsSource.indexOf("Ledger hardware wallets")).toBeLessThan(
			normalizedInputsSource.indexOf("<BridgeFeeNotice")
		)
	})

	it("groups the change-network prompt with its target network label", () => {
		expect(currentOperationSource).toContain('class="NetworkPrompt"')
		expect(currentOperationSource).toContain('class="NetworkPromptText"')
	})

	it("does not keep TypeScript helper files in the components directory", () => {
		expect(import.meta.glob("../../app/components/*.ts")).toEqual({})
	})
})
