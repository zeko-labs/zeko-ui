import { Field, PrivateKey } from "o1js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createBridgeRuntime } from "../src/runtime"
import type { Config } from "../src/types"

const mocks = vi.hoisted(() => ({
	queryByUrl: vi.fn()
}))

vi.mock("../src/graphql", () => ({
	createGraphqlClient: (url: string, label: string) =>
		Object.assign(
			() => ({
				query: (query: unknown, variables: unknown) => mocks.queryByUrl(url, query, variables)
			}),
			{ label }
		)
}))

const config: Config = {
	l1Url: "http://l1.test/graphql",
	l1ArchiveUrl: "http://l1-archive.test/graphql",
	zekoUrl: "http://l2.test/graphql",
	zekoArchiveUrl: "http://l2-archive.test/graphql",
	l1Network: "testnet",
	l2Network: "testnet",
	actionsApi: "http://actions.test/graphql"
}

const registrationAuthority = PrivateKey.random().toPublicKey()

const runtimeConfig = (registryRoot?: string, universalBridgeVkHash = "103") => {
	const outer = PrivateKey.random().toPublicKey().toBase58()
	const inner = PrivateKey.random().toPublicKey().toBase58()
	const vault = PrivateKey.random().toPublicKey().toBase58()
	return {
		zekoL1: outer,
		zekoL2: inner,
		holderAccountsL1: [PrivateKey.random().toPublicKey().toBase58()],
		holderAccountL2: PrivateKey.random().toPublicKey().toBase58(),
		helperTokenOwnerL1: PrivateKey.random().toPublicKey().toBase58(),
		withdrawalDelay: 10,
		bridgeFeeRecipientL1: PrivateKey.random().toPublicKey().toBase58(),
		bridgeFeeRecipientL2: PrivateKey.random().toPublicKey().toBase58(),
		bridgeProofFee: "100",
		ethereumAssets: {
			registryPublicKey: PrivateKey.random().toPublicKey().toBase58(),
			registrationAuthority: registrationAuthority.toBase58(),
			vaultPublicKey: vault,
			registrySchemaVersion: 1,
			registryRoot,
			registryCount: 0,
			approvedMftStandardVkId: "101",
			approvedMftTokenVkHash: "105",
			approvedMftAdminVkHash: "106",
			universalBridgeVkId: "102",
			universalBridgeVkHash,
			bridgeVerificationKeyHash: "103",
			registryVerificationKeyHash: "104"
		}
	}
}

const operationName = (query: unknown): string | undefined =>
	(
		query as {
			definitions?: Array<{ name?: { value?: string } }>
		}
	).definitions?.[0]?.name?.value

const mockSuccessfulRuntimeQueries = (
	registryRoot?: string,
	universalBridgeVkHash?: string
): void => {
	const circuitsConfig = runtimeConfig(registryRoot, universalBridgeVkHash)
	mocks.queryByUrl.mockImplementation(async (url: string, query: unknown) => {
		switch (operationName(query)) {
			case "FetchConfig":
				return { data: { circuitsConfig } }
			case "SequencerPK":
				return { data: { sequencerPk: PrivateKey.random().toPublicKey().toBase58() } }
			case "GenesisConstants":
				return { data: { genesisConstants: { accountCreationFee: "1000000000" } } }
			default:
				throw new Error(`Unexpected runtime query at ${url}`)
		}
	})
}

describe("Bridge runtime errors", () => {
	beforeEach(() => {
		mocks.queryByUrl.mockReset()
	})

	it("reports the failing endpoint and query when runtime config fetch fails", async () => {
		mocks.queryByUrl.mockImplementation(async (url: string) =>
			url === config.zekoUrl
				? {
						error: {
							message: "[Network] error code: 502",
							networkError: new Error("error code: 502")
						}
					}
				: { data: { genesisConstants: { accountCreationFee: "1000000000" } } }
		)

		await expect(createBridgeRuntime(config)).rejects.toThrow(
			"GraphQL query FetchConfig failed at http://l2.test/graphql: [Network] error code: 502; networkError=error code: 502"
		)
	})

	it("reports missing runtime fields with the endpoint and query", async () => {
		mocks.queryByUrl.mockImplementation(async (url: string) =>
			url === config.zekoUrl
				? { data: {} }
				: { data: { genesisConstants: { accountCreationFee: "1000000000" } } }
		)

		await expect(createBridgeRuntime(config)).rejects.toThrow(
			"GraphQL query FetchConfig at http://l2.test/graphql did not return circuitsConfig"
		)
	})

	it("requires and carries the authenticated registry root and count", async () => {
		mockSuccessfulRuntimeQueries()
		await expect(createBridgeRuntime(config)).rejects.toThrow(
			"did not return circuitsConfig.ethereumAssets.registryRoot"
		)

		mockSuccessfulRuntimeQueries(Field(1234).toString(), "999")
		await expect(createBridgeRuntime(config)).rejects.toThrow(
			"universal bridge VK hash does not match the compiled bridge VK hash"
		)

		mockSuccessfulRuntimeQueries(Field(1234).toString())
		const runtime = await createBridgeRuntime(config)
		expect(runtime.ethereumAssets?.registryRoot.equals(Field(1234)).toBoolean()).toBe(true)
		expect(runtime.ethereumAssets?.registryCount).toBe(0)
		expect(
			runtime.ethereumAssets?.registrationAuthority.equals(registrationAuthority).toBoolean()
		).toBe(true)
		expect(runtime.ethereumAssets?.approvedMftTokenVkHash.equals(Field(105)).toBoolean()).toBe(true)
		expect(runtime.ethereumAssets?.approvedMftAdminVkHash.equals(Field(106)).toBoolean()).toBe(true)
		expect(runtime.ethereumAssets?.universalBridgeVkHash.equals(Field(103)).toBoolean()).toBe(true)
	})
})
