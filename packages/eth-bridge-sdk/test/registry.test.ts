import type { Hex } from "viem"
import { describe, expect, it } from "vitest"
import {
	type EthereumAssetRecord,
	EthereumAssetRegistry,
	type EthereumAssetRegistrySnapshot,
	ethereumAssetRecordBatchMembership,
	hashEthereumAssetRecord
} from "../src/registry"

const word = (byte: string) => `0x${byte.repeat(32)}` as Hex
const address = (suffix: string) => `0x${"00".repeat(19)}${suffix}` as `0x${string}`

const record = (registryIndex: number, suffix: string): EthereumAssetRecord => ({
	schemaVersion: 1,
	registryIndex,
	assetId: word(suffix),
	ethereumTokenAddress: address(suffix),
	tokenOwnerL2: word(`${Number.parseInt(suffix, 16) + 16}`.padStart(2, "0")),
	tokenIdL2: word(`${Number.parseInt(suffix, 16) + 32}`.padStart(2, "0")),
	decimals: 9,
	inventoryCap: 1_000_000n,
	mftStandardVkId: word("71"),
	vaultPublicKey: word("72"),
	universalBridgeVkId: word("73")
})

const path = (byte: string) => Array.from({ length: 8 }, () => word(byte))

const snapshot = (
	records: EthereumAssetRecord[],
	root = word("80")
): EthereumAssetRegistrySnapshot => ({
	schemaVersion: 1,
	root,
	count: records.length,
	depth: 8,
	records: records.map((asset, index) => ({
		record: asset,
		path: path(`${index + 1}`.padStart(2, "0"))
	}))
})

describe("universal Ethereum asset registry", () => {
	it("resolves two immutable assets through one universal configuration", () => {
		const first = record(0, "01")
		const second = record(1, "02")
		const registry = new EthereumAssetRegistry(snapshot([first, second]), {
			schemaVersion: 1,
			depth: 8,
			mftStandardVkId: word("71"),
			vaultPublicKey: word("72"),
			universalBridgeVkId: word("73")
		})

		expect(registry.byIndex(0).record).toEqual(first)
		expect(registry.byAssetId(second.assetId).record).toEqual(second)
		expect(registry.byEthereumToken(second.ethereumTokenAddress).record).toEqual(second)
		expect(registry.membership(first).path).toHaveLength(8)
		expect(hashEthereumAssetRecord(first)).toMatch(/^0x[0-9a-f]{64}$/)
	})

	it("refreshes paths after append without changing historical records", () => {
		const first = record(0, "01")
		const registry = new EthereumAssetRegistry(snapshot([first], word("80")))
		const oldPath = registry.byIndex(0).path
		const appended = snapshot([first, record(1, "02")], word("81"))
		const refreshed = registry.refresh({
			...appended,
			records: [{ ...appended.records[0], path: path("09") }, appended.records[1]]
		})

		expect(refreshed.root).toBe(word("81"))
		expect(refreshed.byIndex(0).record).toEqual(first)
		expect(refreshed.byIndex(0).path).not.toEqual(oldPath)
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
		expect(firstMembership.proof).not.toEqual(secondMembership.proof)
		expect(() => ethereumAssetRecordBatchMembership([first], second)).toThrow(
			/not in the settlement batch/i
		)
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
		["unsupported decimals", () => snapshot([{ ...record(0, "01"), decimals: 10 }])]
	])("rejects %s", (_name, malformed) => {
		expect(() => new EthereumAssetRegistry(malformed())).toThrow()
	})

	it("rejects record drift and wrong universal VK configuration before submission", () => {
		const first = record(0, "01")
		const registry = new EthereumAssetRegistry(snapshot([first]), {
			schemaVersion: 1,
			depth: 8,
			mftStandardVkId: word("71"),
			vaultPublicKey: word("72"),
			universalBridgeVkId: word("73")
		})
		expect(() => registry.membership({ ...first, inventoryCap: first.inventoryCap + 1n })).toThrow(
			/record/i
		)
		expect(
			() =>
				new EthereumAssetRegistry(snapshot([first]), {
					schemaVersion: 1,
					depth: 8,
					mftStandardVkId: word("71"),
					vaultPublicKey: word("72"),
					universalBridgeVkId: word("74")
				})
		).toThrow(/bridge VK/i)
	})
})
