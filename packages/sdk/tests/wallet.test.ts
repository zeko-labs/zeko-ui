import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import {
	formatUserFacingNetworkLabel,
	USER_FACING_NETWORK_LABELS,
	ZEKO_M_NETWORKS
} from "@zeko/networks"
import { describe, expect, it, vi } from "vitest"
import {
	AURO_NETWORK_LABELS,
	AURO_NETWORKS,
	bridgeNetworkToAuroNetwork,
	switchAuroNetwork
} from "../src"

const createProvider = (...switchNetworkIds: string[]) => {
	const networkIds = [...switchNetworkIds]
	const fallback = networkIds.at(-1) ?? AURO_NETWORKS.minaDevnet
	return {
		switchChain: vi.fn(async () => ({ networkID: networkIds.shift() ?? fallback })),
		addChain: vi.fn(async () => ({ networkID: fallback }))
	}
}

describe("Auro wallet network boundary", () => {
	it("does not own user-facing Zeko network labels", async () => {
		const source = await readFile(
			fileURLToPath(new URL("../src/networks.ts", import.meta.url)),
			"utf8"
		)

		expect(source).not.toContain(USER_FACING_NETWORK_LABELS[AURO_NETWORKS.zekoMainnet])
		expect(source).not.toContain("export const AURO_NETWORK_LABELS")
	})

	it("maps Zeko-M mainnet to Auro's supported network ID", () => {
		expect(bridgeNetworkToAuroNetwork(ZEKO_M_NETWORKS.mainnet)).toBe(AURO_NETWORKS.zekoMainnet)
		expect(AURO_NETWORK_LABELS[AURO_NETWORKS.zekoMainnet]).toBe(
			formatUserFacingNetworkLabel(AURO_NETWORKS.zekoMainnet)
		)
	})

	it("switches to Auro Zeko mainnet without adding a custom chain when Auro supports it", async () => {
		const provider = createProvider(AURO_NETWORKS.zekoMainnet)

		await expect(switchAuroNetwork(provider, ZEKO_M_NETWORKS.mainnet)).resolves.toEqual({
			network: AURO_NETWORKS.zekoMainnet
		})

		expect(provider.switchChain).toHaveBeenCalledExactlyOnceWith({
			networkID: AURO_NETWORKS.zekoMainnet
		})
		expect(provider.addChain).not.toHaveBeenCalled()
	})

	it("adds Zeko mainnet with Auro terminology and the real endpoint if switchChain does not land there", async () => {
		const provider = createProvider(AURO_NETWORKS.minaMainnet, AURO_NETWORKS.zekoMainnet)

		await expect(switchAuroNetwork(provider, ZEKO_M_NETWORKS.mainnet)).resolves.toEqual({
			network: AURO_NETWORKS.zekoMainnet
		})

		expect(provider.addChain).toHaveBeenCalledExactlyOnceWith({
			name: formatUserFacingNetworkLabel(AURO_NETWORKS.zekoMainnet),
			url: "https://mainnet.zeko.io/graphql"
		})
	})
})
