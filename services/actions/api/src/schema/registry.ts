import { and, desc, eq, sql } from "drizzle-orm"
import {
	ethereumAssetRecords,
	ethereumAssetRegistryCheckpoints,
	ethereumAssetRegistryMemberships
} from "../../drizzle/schema"
import { builder } from "../builder"
import type { Database } from "../db"

type RegistryLookup = {
	root?: string | null
	index?: number | null
	assetId?: string | null
	ethereumTokenAddress?: string | null
}

type EthereumAssetRecord = {
	schemaVersion: number
	registryIndex: number
	assetId: string
	ethereumTokenAddress: string
	tokenOwnerL2: string
	tokenIdL2: string
	decimals: number
	inventoryCap: string
	mftStandardVkId: string
	vaultPublicKey: string
	universalBridgeVkId: string
	blockHeight: number
	timestamp: string
	txnHash: string
	finalityStatus: string
}

type EthereumAssetEntry = {
	record: EthereumAssetRecord
	path: string[]
}

type EthereumAssetRegistrySnapshot = {
	schemaVersion: number
	depth: number
	root: string
	count: number
	blockHeight: number
	timestamp: string
	txnHash: string
	finalityStatus: string
	records: EthereumAssetEntry[]
}

type DatabaseInstance = ReturnType<Database>

export async function queryEthereumAssetRegistry(
	db: DatabaseInstance,
	input: RegistryLookup
): Promise<EthereumAssetRegistrySnapshot | null> {
	const lookupCount = [input.index, input.assetId, input.ethereumTokenAddress].filter(
		(value) => value !== undefined && value !== null
	).length
	if (lookupCount > 1) throw new Error("Provide at most one Ethereum asset lookup key")

	const [checkpoint] = input.root
		? await db.drizzle
				.select()
				.from(ethereumAssetRegistryCheckpoints)
				.where(eq(ethereumAssetRegistryCheckpoints.root, input.root.toLowerCase()))
				.limit(1)
		: await db.drizzle
				.select()
				.from(ethereumAssetRegistryCheckpoints)
				.orderBy(desc(ethereumAssetRegistryCheckpoints.count))
				.limit(1)
	if (!checkpoint) return null

	const lookupCondition =
		input.index !== undefined && input.index !== null
			? eq(ethereumAssetRecords.registryIndex, input.index)
			: input.assetId
				? sql`lower(${ethereumAssetRecords.assetId}) = lower(${input.assetId})`
				: input.ethereumTokenAddress
					? sql`lower(${ethereumAssetRecords.ethereumTokenAddress}) = lower(${input.ethereumTokenAddress})`
					: undefined
	const rows = await db.drizzle
		.select({ record: ethereumAssetRecords, membership: ethereumAssetRegistryMemberships })
		.from(ethereumAssetRegistryMemberships)
		.innerJoin(
			ethereumAssetRecords,
			eq(ethereumAssetRecords.registryIndex, ethereumAssetRegistryMemberships.registryIndex)
		)
		.where(and(eq(ethereumAssetRegistryMemberships.root, checkpoint.root), lookupCondition))
		.orderBy(ethereumAssetRecords.registryIndex)

	return {
		schemaVersion: checkpoint.schemaVersion,
		depth: checkpoint.depth,
		root: checkpoint.root,
		count: checkpoint.count,
		blockHeight: checkpoint.blockHeight,
		timestamp: checkpoint.timestamp.toISOString(),
		txnHash: checkpoint.txnHash,
		finalityStatus: checkpoint.finalityStatus,
		records: rows.map(({ record, membership }) => ({
			record: {
				schemaVersion: record.schemaVersion,
				registryIndex: record.registryIndex,
				assetId: record.assetId,
				ethereumTokenAddress: record.ethereumTokenAddress,
				tokenOwnerL2: record.tokenOwnerL2,
				tokenIdL2: record.tokenIdL2,
				decimals: record.decimals,
				inventoryCap: record.inventoryCap.toString(),
				mftStandardVkId: record.mftStandardVkId,
				vaultPublicKey: record.vaultPublicKey,
				universalBridgeVkId: record.universalBridgeVkId,
				blockHeight: record.blockHeight,
				timestamp: record.timestamp.toISOString(),
				txnHash: record.txnHash,
				finalityStatus: record.finalityStatus
			},
			path: membership.path
		}))
	}
}

const EthereumAssetRecordObject = builder
	.objectRef<EthereumAssetRecord>("EthereumAssetRecord")
	.implement({
		fields: (t) => ({
			schemaVersion: t.exposeInt("schemaVersion"),
			registryIndex: t.exposeInt("registryIndex"),
			assetId: t.exposeString("assetId"),
			ethereumTokenAddress: t.exposeString("ethereumTokenAddress"),
			tokenOwnerL2: t.exposeString("tokenOwnerL2"),
			tokenIdL2: t.exposeString("tokenIdL2"),
			decimals: t.exposeInt("decimals"),
			inventoryCap: t.exposeString("inventoryCap"),
			mftStandardVkId: t.exposeString("mftStandardVkId"),
			vaultPublicKey: t.exposeString("vaultPublicKey"),
			universalBridgeVkId: t.exposeString("universalBridgeVkId"),
			blockHeight: t.exposeInt("blockHeight"),
			timestamp: t.exposeString("timestamp"),
			txnHash: t.exposeString("txnHash"),
			finalityStatus: t.exposeString("finalityStatus")
		})
	})

const EthereumAssetEntryObject = builder
	.objectRef<EthereumAssetEntry>("EthereumAssetEntry")
	.implement({
		fields: (t) => ({
			record: t.field({ type: EthereumAssetRecordObject, resolve: (value) => value.record }),
			path: t.exposeStringList("path")
		})
	})

const EthereumAssetRegistrySnapshotObject = builder
	.objectRef<EthereumAssetRegistrySnapshot>("EthereumAssetRegistrySnapshot")
	.implement({
		fields: (t) => ({
			schemaVersion: t.exposeInt("schemaVersion"),
			depth: t.exposeInt("depth"),
			root: t.exposeString("root"),
			count: t.exposeInt("count"),
			blockHeight: t.exposeInt("blockHeight"),
			timestamp: t.exposeString("timestamp"),
			txnHash: t.exposeString("txnHash"),
			finalityStatus: t.exposeString("finalityStatus"),
			records: t.field({ type: [EthereumAssetEntryObject], resolve: (value) => value.records })
		})
	})

const EthereumAssetRegistryInput = builder.inputType("EthereumAssetRegistryInput", {
	fields: (t) => ({
		root: t.string(),
		index: t.int(),
		assetId: t.string(),
		ethereumTokenAddress: t.string()
	})
})

builder.queryType({
	fields: (t) => ({
		ethereumAssetRegistry: t.field({
			type: EthereumAssetRegistrySnapshotObject,
			nullable: true,
			args: { input: t.arg({ type: EthereumAssetRegistryInput, required: false }) },
			resolve: async (_root, { input }, { database }) => {
				using db = database({ cache: true })
				return queryEthereumAssetRegistry(db, input ?? {})
			}
		})
	})
})
