import { describe, expect, it } from "vitest"
import { getBridgeDeployBlock } from "../src/utils"

describe("network history constants", () => {
	it("keeps the historical bridge deploy blocks network-specific", () => {
		expect(getBridgeDeployBlock("testnet")).toBe(430_000)
		expect(getBridgeDeployBlock("mainnet")).toBe(530_000)
	})
})
