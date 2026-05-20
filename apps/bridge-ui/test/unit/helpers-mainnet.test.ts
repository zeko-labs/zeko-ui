import { describe, expect, it } from "vitest"
import { getBridgeConfig } from "../../machines/helpers"

describe("bridge helpers mainnet config", () => {
	it("maps Mina/Zeko mainnet to provided GraphQL endpoints", () => {
		const config = getBridgeConfig({ l1: "mina:mainnet", l2: "zeko:mainnet" })

		expect(config.l1Url).toBe("https://api.minascan.io/node/mainnet/v1/graphql")
		expect(config.l1ArchiveUrl).toBe("https://archive-node-api.gcp.o1test.net")
		expect(config.zekoUrl).toBe("https://mainnet.zeko.io/graphql")
		expect(config.zekoArchiveUrl).toBe("https://archive.mainnet.zeko.io/graphql")
		expect(config.l1Network).toBe("mainnet")
		expect(config.l2Network).toBe("mainnet")
	})
})
