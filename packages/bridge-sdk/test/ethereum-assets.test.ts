import { Field, Mina, Poseidon, PrivateKey, PublicKey, TokenId, UInt64 } from "o1js"
import { describe, expect, it } from "vitest"
import {
	type EthereumAssetRegistryApiRecord,
	ethereumAssetBridgeCallData,
	parseEthereumAssetRegistrySnapshot,
	prepareEthereumAssetRegistrationFromRegistry
} from "../src/ethereum-assets"
import { buildEthereumTokenWithdrawalApproval } from "../src/ethereum-token"
import type { EthereumAssetRecord } from "../src/types"

const SIGN_BIT = 1n << 255n
const U128_MAX = (1n << 128n) - 1n
const fieldHex = (value: bigint): string => `0x${value.toString(16).padStart(64, "0")}`

const packedKey = (key: PublicKey): string => {
	const [x, odd] = key.toFields()
	if (!x || !odd) throw new Error("Invalid test public key")
	return fieldHex(x.toBigInt() | (odd.toBigInt() === 0n ? 0n : SIGN_BIT))
}

const record = (
	index: number,
	vaultPublicKey: PublicKey,
	mftStandardVkId: Field,
	universalBridgeVkId: Field
): {
	native: EthereumAssetRecord
	api: EthereumAssetRegistryApiRecord
	fields: Field[]
} => {
	const tokenOwnerL2 = PrivateKey.random().toPublicKey()
	const tokenIdL2 = TokenId.derive(tokenOwnerL2)
	const assetId = BigInt(10_000 + index)
	const tokenAddress = BigInt(0xa1 + index)
	const [ownerX, ownerOdd] = tokenOwnerL2.toFields()
	const [vaultX, vaultOdd] = vaultPublicKey.toFields()
	if (!ownerX || !ownerOdd || !vaultX || !vaultOdd) {
		throw new Error("Invalid test public key")
	}
	return {
		native: {
			schemaVersion: 1,
			registryIndex: index,
			assetId: fieldHex(assetId),
			ethereumTokenAddress: `0x${tokenAddress.toString(16).padStart(40, "0")}`,
			tokenOwnerL2,
			tokenIdL2,
			decimals: 9,
			inventoryCap: UInt64.from(1_000_000),
			mftStandardVkId,
			vaultPublicKey,
			universalBridgeVkId
		},
		api: {
			schemaVersion: 1,
			registryIndex: index,
			assetId: fieldHex(assetId),
			ethereumTokenAddress: `0x${tokenAddress.toString(16).padStart(40, "0")}`,
			tokenOwnerL2: packedKey(tokenOwnerL2),
			tokenIdL2: fieldHex(tokenIdL2.toBigInt()),
			decimals: 9,
			inventoryCap: "1000000",
			mftStandardVkId: fieldHex(mftStandardVkId.toBigInt()),
			vaultPublicKey: packedKey(vaultPublicKey),
			universalBridgeVkId: fieldHex(universalBridgeVkId.toBigInt())
		},
		fields: [
			Field(1),
			Field(index),
			Field(assetId >> 128n),
			Field(assetId & U128_MAX),
			Field(tokenAddress),
			ownerX,
			ownerOdd,
			tokenIdL2,
			Field(9),
			Field(1_000_000),
			mftStandardVkId,
			vaultX,
			vaultOdd,
			universalBridgeVkId
		]
	}
}

const fixture = () => {
	const vaultPublicKey = PrivateKey.random().toPublicKey()
	const mftStandardVkId = Field(9001)
	const universalBridgeVkId = Field(9002)
	const records = [
		record(0, vaultPublicKey, mftStandardVkId, universalBridgeVkId),
		record(1, vaultPublicKey, mftStandardVkId, universalBridgeVkId)
	]
	const leaves = Array.from({ length: 256 }, () => Field(0))
	for (const item of records) {
		leaves[item.api.registryIndex] = Poseidon.hashWithPrefix(
			"Ethereum asset registry leaf V1",
			item.fields
		)
	}
	const levels = [leaves]
	while (levels.at(-1)?.length !== 1) {
		const current = levels.at(-1)
		if (!current) throw new Error("Missing test Merkle level")
		levels.push(
			Array.from({ length: current.length / 2 }, (_, index) =>
				Poseidon.hashWithPrefix("Ethereum asset registry node V1", [
					current[index * 2],
					current[index * 2 + 1]
				])
			)
		)
	}
	const path = (index: number) =>
		levels.slice(0, -1).map((level, height) => fieldHex(level[(index >> height) ^ 1].toBigInt()))
	return {
		runtime: {
			ethereumAssets: {
				registryPublicKey: PrivateKey.random().toPublicKey(),
				vaultPublicKey,
				registrySchemaVersion: 1,
				approvedMftStandardVkId: mftStandardVkId,
				universalBridgeVkId,
				bridgeVerificationKeyHash: Field(9003),
				registryVerificationKeyHash: Field(9004)
			}
		},
		snapshot: {
			schemaVersion: 1,
			depth: 8,
			root: fieldHex(levels.at(-1)?.[0].toBigInt() ?? 0n),
			count: 2,
			records: records.map(({ api }) => ({ record: api, path: path(api.registryIndex) }))
		}
	}
}

