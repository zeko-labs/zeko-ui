import { describe, expect, it } from "vitest"
import currentOperationSource from "../../app/components/CurrentOperation.vue?raw"
import inputsSource from "../../app/components/Inputs.vue?raw"

describe("bridge UI copy", () => {
	it("mentions Ledger hardware wallets at the end of the bridge instruction copy", () => {
		const normalizedInputsSource = inputsSource.replace(/\s+/g, " ")
		expect(normalizedInputsSource).toContain(
			"Note: Ledger hardware wallets are not yet supported by Zeko Mainnet."
		)
		expect(normalizedInputsSource.indexOf("Claim to the destination chain.")).toBeLessThan(
			normalizedInputsSource.indexOf("Note: Ledger hardware wallets")
		)
	})

	it("groups the change-network prompt with its target network label", () => {
		expect(currentOperationSource).toContain('class="NetworkPrompt"')
		expect(currentOperationSource).toContain('class="NetworkPromptText"')
	})
})
