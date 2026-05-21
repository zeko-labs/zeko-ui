import { PublicKey, UInt32, UInt64 } from "o1js"
import { describe, expect, it } from "vitest"
import type { GqlClient } from "../src/graphql"
import { Bridge } from "../src/index"
import type { Config } from "../src/types"

const bridgeConfig: Config = {
	l1Url: "http://l1.test",
	l1ArchiveUrl: "http://l1-archive.test",
	zekoUrl: "http://l2.test",
	zekoArchiveUrl: "http://l2-archive.test",
	l1Network: "testnet",
	l2Network: "testnet",
	actionsApi: "http://actions.test"
}

const buildGraphqlClient = (): GqlClient =>
	Object.assign(
		() =>
			({
				query: async () => ({ data: {} })
			}) as unknown as ReturnType<GqlClient>,
		{ label: "test-client" }
	)

const publicKey = PublicKey.fromBase58("B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2")

describe("Bridge constructor", () => {
	it("rejects incomplete legacy constructor calls with a clear error", () => {
		const LegacyBridge = Bridge as unknown as new (...args: unknown[]) => Bridge

		expect(() => new LegacyBridge(bridgeConfig)).toThrow(
			"Invalid Bridge constructor arguments: expected runtime or legacy config plus 14-19 arguments"
		)
	})

	it("accepts the legacy constructor signature", () => {
		expect(
			() =>
				new Bridge(
					bridgeConfig,
					buildGraphqlClient(),
					buildGraphqlClient(),
					buildGraphqlClient(),
					buildGraphqlClient(),
					buildGraphqlClient(),
					UInt64.from(1),
					UInt64.from(1),
					publicKey,
					publicKey,
					[publicKey],
					publicKey,
					publicKey,
					publicKey,
					UInt32.from(10),
					publicKey,
					publicKey,
					UInt64.from(1)
				)
		).not.toThrow()
	})
})
