import { Field, Poseidon, TokenId } from "o1js"
import { concatHex, type Hex, keccak256, toBytes } from "viem"
import { describe, expect, it } from "vitest"
import { authenticateEthereumAssetRegistrySnapshot } from "../src/client"
import { unpackZekoAddress } from "../src/codecs"
import {
	type EthereumAssetRecord,
	EthereumAssetRegistry,
	type EthereumAssetRegistrySnapshot,
	ethereumAssetRecordBatchLeaf,
	ethereumAssetRecordBatchMembership,
	hashEthereumAssetRecord
} from "../src/registry"

const U128_MAX = (1n << 128n) - 1n
const PUBLIC_KEY_SIGN_BIT = 1n << 255n
const word = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}` as Hex
const address = (suffix: string) => `0x${"00".repeat(19)}${suffix}` as `0x${string}`
const packedKey = (x: bigint, isOdd: boolean) => word(x | (isOdd ? PUBLIC_KEY_SIGN_BIT : 0n))

const record = (registryIndex: number, suffix: string): EthereumAssetRecord => ({
	schemaVersion: 1,
	registryIndex,
	assetId: word(BigInt(`0x${suffix.repeat(32)}`)),
	ethereumTokenAddress: address(suffix),
	tokenOwnerL2: packedKey(BigInt(Number.parseInt(suffix, 16) + 16), registryIndex % 2 === 0),
	tokenIdL2: word(
		TokenId.derive(
			unpackZekoAddress(
				packedKey(BigInt(Number.parseInt(suffix, 16) + 16), registryIndex % 2 === 0)
			)
		).toBigInt()
	),
	decimals: 9,
	inventoryCap: 1_000_000n,
	mftStandardVkId: word(0x71n),
	vaultPublicKey: packedKey(0x72n, true),
	universalBridgeVkId: word(0x73n)
})

const recordFields = (record: EthereumAssetRecord): Field[] => {
	const assetId = BigInt(record.assetId)
	const unpackKey = (value: Hex): [Field, Field] => {
		const packed = BigInt(value)
		return [Field(packed & (PUBLIC_KEY_SIGN_BIT - 1n)), Field(packed & PUBLIC_KEY_SIGN_BIT ? 1 : 0)]
	}
	const [ownerX, ownerOdd] = unpackKey(record.tokenOwnerL2)
	const [vaultX, vaultOdd] = unpackKey(record.vaultPublicKey)
	return [
		Field(record.schemaVersion),
		Field(record.registryIndex),
		Field(assetId >> 128n),
		Field(assetId & U128_MAX),
		Field(BigInt(record.ethereumTokenAddress)),
		ownerX,
		ownerOdd,
		Field(BigInt(record.tokenIdL2)),
		Field(record.decimals),
		Field(record.inventoryCap),
		Field(BigInt(record.mftStandardVkId)),
		vaultX,
		vaultOdd,
		Field(BigInt(record.universalBridgeVkId))
	]
}

const registryNode = (left: Field, right: Field): Field =>
	Poseidon.hashWithPrefix("Ethereum asset registry node V1", [left, right])

const registryLevels = (records: readonly EthereumAssetRecord[]): readonly (readonly Field[])[] => {
	const leaves = Array.from({ length: 256 }, (_, index) => {
		const asset = records.find((candidate) => candidate.registryIndex === index)
		return asset
			? Poseidon.hashWithPrefix("Ethereum asset registry leaf V1", recordFields(asset))
			: Field(0)
	})
	const build = (level: readonly Field[]): readonly (readonly Field[])[] =>
		level.length === 1
			? [level]
			: [
					level,
					...build(
						Array.from({ length: level.length / 2 }, (_, index) =>
							registryNode(level[index * 2], level[index * 2 + 1])
						)
					)
				]
	return build(leaves)
}

const snapshot = (records: EthereumAssetRecord[]): EthereumAssetRegistrySnapshot => ({
	...(() => {
		const levels = registryLevels(records)
		const root = levels.at(-1)?.[0]
		if (!root) throw new Error("Missing test registry root")
		return {
			schemaVersion: 1,
			root: word(root.toBigInt()),
			count: records.length,
			depth: 8,
			records: records.map((asset) => ({
				record: asset,
				path: levels
					.slice(0, -1)
					.map((level, height) => word(level[(asset.registryIndex >> height) ^ 1].toBigInt()))
			}))
		}
	})()
})

describe("universal Ethereum asset registry", () => {
	it("resolves two immutable assets through one universal configuration", () => {
		const first = record(0, "01")
		const second = record(1, "02")
		const registry = new EthereumAssetRegistry(snapshot([first, second]), {
			schemaVersion: 1,
			depth: 8,
			mftStandardVkId: word(0x71n),
			vaultPublicKey: packedKey(0x72n, true),
			universalBridgeVkId: word(0x73n)
		})

		expect(registry.byIndex(0).record).toEqual(first)
		expect(registry.byAssetId(second.assetId).record).toEqual(second)
		expect(registry.byEthereumToken(second.ethereumTokenAddress).record).toEqual(second)
		expect(registry.membership(first).path).toHaveLength(8)
		expect(hashEthereumAssetRecord(first)).toMatch(/^0x[0-9a-f]{64}$/)
	})

	it("returns frozen copies without exposing authenticated internal entries", () => {
		const first = record(0, "01")
		const registry = new EthereumAssetRegistry(snapshot([first]))
		const entry = registry.byIndex(0)

		expect(Object.isFrozen(entry)).toBe(true)
		expect(Object.isFrozen(entry.record)).toBe(true)
		expect(Object.isFrozen(entry.path)).toBe(true)
		expect(Reflect.set(entry.record, "inventoryCap", 2_000_000n)).toBe(false)
		expect(Reflect.set(entry.path, "0", word(999n))).toBe(false)
		expect(registry.membership(first).record).toEqual(first)
	})

	it("requires a caller snapshot to be anchored to all authenticated runtime identities", () => {
		const first = record(0, "01")
		const input = { snapshot: snapshot([first]) }
		const runtimeAssets = {
			registrySchemaVersion: 1,
			registryRoot: Field(BigInt(input.snapshot.root)),
			registryCount: 1,
			approvedMftStandardVkId: Field(BigInt(first.mftStandardVkId)),
			vaultPublicKey: unpackZekoAddress(first.vaultPublicKey),
			universalBridgeVkId: Field(BigInt(first.universalBridgeVkId))
		}

		expect(() => authenticateEthereumAssetRegistrySnapshot(input, null)).toThrow(
			"authenticated Zeko runtime"
		)
		expect(() => authenticateEthereumAssetRegistrySnapshot(input, runtimeAssets)).not.toThrow()
		expect(() =>
			authenticateEthereumAssetRegistrySnapshot(input, {
				...runtimeAssets,
				vaultPublicKey: unpackZekoAddress(packedKey(0x74n, false))
			})
		).toThrow(/vault|configuration/i)
	})

	it("refreshes paths after append without changing historical records", () => {
		const first = record(0, "01")
		const registry = new EthereumAssetRegistry(snapshot([first]))
		const oldPath = registry.byIndex(0).path
		const appended = snapshot([first, record(1, "02")])
		const refreshed = registry.refresh(appended, {
			schemaVersion: 1,
			depth: 8,
			root: appended.root,
			count: appended.count,
			mftStandardVkId: first.mftStandardVkId,
			vaultPublicKey: first.vaultPublicKey,
			universalBridgeVkId: first.universalBridgeVkId
		})

		expect(refreshed.root).toBe(appended.root)
		expect(refreshed.byIndex(0).record).toEqual(first)
		expect(refreshed.byIndex(0).path).not.toEqual(oldPath)
		expect(() =>
			registry.refresh(appended, {
				schemaVersion: 1,
				depth: 8,
				root: word(999n),
				count: appended.count,
				mftStandardVkId: first.mftStandardVkId,
				vaultPublicKey: first.vaultPublicKey,
				universalBridgeVkId: first.universalBridgeVkId
			})
		).toThrow(/authenticated runtime root/i)
	})

	it("lets an authenticated first append establish empty shared identities", () => {
		const empty = new EthereumAssetRegistry(snapshot([]))
		const first = record(0, "01")
		const appended = snapshot([first])
		const refreshed = empty.refresh(appended, {
			schemaVersion: 1,
			depth: 8,
			root: appended.root,
			count: 1,
			mftStandardVkId: first.mftStandardVkId,
			vaultPublicKey: first.vaultPublicKey,
			universalBridgeVkId: first.universalBridgeVkId
		})

		expect(refreshed.byIndex(0).record).toEqual(first)
	})

	it("compares records independently of object property insertion order", () => {
		const first = record(0, "01")
		const registry = new EthereumAssetRegistry(snapshot([first]))
		const reordered: EthereumAssetRecord = {
			inventoryCap: first.inventoryCap,
			universalBridgeVkId: first.universalBridgeVkId,
			vaultPublicKey: first.vaultPublicKey,
			mftStandardVkId: first.mftStandardVkId,
			decimals: first.decimals,
			tokenIdL2: first.tokenIdL2,
			tokenOwnerL2: first.tokenOwnerL2,
			ethereumTokenAddress: first.ethereumTokenAddress,
			assetId: first.assetId,
			registryIndex: first.registryIndex,
			schemaVersion: first.schemaVersion
		}

		expect(registry.membership(reordered).record).toEqual(first)
	})

	it("rejects a wrong Poseidon root, path, or record while accepting odd compressed keys", () => {
		const first = record(0, "01")
		const valid = snapshot([first])
		expect(BigInt(first.tokenOwnerL2) & PUBLIC_KEY_SIGN_BIT).toBe(PUBLIC_KEY_SIGN_BIT)
		expect(() => new EthereumAssetRegistry(valid)).not.toThrow()
		expect(() => new EthereumAssetRegistry({ ...valid, root: word(123n) })).toThrow(
			/registry root|membership/i
		)
		expect(
			() =>
				new EthereumAssetRegistry({
					...valid,
					records: [
						{
							...valid.records[0],
							path: [word(456n), ...valid.records[0].path.slice(1)]
						}
					]
				})
		).toThrow(/registry root|membership|path/i)
		expect(
			() =>
				new EthereumAssetRegistry({
					...valid,
					records: [
						{
							...valid.records[0],
							record: { ...first, inventoryCap: first.inventoryCap + 1n }
						}
					]
				})
		).toThrow(/registry root|membership|record/i)
	})

	it("builds one exact settlement batch root with asset-specific depth-8 proofs", () => {
		const first = record(0, "01")
		const second = record(1, "02")
		const firstMembership = ethereumAssetRecordBatchMembership([first, second], first)
		const secondMembership = ethereumAssetRecordBatchMembership([first, second], second)

		expect(firstMembership.root).toBe(secondMembership.root)
		expect(firstMembership.proof).toHaveLength(8)
		expect(secondMembership.proof).toHaveLength(8)
		expect(firstMembership.recordHash).not.toBe(secondMembership.recordHash)
		expect(firstMembership.recordCommitment).not.toBe(secondMembership.recordCommitment)
		expect(firstMembership.proof).not.toEqual(secondMembership.proof)
		expect(() => ethereumAssetRecordBatchMembership([first], second)).toThrow(
			/not in the settlement batch/i
		)
	})

	it("matches the canonical V2 settlement-batch leaf and root", () => {
		const first = record(0, "01")
		const membership = ethereumAssetRecordBatchMembership([first], first)
		const leafDomain = keccak256(toBytes("ZEKO_ASSET_RECORD_BATCH_LEAF_V2"))
		const nodeDomain = keccak256(toBytes("ZEKO_ASSET_RECORD_BATCH_NODE_V1"))
		let computed = keccak256(
			concatHex([leafDomain, membership.recordHash, membership.recordCommitment])
		)
		for (const sibling of membership.proof) {
			computed = keccak256(concatHex([nodeDomain, computed, sibling]))
		}

		expect(membership.root).toBe(computed)
	})

	it("matches the shared V2 settlement-batch golden vector", () => {
		const recordHash = `0x${"11".repeat(32)}` as Hex
		const recordCommitment = `0x${"22".repeat(32)}` as Hex
		const nodeDomain = keccak256(toBytes("ZEKO_ASSET_RECORD_BATCH_NODE_V1"))
		let root = ethereumAssetRecordBatchLeaf(recordHash, recordCommitment)
		let zero = `0x${"00".repeat(32)}` as Hex
		expect(root).toBe("0xd3c4982b15c04f3dc43bb070575355bb0155b6298b01f5858a51431c9dabd1fc")
		for (let level = 0; level < 8; level += 1) {
			root = keccak256(concatHex([nodeDomain, root, zero]))
			zero = keccak256(concatHex([nodeDomain, zero, zero]))
		}
		expect(root).toBe("0x3585343cc90a5d46ee8d6fa33b86040ea6ff3845175e8fb64640469392a10a3b")
	})

	it.each([
		["sparse indices", () => snapshot([record(1, "01")])],
		["index outside the depth-8 capacity", () => snapshot([record(256, "01")])],
		[
			"duplicate token",
			() => {
				const first = record(0, "01")
				const second = { ...record(1, "02"), ethereumTokenAddress: first.ethereumTokenAddress }
				return snapshot([first, second])
			}
		],
		[
			"duplicate L2 identity",
			() => {
				const first = record(0, "01")
				const second = {
					...record(1, "02"),
					tokenOwnerL2: first.tokenOwnerL2,
					tokenIdL2: first.tokenIdL2
				}
				return snapshot([first, second])
			}
		],
		[
			"wrong path width",
			() => ({ ...snapshot([record(0, "01")]), records: [{ record: record(0, "01"), path: [] }] })
		],
		["wrong count", () => ({ ...snapshot([record(0, "01")]), count: 2 })],
		[
			"zero Ethereum token address",
			() => snapshot([{ ...record(0, "01"), ethereumTokenAddress: address("00") }])
		],
		["unsupported decimals", () => snapshot([{ ...record(0, "01"), decimals: 10 }])]
	])("rejects %s", (_name, malformed) => {
		expect(() => new EthereumAssetRegistry(malformed())).toThrow()
	})

	it("rejects record drift and wrong universal VK configuration before submission", () => {
		const first = record(0, "01")
		const registry = new EthereumAssetRegistry(snapshot([first]), {
			schemaVersion: 1,
			depth: 8,
			mftStandardVkId: word(0x71n),
			vaultPublicKey: packedKey(0x72n, true),
			universalBridgeVkId: word(0x73n)
		})
		expect(() => registry.membership({ ...first, inventoryCap: first.inventoryCap + 1n })).toThrow(
			/record/i
		)
		expect(
			() =>
				new EthereumAssetRegistry(snapshot([first]), {
					schemaVersion: 1,
					depth: 8,
					mftStandardVkId: word(0x71n),
					vaultPublicKey: packedKey(0x72n, true),
					universalBridgeVkId: word(0x74n)
				})
		).toThrow(/bridge VK/i)
	})
})
