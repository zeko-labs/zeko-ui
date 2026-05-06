import { describe, expect, it } from "vitest"
import { resolveRoute } from "../src/core/routes"
import { createSdkConfig } from "../src/core/sdk-config"

describe("sdk config", () => {
	it("maps the supported testnet route to bridge-sdk endpoints", () => {
		const config = createSdkConfig(resolveRoute("mina:testnet", "zeko:testnet"))

		expect(config.l1Url).toBe("https://api.minascan.io/node/devnet/v1/graphql")
		expect(config.l1ArchiveUrl).toBe("https://devnet-archive-node-api.gcp.o1test.net/")
		expect(config.zekoUrl).toBe("https://alphanet.zeko.io/graphql")
		expect(config.zekoArchiveUrl).toBe("https://archive.alphanet.zeko.io/graphql")
		expect(config.actionsApi).toBe("http://api.actions.zeko.io/graphql")
		expect(config.l1Network).toBe("testnet")
		expect(config.l2Network).toBe("testnet")
		expect(config.verbose).toBe(false)
	})

	it("can enable verbose sdk logging explicitly", () => {
		const config = createSdkConfig(resolveRoute("mina:testnet", "zeko:testnet"), {
			verbose: true
		})

		expect(config.verbose).toBe(true)
	})

	it("can point live validation at a local actions api", () => {
		const config = createSdkConfig(resolveRoute("mina:testnet", "zeko:testnet"), {
			env: { BRIDGE_CLI_ACTIONS_API_URL: "http://localhost:9100/graphql" }
		})

		expect(config.actionsApi).toBe("http://localhost:9100/graphql")
	})

	it("rejects disabled routes", () => {
		expect(() => createSdkConfig(resolveRoute("mina:mainnet", "zeko:mainnet"))).toThrowError(
			"Known route, not enabled yet."
		)
	})
})
