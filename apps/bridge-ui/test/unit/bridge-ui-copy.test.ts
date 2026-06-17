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
			"Note: Ledger hardware wallets are not yet supported by {{ ledgerUnsupportedNetworkLabel }}."
		)
		expect(inputsSource).not.toContain(networkLabel)
		expect(normalizedInputsSource.indexOf("Claim to the destination chain.")).toBeLessThan(
			normalizedInputsSource.indexOf("Note: Ledger hardware wallets")
		)
	})

	it("groups the change-network prompt with its target network label", () => {
		expect(currentOperationSource).toContain('class="NetworkPrompt"')
		expect(currentOperationSource).toContain('class="NetworkPromptText"')
	})
})
