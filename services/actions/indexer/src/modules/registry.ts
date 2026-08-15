import {
	ethereumAssetRecords,
	ethereumAssetRegistryCheckpoints,
	ethereumAssetRegistryMemberships
} from "@zeko/actions-api"
import { fetchEventsQuery } from "@zeko-labs/graphql/mina-archive"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { filterArchiveActionsToRange } from "../archive-range"
import {
	buildRegistrySnapshot,
	type RegistryArchiveEvent,
	registryFinalityStatus
} from "../asset-registry"
import { batchInsert } from "../db"
import { env } from "../env"
import { getNetworkTip, l2Client, logger } from "../helper"

const BLOCK_RANGE_SIZE = 10_000

export async function fetchRegistryEvents(): Promise<RegistryArchiveEvent[]> {
	if (!env.REGISTRY_PK) throw new Error("REGISTRY_PK is required when registry indexing is enabled")
	const tip = await getNetworkTip(l2Client)
	const events: RegistryArchiveEvent[] = []
	for (let from = 0; from <= tip; from += BLOCK_RANGE_SIZE) {
		const to = Math.min(from + BLOCK_RANGE_SIZE, tip + 1)
		const result = await l2Client().query(fetchEventsQuery, {
			pk: env.REGISTRY_PK,
			from,
			to
		})
		if (result.error) throw result.error
		for (const block of filterArchiveActionsToRange(result.data?.events ?? [], from, to)) {
			if (!block?.blockInfo) continue
			const finalityStatus = registryFinalityStatus(block.blockInfo.chainStatus)
			if (!finalityStatus) continue
			for (const item of block.eventData ?? []) {
				if (!item?.transactionInfo) continue
				events.push({
					fields: (item.data ?? []).filter((value): value is string => value !== null),
					blockHeight: Number(block.blockInfo.height ?? 0),
					timestamp: new Date(Number(block.blockInfo.timestamp ?? 0)),
					txnHash: item.transactionInfo.hash,
					finalityStatus
				})
			}
		}
	}
	return events
}

export async function replaceRegistryFromEvents(
	db: PostgresJsDatabase,
	events: RegistryArchiveEvent[]
): Promise<{ count: number; root: string | null }> {
	const snapshots = events.map((_, index) => buildRegistrySnapshot(events.slice(0, index + 1)))
	await db.transaction(async (tx) => {
		await tx.delete(ethereumAssetRegistryMemberships)
		await tx.delete(ethereumAssetRecords)
		await tx.delete(ethereumAssetRegistryCheckpoints)
		if (snapshots.length === 0) return

		await batchInsert({
			db: tx,
			table: ethereumAssetRegistryCheckpoints,
			values: snapshots.map((snapshot, index) => ({
				root: snapshot.root,
				count: snapshot.count,
				schemaVersion: snapshot.schemaVersion,
				depth: snapshot.depth,
				blockHeight: events[index].blockHeight,
				timestamp: events[index].timestamp,
				txnHash: events[index].txnHash,
				finalityStatus: snapshots[index].finalityStatus
			}))
		})
		await batchInsert({
			db: tx,
			table: ethereumAssetRecords,
			values:
				snapshots.at(-1)?.records.map(({ record }, index) => ({
					...record,
					registeredRoot: snapshots[index].root
				})) ?? []
		})
		await batchInsert({
			db: tx,
			table: ethereumAssetRegistryMemberships,
			values: snapshots.flatMap((snapshot) =>
				snapshot.records.map(({ record, path }) => ({
					root: snapshot.root,
					registryIndex: record.registryIndex,
					path
				}))
			),
			chunkSize: 1_000
		})
	})
	const latest = snapshots.at(-1)
	return { count: latest?.count ?? 0, root: latest?.root ?? null }
}

export async function handler(db: PostgresJsDatabase) {
	const events = await fetchRegistryEvents()
	const result = await replaceRegistryFromEvents(db, events)
	logger.info(`[registry.handler] indexed count=${result.count}, root=${result.root ?? "<empty>"}`)
	return { lastFetchedBlock: events.at(-1)?.blockHeight ?? null }
}

export const rebuild = handler
