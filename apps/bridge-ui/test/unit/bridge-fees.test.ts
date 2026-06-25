import { MINA_NETWORKS, ZEKO_M_NETWORKS } from "@zeko/networks"
import { describe, expect, it } from "vitest"
import inputsSource from "../../app/components/Inputs.vue?raw"

describe("bridge fee disclosure", () => {
	it("describes the selected route fee without deposit or withdrawal terminology", async () => {
		const { selectedBridgeFeeDisclosure } = await import("../../app/components/bridgeFees")

		expect(
			selectedBridgeFeeDisclosure({
				source: MINA_NETWORKS.devnet,
				destination: ZEKO_M_NETWORKS.testnet
			})
		).toMatchObject({
			routeLabel: "Mina Devnet to Zeko Testnet",
			static: {
				requestMina: 0.1,
				claimMina: 0.1,
				totalMina: 0.2
			},
			firstTransfer: {
				maximumTotalMina: 0.4,
				helperAccountCreationMina: 0.1,
				recipientAccountCreationMina: 0.1,
				destinationAccountLabel: "Zeko"
			}
		})

		expect(
			selectedBridgeFeeDisclosure({
				source: ZEKO_M_NETWORKS.testnet,
				destination: MINA_NETWORKS.devnet
			}).firstTransfer
		).toMatchObject({
			maximumTotalMina: 2.2,
			helperAccountCreationMina: 1,
			recipientAccountCreationMina: 1,
			destinationAccountLabel: "Mina"
		})
	})

	it("renders only selected route fees from the input panel", () => {
		expect(inputsSource).toContain("BridgeFeeNotice")
		expect(inputsSource).toContain("selectedFeeDisclosure")
		expect(inputsSource).not.toContain("Deposit total")
		expect(inputsSource).not.toContain("Withdrawal total")
	})
})
