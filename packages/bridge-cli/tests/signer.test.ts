import { describe, expect, it } from "vitest"
import { resolveSignerKeys } from "../src/core/signer"

describe("signer keys", () => {
	it("falls back to the mina private key for zeko", () => {
		const keys = resolveSignerKeys({
			ZEKO_BRIDGE_MINA_PRIVATE_KEY: "mina-secret"
		})

		expect(keys.mina).toBe("mina-secret")
		expect(keys.zeko).toBe("mina-secret")
		expect(keys.eth).toBeUndefined()
	})

	it("throws a redacted error when mina is missing", () => {
		expect(() => resolveSignerKeys({})).toThrowError(
			"Missing required signer private key: ZEKO_BRIDGE_MINA_PRIVATE_KEY"
		)
	})
})
