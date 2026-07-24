import { describe, expect, it } from "vitest"
import {
	buildRegistrySnapshot,
	findRegistryAsset,
	type RegistryArchiveEvent,
	verifyRegistryMembership
} from "../src/asset-registry"

const event = (
	index: number,
	overrides: Partial<{
		token: bigint
		ownerX: bigint
		ownerIsOdd: bigint
		tokenId: bigint
	}> = {}
): RegistryArchiveEvent => ({
	blockHeight: 100 + index,
	timestamp: new Date(1_700_000_000_000 + index),
	txnHash: `tx-${index}`,
	fields: [
		"1",
		index.toString(),
		"0",
		(1000 + index).toString(),
		(overrides.token ?? BigInt(3000 + index)).toString(),
		(overrides.ownerX ?? BigInt(4000 + index)).toString(),
		(overrides.ownerIsOdd ?? BigInt(index % 2)).toString(),
		(overrides.tokenId ?? BigInt(5000 + index)).toString(),
		(6 + index).toString(),
		(1_000_000 + index).toString(),
		"6000",
		"7000",
		"0",
		"8000"
	]
})

describe("universal Ethereum asset registry indexing", () => {
	it("builds one current checkpoint and resolves two immutable assets by every key", () => {
		const snapshot = buildRegistrySnapshot([event(0), event(1)])

		expect(snapshot.schemaVersion).toBe(1)
		expect(snapshot.depth).toBe(8)
		expect(snapshot.count).toBe(2)
		expect(snapshot.records.map((entry) => entry.record.registryIndex)).toEqual([0, 1])
		expect(verifyRegistryMembership(snapshot, snapshot.records[0])).toBe(true)
		expect(verifyRegistryMembership(snapshot, snapshot.records[1])).toBe(true)

		const second = snapshot.records[1].record
		expect(findRegistryAsset(snapshot, { index: 1 }).record).toEqual(second)
		expect(findRegistryAsset(snapshot, { assetId: second.assetId }).record).toEqual(second)
		expect(
			findRegistryAsset(snapshot, { ethereumTokenAddress: second.ethereumTokenAddress }).record
		).toEqual(second)
	})

	it("preserves an old record while refreshing its path after append", () => {
		const before = buildRegistrySnapshot([event(0)])
		const after = buildRegistrySnapshot([event(0), event(1)])

		expect(after.records[0].record).toEqual(before.records[0].record)
		expect(after.records[0].path).not.toEqual(before.records[0].path)
		expect(after.root).not.toBe(before.root)
		expect(verifyRegistryMembership(after, before.records[0])).toBe(false)
		expect(verifyRegistryMembership(after, after.records[0])).toBe(true)
	})

	it("rejects non-dense appends and duplicate immutable identities", () => {
		expect(() => buildRegistrySnapshot([event(1)])).toThrow(/dense|index/i)
		expect(() => buildRegistrySnapshot([event(0), event(1, { token: 3000n })])).toThrow(
			/duplicate.*token/i
		)
		expect(() =>
			buildRegistrySnapshot([event(0), event(1, { ownerX: 4000n, ownerIsOdd: 0n })])
		).toThrow(/duplicate.*owner/i)
		expect(() => buildRegistrySnapshot([event(0), event(1, { tokenId: 5000n })])).toThrow(
			/duplicate.*token id/i
		)
	})

	it("rejects malformed event widths, field ranges, and modified memberships", () => {
		expect(() =>
			buildRegistrySnapshot([{ ...event(0), fields: event(0).fields.slice(0, 13) }])
		).toThrow(/14 fields/i)
		expect(() =>
			buildRegistrySnapshot([
				{
					...event(0),
					fields: event(0).fields.map((value, index) =>
						index === 4 ? (1n << 160n).toString() : value
					)
				}
			])
		).toThrow(/160 bits/i)

		const snapshot = buildRegistrySnapshot([event(0)])
		const modified = {
			...snapshot.records[0],
			record: { ...snapshot.records[0].record, inventoryCap: 2_000_000n }
		}
		expect(verifyRegistryMembership(snapshot, modified)).toBe(false)
	})
})
