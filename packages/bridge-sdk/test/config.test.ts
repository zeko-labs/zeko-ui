import { PublicKey, UInt32, UInt64 } from "o1js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { readBridgeConfig } from "../examples/helper"
import { Bridge, type Config } from "../src/index"
import type { GqlClient } from "../src/graphql"

const minaMocks = vi.hoisted(() => ({
	network: vi.fn((config: unknown) => ({ config })),
	setActiveInstance: vi.fn()
}))

vi.mock("o1js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("o1js")>()

	return {
		...actual,
		Mina: {
			...actual.Mina,
			Network: minaMocks.network,
			setActiveInstance: minaMocks.setActiveInstance
		}
	}
})

const publicKey = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")

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

const buildBridge = () =>
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

describe("bridge-sdk config", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.clearAllMocks()
	})

	it("passes the configured zeko archive endpoint to o1js for L2", () => {
		buildBridge().setL2()

		expect(minaMocks.network).toHaveBeenCalledWith({
			mina: "http://l2.test",
			archive: "http://l2-archive.test",
			networkId: "testnet"
		})
	})

	it("allows examples to configure mainnet network ids", () => {
		vi.stubEnv("L1_NETWORK", "mainnet")
		vi.stubEnv("L2_NETWORK", "mainnet")

		expect(readBridgeConfig()).toMatchObject({
			l1Network: "mainnet",
			l2Network: "mainnet"
		})
	})

	it("rejects unsupported example network ids", () => {
		vi.stubEnv("L1_NETWORK", "localnet")

		expect(() => readBridgeConfig()).toThrowError("L1_NETWORK must be one of: testnet, mainnet")
	})
})
