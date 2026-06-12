import { describe, expect, it } from "vitest"
import {
	BRIDGE_CLI_ROUTES,
	BRIDGE_SDK_CONFIG_BY_ZEKO_M_NETWORK,
	BRIDGE_UI_NETWORKS,
	createExplorerUrl,
	formatBridgeRoute,
	NETWORK_LABELS,
	ZEKO_M_NETWORKS,
	ZEKO_MAINNET_SDK_NETWORK
} from "../src"

describe("network nomenclature", () => {
	it("uses colon-form Zeko network IDs", () => {
		expect(ZEKO_M_NETWORKS).toEqual({
			local: "zeko-m:local",
			testnet: "zeko-m:testnet",
			alphanet: "zeko-m:alphanet",
			mainnet: "zeko-m:mainnet"
		})
		expect(BRIDGE_UI_NETWORKS).toEqual([
			"mina:devnet",
			"zeko-m:testnet",
			"mina:mainnet",
			"zeko-m:mainnet"
		])
	})

	it("derives route keys from constants", () => {
		expect(formatBridgeRoute("mina:testnet", ZEKO_M_NETWORKS.testnet)).toBe(
			"mina:testnet->zeko-m:testnet"
		)
		expect(BRIDGE_CLI_ROUTES.map((route) => route.route)).toContain("eth:testnet->zeko-e:testnet")
	})

	it("keeps finite labels in a dictionary", () => {
		expect(NETWORK_LABELS[ZEKO_M_NETWORKS.testnet]).toBe("Zeko-M Testnet")
		expect(NETWORK_LABELS["zeko:testnet"]).toBe("Zeko-M Testnet")
	})

	it("keeps the backend SDK mainnet network ID explicit", () => {
		expect(BRIDGE_SDK_CONFIG_BY_ZEKO_M_NETWORK[ZEKO_M_NETWORKS.mainnet].l2Network).toEqual(
			ZEKO_MAINNET_SDK_NETWORK
		)
	})

	it("creates explorer URLs for Zeko-M networks", () => {
		expect(createExplorerUrl(ZEKO_M_NETWORKS.testnet, "5Jhash")).toBe(
			"https://zekoscan.io/testnet/tx/5Jhash"
		)
	})
})
