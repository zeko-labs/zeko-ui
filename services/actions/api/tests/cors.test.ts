import { describe, expect, it } from "vitest"
import { ACTIONS_API_SEPOLIA_CORS_ORIGIN, getActionsApiCorsOptions } from "../src/cors"

describe("Actions API CORS policy", () => {
	it("allows the standalone Sepolia bridge origin without reflecting arbitrary origins", () => {
		const allowed = getActionsApiCorsOptions(
			"sepolia",
			new Request("https://sepolia.api.actions.zeko.io/graphql", {
				headers: { Origin: ACTIONS_API_SEPOLIA_CORS_ORIGIN }
			})
		)
		const unexpected = getActionsApiCorsOptions(
			"sepolia",
			new Request("https://sepolia.api.actions.zeko.io/graphql", {
				headers: { Origin: "https://malicious.example" }
			})
		)

		expect(allowed.origin).toBe(ACTIONS_API_SEPOLIA_CORS_ORIGIN)
		expect(unexpected.origin).toBe(ACTIONS_API_SEPOLIA_CORS_ORIGIN)
		expect(unexpected.origin).not.toBe("https://malicious.example")
	})

	it("preserves request-origin reflection for existing environments", () => {
		const origin = "https://testnet.bridge.zeko.io"
		const options = getActionsApiCorsOptions(
			"testnet",
			new Request("https://testnet.api.actions.zeko.io/graphql", {
				headers: { Origin: origin }
			})
		)

		expect(options.origin).toBe(origin)
	})
})