describe("universal Ethereum asset memberships", () => {
	it("matches the OCaml bridge account-update vectors", async () => {
		Mina.setActiveInstance(await Mina.LocalBlockchain({ proofsEnabled: false }))
		const record: EthereumAssetRecord = {
			schemaVersion: 1,
			registryIndex: 0,
			assetId: fieldHex((1n << 128n) + 2n),
			ethereumTokenAddress: `0x${5000n.toString(16).padStart(40, "0")}`,
			tokenOwnerL2: PublicKey.fromFields([Field(344213), Field(1)]),
			tokenIdL2: Field(
				"4577977917597607045863284126668314124667649089740894741873158063619412226600"
			),
			decimals: 6,
			inventoryCap: UInt64.from(100_000_000),
			mftStandardVkId: Field(777),
			vaultPublicKey: PublicKey.fromFields([Field(11111), Field(0)]),
			universalBridgeVkId: Field(778)
		}
		const amount = UInt64.from(2_000_000)

		expect(fieldHex(ethereumAssetBridgeCallData(record, amount).toBigInt())).toBe(
			"0x19a86bb8c106848e3bab8dd79491cbc4589f28b33227007eb60409efa56e12d0"
		)
		const { registry } = buildEthereumTokenWithdrawalApproval({
			config: {
				assetId: record.assetId,
				ethereumTokenAddress: record.ethereumTokenAddress,
				tokenOwnerL2: record.tokenOwnerL2,
				tokenIdL2: record.tokenIdL2,
				holderAccountL2: record.vaultPublicKey,
				verificationKeyHash: Field(999)
			},
			membership: {
				root: Field(
					"21764611412127449418947192256791981546502136485622468759540630220336889558797"
				),
				count: 1,
				schemaVersion: 1,
				record
			},
			registryPublicKey: PublicKey.fromFields([Field(22223), Field(1)]),
			sender: record.tokenOwnerL2,
			amount
		})
		expect(fieldHex(registry.hash().toBigInt())).toBe(
			"0x2c383e7260ea384af96f3c833feee18b10a1d614f852076287c1cb513e5b47d6"
		)
	})

	it("authenticates two token records against one runtime and emits exact OCaml witness JSON", () => {
		const { runtime, snapshot } = fixture()
		const assets = parseEthereumAssetRegistrySnapshot(runtime, snapshot)

		expect(assets).toHaveLength(2)
		expect(assets[0]?.config.verificationKeyHash.equals(Field(9003)).toBoolean()).toBe(true)
		expect(assets[1]?.config.verificationKeyHash.equals(Field(9003)).toBoolean()).toBe(true)
		expect(assets[0]?.config.tokenOwnerL2.equals(assets[1].config.tokenOwnerL2).toBoolean()).toBe(
			false
		)
		const witness = JSON.parse(assets[0]?.membership.witnessJson ?? "{}")
		expect(witness.state).toMatchObject({ leaf_count: "2", schema_version: "1" })
		expect(witness.record).toMatchObject({
			registry_index: "0",
			decimals: "9",
			inventory_cap: "0.001"
		})
		expect(witness.state.root).toMatch(/^0x[0-9A-F]{64}$/)
		expect(witness.record.ethereum_token_address).toMatch(/^0x[0-9A-F]{64}$/)
		expect(witness.path).toHaveLength(8)
	})

	it("rejects a changed path and shared runtime identity", () => {
		const { runtime, snapshot } = fixture()
		const wrongPath = structuredClone(snapshot)
		wrongPath.records[0].path[0] = fieldHex(123n)
		expect(() => parseEthereumAssetRegistrySnapshot(runtime, wrongPath)).toThrow("does not match")

		const wrongVk = structuredClone(snapshot)
		wrongVk.records[1].record.universalBridgeVkId = fieldHex(123n)
		expect(() => parseEthereumAssetRegistrySnapshot(runtime, wrongVk)).toThrow(
			"wrong universal bridge VK"
		)

		const overCapacity = structuredClone(snapshot)
		overCapacity.records[0].record.registryIndex = 256
		expect(() => parseEthereumAssetRegistrySnapshot(runtime, overCapacity)).toThrow(
			"Registry index is outside its canonical range"
		)
	})

	it("builds an exhaustive append witness for the next record", () => {
		const { runtime, snapshot } = fixture()
		const current = parseEthereumAssetRegistrySnapshot(runtime, snapshot)
		const candidate = record(
			2,
			runtime.ethereumAssets.vaultPublicKey,
			runtime.ethereumAssets.approvedMftStandardVkId,
			runtime.ethereumAssets.universalBridgeVkId
		).native
		const registration = prepareEthereumAssetRegistrationFromRegistry(runtime, current, candidate)
		const witness = JSON.parse(registration.witnessJson)

		expect(registration.oldCount).toBe(2)
		expect(registration.appendPath).toHaveLength(8)
		expect(witness.old_state.leaf_count).toBe("2")
		expect(witness.candidate.registry_index).toBe("2")
		expect(witness.existing).toHaveLength(2)
		expect(witness.append_path).toHaveLength(8)
		expect(() =>
			prepareEthereumAssetRegistrationFromRegistry(runtime, current, {
				...candidate,
				assetId: current[0].membership.record.assetId
			})
		).toThrow("duplicates")
	})
})
