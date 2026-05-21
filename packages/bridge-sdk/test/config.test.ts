import { afterEach, describe, expect, it, vi } from "vitest"
import { PublicKey, UInt32, UInt64 } from "o1js"
import { Bridge, type Config } from "../src/index"
import { readBridgeConfig } from "../examples/helper"
import type { GqlClient } from "../src/graphql"

const minaMock = vi.hoisted(() => ({
	network: vi.fn(() => ({ id: "network" })),
	setActiveInstance: vi.fn()
}))

vi.mock("o1js", async () => {
	const actual = await vi.importActual<typeof import("o1js")>("o1js")
	return {
		...actual,
		Mina: {
			...actual.Mina,
			Network: minaMock.network,
			setActiveInstance: minaMock.setActiveInstance
		}
	}
})

const previousEnv = { ...process.env }

const config: Config = {
	l1Url: "https://l1.example/graphql",
	l1ArchiveUrl: "https://l1-archive.example/graphql",
	zekoUrl: "https://zeko.example/graphql",
	zekoArchiveUrl: "https://zeko-archive.example/graphql",
	l1Network: "mainnet",
	l2Network: "mainnet",
	actionsApi: "https://actions.example/graphql"
}

const client: GqlClient = Object.assign(
	() =>
		({
			query: async () => ({ data: {} })
		}) as unknown as ReturnType<GqlClient>,
	{ label: "config-test" }
)

const publicKey = PublicKey.fromBase58("B62qpuhMDp748xtE77iBXRRaipJYgs6yumAeTzaM7zS9dn8avLPaeFF")

const bridge = new Bridge(
	config,
	client,
	client,
	client,
	client,
	client,
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

describe("bridge config", () => {
	afterEach(() => {
		for (const key of Object.keys(process.env)) {
			delete process.env[key]
		}
		Object.assign(process.env, previousEnv)
		minaMock.network.mockClear()
		minaMock.setActiveInstance.mockClear()
		vi.restoreAllMocks()
	})

	it("uses the configured Zeko archive endpoint when activating L2", () => {
		bridge.setL2()

		expect(minaMock.network).toHaveBeenCalledWith({
			mina: "https://zeko.example/graphql",
			archive: "https://zeko-archive.example/graphql",
			networkId: "mainnet"
		})
		expect(minaMock.setActiveInstance).toHaveBeenCalledWith({ id: "network" })
	})

	it("reads mainnet network ids for examples from the environment", () => {
		process.env.L1_NETWORK = "mainnet"
		process.env.L2_NETWORK = "mainnet"

		expect(readBridgeConfig()).toMatchObject({
			l1Network: "mainnet",
			l2Network: "mainnet"
		})
	})

	it("rejects invalid example network ids", () => {
		process.env.L1_NETWORK = "devnet"

		expect(() => readBridgeConfig()).toThrow("Invalid L1_NETWORK: devnet")
	})
})
