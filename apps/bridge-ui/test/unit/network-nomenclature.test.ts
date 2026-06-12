import { describe, expect, it } from "vitest"
import { supportedNetworks } from "../../machines/bridge"
import { createExplorerUrl, getBridgeConfig } from "../../machines/helpers"

describe("network nomenclature", () => {
	it("uses the Zeko-M network IDs in the bridge UI", () => {
		expect(supportedNetworks).toEqual([
			"mina:devnet",
			"zeko-m-devnet",
			"mina:mainnet",
			"zeko-m-mainnet"
		])
	})

	it("maps Zeko-M mainnet to the backend SDK network ID", () => {
		const config = getBridgeConfig({
			l1: "mina:mainnet" as never,
			l2: "zeko-m-mainnet" as never
		})

		expect(config.l2Network).toEqual({ custom: "zeko-mainnet" })
	})

	it("keeps explorer links available for Zeko-M networks", () => {
		expect(
			createExplorerUrl({
				network: "zeko-m-devnet" as never,
				hash: "5Jhash"
			})
		).toBe("https://zekoscan.io/testnet/tx/5Jhash")
		expect(
			createExplorerUrl({
				network: "zeko-m-mainnet" as never,
				hash: "5Jhash"
			})
		).toBe("https://zekoscan.io/mainnet/tx/5Jhash")
	})
})
