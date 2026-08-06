import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

type WranglerConfig = {
	env?: Record<
		string,
		{
			vars?: Record<string, string>
			routes?: Array<{ pattern?: string; custom_domain?: boolean }>
			hyperdrive?: Array<{ binding?: string; id?: string }>
		}
	>
}

const config = JSON.parse(
	readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")
) as WranglerConfig

describe("Actions API Wrangler environments", () => {
	it("defines an isolated Sepolia environment and dedicated Hyperdrive bindings", () => {
		const sepolia = config.env?.sepolia

		expect(sepolia?.vars).toEqual({ ENVIRONMENT: "sepolia" })
		expect(sepolia?.routes).toEqual([
			{ custom_domain: true, pattern: "sepolia.api.actions.zeko.io" }
		])
		expect(sepolia?.hyperdrive).toEqual([
			{
				binding: "HYPERDRIVE_NO_CACHE",
				id: "7fb4470db72746ee8078f65bd031bb3c",
				localConnectionString: "postgresql://postgres:postgres@localhost:5434/actions"
			},
			{
				binding: "HYPERDRIVE",
				id: "b87682614aa74131a3754b90fd1c815d",
				localConnectionString: "postgresql://postgres:postgres@localhost:5434/actions"
			}
		])
	})

	it("keeps the existing testnet environment bindings unchanged", () => {
		expect(config.env?.testnet?.vars).toEqual({ ENVIRONMENT: "testnet" })
		expect(config.env?.testnet?.routes).toEqual([
			{ custom_domain: true, pattern: "testnet.api.actions.zeko.io" }
		])
		expect(config.env?.testnet?.hyperdrive).toEqual([
			{
				binding: "HYPERDRIVE_NO_CACHE",
				id: "33ea9e81023146799e5658aae00731fc",
				localConnectionString: "postgresql://postgres:postgres@localhost:5434/actions"
			},
			{
				binding: "HYPERDRIVE",
				id: "abf1ac369edf418ba9243099f96ead76",
				localConnectionString: "postgresql://postgres:postgres@localhost:5434/actions"
			}
		])
	})
})
