import { describe, expect, it } from "vitest"
import { KNOWN_ROUTES, resolveRoute } from "../src/core/routes"

describe("routes", () => {
	it("marks mina testnet to zeko testnet as supported", () => {
		expect(resolveRoute("mina:testnet", "zeko:testnet").enabled).toBe(true)
	})

	it("keeps future routes known but disabled", () => {
		expect(resolveRoute("mina:mainnet", "zeko:mainnet").enabled).toBe(false)
		expect(resolveRoute("eth:testnet", "zeko:testnet").enabled).toBe(false)
		expect(KNOWN_ROUTES.length).toBeGreaterThanOrEqual(4)
	})

	it("keeps mina mainnet routes disabled until mainnet actions indexing is ready", () => {
		expect(resolveRoute("mina:mainnet", "zeko:mainnet")).toMatchObject({
			enabled: false,
			reason:
				"Mainnet bridge routes require a dedicated mainnet Actions API and indexer deployment before they can be enabled."
		})

		expect(resolveRoute("zeko:mainnet", "mina:mainnet")).toMatchObject({
			enabled: false,
			reason:
				"Mainnet bridge routes require a dedicated mainnet Actions API and indexer deployment before they can be enabled."
		})
	})
})
