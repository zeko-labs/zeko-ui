// @vitest-environment node
// @vitest-pool forks
import { drizzle } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
	ethereumAssetRecords,
	ethereumAssetRegistryCheckpoints,
	ethereumAssetRegistryMemberships
} from "../drizzle/schema"
import type { Database } from "../src/db"
import { queryEthereumAssetRegistry } from "../src/schema/registry"

const word = (value: number) => `0x${value.toString(16).padStart(64, "0")}`
const path = (value: number) => Array.from({ length: 8 }, () => word(value))
const testDatabaseUrl =
	process.env.ACTIONS_API_TEST_DATABASE_URL ??
	"postgresql://postgres:postgres@localhost:5434/actions"

describe("Actions API - Ethereum asset registry", () => {
	let client: Sql
	let db: ReturnType<Database>["drizzle"]
	let testDb: ReturnType<Database>

	beforeAll(async () => {
		client = postgres(testDatabaseUrl, { max: 1, fetch_types: false })
		db = drizzle({ client, logger: false })
		testDb = { drizzle: db, client } as ReturnType<Database>
		await db.delete(ethereumAssetRegistryMemberships)
		await db.delete(ethereumAssetRecords)
		await db.delete(ethereumAssetRegistryCheckpoints)
		await db.insert(ethereumAssetRegistryCheckpoints).values([
			{
				root: word(101),
				count: 1,
				schemaVersion: 1,
				depth: 8,
				blockHeight: 10,
				timestamp: new Date("2026-07-24T00:00:00Z"),
				txnHash: "tx-0",
				finalityStatus: "canonical"
			},
			{
				root: word(102),
				count: 2,
				schemaVersion: 1,
				depth: 8,
				blockHeight: 11,
				timestamp: new Date("2026-07-24T00:01:00Z"),
				txnHash: "tx-1",
				finalityStatus: "pending"
			}
		])
		await db.insert(ethereumAssetRecords).values([
			{
				registryIndex: 0,
				schemaVersion: 1,
				assetId: word(201),
				ethereumTokenAddress: "0x0000000000000000000000000000000000000301",
				tokenOwnerL2: word(401),
				tokenIdL2: word(501),
				decimals: 6,
				inventoryCap: 1_000_000n,
				mftStandardVkId: word(601),
				vaultPublicKey: word(701),
				universalBridgeVkId: word(801),
				registeredRoot: word(101),
				blockHeight: 10,
				timestamp: new Date("2026-07-24T00:00:00Z"),
				txnHash: "tx-0",
				finalityStatus: "canonical"
			},
			{
				registryIndex: 1,
				schemaVersion: 1,
				assetId: word(202),
				ethereumTokenAddress: "0x0000000000000000000000000000000000000302",
				tokenOwnerL2: word(402),
				tokenIdL2: word(502),
				decimals: 7,
				inventoryCap: 1_000_001n,
				mftStandardVkId: word(601),
				vaultPublicKey: word(701),
				universalBridgeVkId: word(801),
				registeredRoot: word(102),
				blockHeight: 11,
				timestamp: new Date("2026-07-24T00:01:00Z"),
				txnHash: "tx-1",
				finalityStatus: "pending"
			}
		])
		await db.insert(ethereumAssetRegistryMemberships).values([
			{ root: word(101), registryIndex: 0, path: path(1) },
			{ root: word(102), registryIndex: 0, path: path(2) },
			{ root: word(102), registryIndex: 1, path: path(3) }
		])
	})

	afterAll(async () => {
		await db.delete(ethereumAssetRegistryMemberships)
		await db.delete(ethereumAssetRecords)
		await db.delete(ethereumAssetRegistryCheckpoints)
		await client.end()
	})

	it("returns the current two-asset snapshot and refreshed paths", async () => {
		const snapshot = await queryEthereumAssetRegistry(testDb, {})
		expect(snapshot?.root).toBe(word(102))
		expect(snapshot?.count).toBe(2)
		expect(snapshot?.finalityStatus).toBe("pending")
		expect(snapshot?.records.map((entry) => entry.record.registryIndex)).toEqual([0, 1])
		expect(snapshot?.records.map((entry) => entry.record.finalityStatus)).toEqual([
			"canonical",
			"pending"
		])
		expect(snapshot?.records[0].path).toEqual(path(2))
	})

	it("looks up the same immutable record by index, asset ID, or token", async () => {
		const byIndex = await queryEthereumAssetRegistry(testDb, { index: 1 })
		const byAsset = await queryEthereumAssetRegistry(testDb, { assetId: word(202) })
		const byToken = await queryEthereumAssetRegistry(testDb, {
			ethereumTokenAddress: "0x0000000000000000000000000000000000000302"
		})
		expect(byIndex?.records).toEqual(byAsset?.records)
		expect(byIndex?.records).toEqual(byToken?.records)
		expect(byIndex?.records[0].record.registryIndex).toBe(1)
	})

	it("can return historical membership without changing immutable records", async () => {
		const historical = await queryEthereumAssetRegistry(testDb, { root: word(101) })
		const current = await queryEthereumAssetRegistry(testDb, { index: 0 })
		expect(historical?.records[0].record).toEqual(current?.records[0].record)
		expect(historical?.records[0].path).toEqual(path(1))
		expect(current?.records[0].path).toEqual(path(2))
	})
})
