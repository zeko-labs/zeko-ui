import { describe, expect, it } from "vitest"
import { resolveSignerSecrets } from "../src/core/signer"

describe("signer secrets", () => {
	it("falls back to the mina private key for zeko", () => {
		const secrets = resolveSignerSecrets({
			ZEKO_BRIDGE_MINA_PRIVATE_KEY: "mina-secret"
		})

		expect(secrets.mina).toBe("mina-secret")
		expect(secrets.zeko).toBe("mina-secret")
		expect(secrets.eth).toBeUndefined()
	})

	it("throws a redacted error when mina is missing", () => {
		expect(() => resolveSignerSecrets({})).toThrowError(
			"Missing required signing secret: ZEKO_BRIDGE_MINA_PRIVATE_KEY"
		)
	})
})
