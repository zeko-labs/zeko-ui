import { MINA_NETWORKS, ZEKO_M_NETWORKS } from "@zeko/networks"
import { describe, expect, it } from "vitest"
import feeNoticeSource from "../../app/components/BridgeFeeNotice.vue?raw"
import inputsSource from "../../app/components/Inputs.vue?raw"
import bridgeFeesSource from "../../app/utils/bridgeFees.ts?raw"

describe("bridge fee disclosure", () => {
	it("describes the selected route fee without deposit or withdrawal terminology", async () => {
		const { selectedBridgeFeeDisclosure } = await import("../../app/utils/bridgeFees")

		const minaToZeko = selectedBridgeFeeDisclosure({
			source: MINA_NETWORKS.devnet,
			destination: ZEKO_M_NETWORKS.testnet
		})
		expect(minaToZeko).toMatchObject({
			routeLabel: "Mina Devnet to Zeko Testnet",
			sourceShortLabel: "Mina",
			destinationShortLabel: "Zeko",
			minimumAmountMina: 5,
			static: {
				totalMina: 0.4
			},
			firstTransfer: {
				maximumTotalMina: 0.6,
				helperAccountCreationMina: 0.1,
				recipientAccountCreationMina: 0.1,
				destinationAccountLabel: "Zeko"
			}
		})
		expect(minaToZeko).not.toHaveProperty("bridgeMinimumLabel")
		expect(minaToZeko.static).not.toHaveProperty("requestMina")
		expect(minaToZeko.static).not.toHaveProperty("claimMina")

		const zekoToMina = selectedBridgeFeeDisclosure({
			source: ZEKO_M_NETWORKS.testnet,
			destination: MINA_NETWORKS.devnet
		})
		expect(zekoToMina).toMatchObject({
			routeLabel: "Zeko Testnet to Mina Devnet",
			sourceShortLabel: "Zeko",
			destinationShortLabel: "Mina",
			minimumAmountMina: 3,
			firstTransfer: {
				maximumTotalMina: 2.4,
				helperAccountCreationMina: 1,
				recipientAccountCreationMina: 1,
				destinationAccountLabel: "Mina"
			}
		})
		expect(zekoToMina).not.toHaveProperty("bridgeMinimumLabel")
		expect(bridgeFeesSource).toContain("selectedBridgeMinimumAmountMina")
		expect(bridgeFeesSource).not.toMatch(/minimumAmountMina\s*=\s*isMinaToZeko\s*\?/)
	})

	it("renders only selected route fees from the input panel", () => {
		expect(inputsSource).toContain("BridgeFeeNotice")
		expect(inputsSource).toContain("selectedFeeDisclosure")
		expect(inputsSource).not.toContain("Deposit total")
		expect(inputsSource).not.toContain("Withdrawal total")
	})

	it("uses a native title tooltip next to the bridge minimum", () => {
		expect(feeNoticeSource).toContain("ArrowRight")
		expect(feeNoticeSource).toContain("{{ fees.sourceShortLabel }}")
		expect(feeNoticeSource).toContain("{{ fees.destinationShortLabel }}")
		expect(feeNoticeSource).toMatch(/bridge minimum\s*\{\{\s*fees\.minimumAmountMina\s*\}\}\s*MINA/)
		expect(feeNoticeSource).not.toContain("{{ fees.bridgeMinimumLabel }}")
		expect(feeNoticeSource).not.toContain("->")
		expect(feeNoticeSource).not.toContain("Bridge Minimum")
		expect(feeNoticeSource).not.toContain("{{ fees.routeFeeLabel }}")
		expect(feeNoticeSource).not.toMatch(/fee \{\{.*\}\} MINA/)
		expect(feeNoticeSource).toContain(":title=")
		expect(feeNoticeSource).toContain("?")
		expect(feeNoticeSource).toContain("props.fees.static.totalMina")
		expect(feeNoticeSource).toContain("MINA bridge fees")
		expect(feeNoticeSource).toMatch(/helper account creation/)
		expect(feeNoticeSource).toMatch(/recipient account creation/)
		expect(feeNoticeSource).not.toContain("CircleHelp")
		expect(feeNoticeSource).not.toContain("data-tooltip")
		expect(feeNoticeSource).not.toMatch(/&::after/)
		expect(feeNoticeSource).not.toContain("<section")
		expect(feeNoticeSource).not.toContain("<dl")
		expect(feeNoticeSource).not.toContain("Fees for")
		expect(feeNoticeSource).not.toContain("<dt>Bridge transactions</dt>")
		expect(feeNoticeSource).not.toContain("<dt>First transfer maximum</dt>")
		expect(feeNoticeSource).not.toContain("Up to")
		expect(feeNoticeSource).not.toContain("May include")
		expect(feeNoticeSource).not.toMatch(/<span class="FeeBreakdown">[\s\S]*account creation/)
	})

	it("keeps bridge fee helpers outside the components directory", () => {
		expect(import.meta.glob("../../app/components/bridgeFees.ts")).toEqual({})
		expect(import.meta.glob("../../app/utils/bridgeFees.ts")).toHaveProperty(
			"../../app/utils/bridgeFees.ts"
		)
	})
})
