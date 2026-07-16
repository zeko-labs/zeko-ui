import type { innerActions, outerActions } from "@zeko/actions-api"
import { createGraphqlClient } from "@zeko-labs/bridge-sdk"
import { fetchActionsQuery, networkStateQuery } from "@zeko-labs/graphql/mina-archive"
import { createConsola } from "consola"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import * as v from "valibot"
import { selectCanonicalBlocks } from "./action-processing/core"
import { runActionProcessing } from "./action-processing/runtime"
import type { ArchiveAction, ArchiveEvent } from "./action-processing/types"
import { env } from "./env"
import type { InnerItem } from "./modules/inner"
import type { OuterItem } from "./modules/outer"

export type { ArchiveAction, ArchiveEvent } from "./action-processing/types"

export const logger = createConsola({
	level: 3
}).withTag("ACTIONS_INDEXER")

export const l1Client = createGraphqlClient(env.L1_ARCHIVE_URL, "l1-archive")
export const l2Client = createGraphqlClient(env.L2_ARCHIVE_URL, "l2-archive")

const BLOCK_RANGE_SIZE = 10_000

export async function fetchActions({
	client,
	fromBlock,
	pk
}: {
	client: ReturnType<typeof createGraphqlClient>
	fromBlock?: number
	pk: string
}): Promise<ArchiveEvent[]> {
	logger.info(`[fetchActions ${client.label}] starting fetch; fromBlock=${fromBlock ?? "latest"}`)
	logger.info(`[fetchActions ${client.label}] using pk=${pk.slice(0, 12)}...`)
	// Ensure we fetch in batches from 'from' to tip
	const start = fromBlock ?? 1
	const maxHeight = await getNetworkTip(client)
	logger.info(`[fetchActions ${client.label}] network tip: ${maxHeight}, start: ${start}`)
	if (start > maxHeight) {
		logger.info(
			`[fetchActions ${client.label}] start (${start}) > network tip (${maxHeight}), returning empty`
		)
		return []
	}

	const blocks: ArchiveAction[] = []
	let from = start
	while (from <= maxHeight) {
		// "to" is exclusive, so we add 1 to the maxHeight
		const to = Math.min(from + BLOCK_RANGE_SIZE, maxHeight + 1)
		const res = await client().query(fetchActionsQuery, {
			pk,
			from: from,
			to: to
		})
		const { data, error } = res
		if (error) {
			logger.error(`[fetchActions ${client.label}] query error: ${String(error)}`)
			throw error
		}
		const rawActions = (data?.actions ?? []).filter((a) => a != null)
		logger.info(
			`[fetchActions ${client.label}] archive returned ${rawActions.length} raw actions for range ${from}-${to}`
		)
		if (rawActions.length > 0) {
			const heights = rawActions.map((a) => Number(a.blockInfo?.height ?? 0))
			const minH = Math.min(...heights)
			const maxH = Math.max(...heights)
			if (minH < from)
				logger.warn(
					`[fetchActions ${client.label}] archive returned block below requested from: min=${minH} < from=${from}`
				)
			if (maxH > to)
				logger.warn(
					`[fetchActions ${client.label}] archive returned block above requested to: max=${maxH} > to=${to}`
				)
			const firstAction = rawActions[0]
			const lastAction = rawActions[rawActions.length - 1]
			const firstHash = firstAction?.actionData?.[0]?.transactionInfo?.hash ?? "<no-hash>"
			const lastHash =
				lastAction?.actionData?.[lastAction.actionData?.length - 1]?.transactionInfo?.hash ??
				"<no-hash>"
			logger.info(
				`[fetchActions ${client.label}] range ${from}-${to} firstHash=${firstHash} lastHash=${lastHash}`
			)
		}
		if (rawActions.length === 0) {
			logger.info(
				`[fetchActions ${client.label}] range ${from}-${to} returned 0 actions; continuing to next range`
			)
		}
		const dataWithDefault: ArchiveAction[] = rawActions.map((a) => ({
			blockInfo: {
				timestamp: String(a.blockInfo?.timestamp ?? "0"),
				height: Number(a.blockInfo?.height ?? 0),
				distanceFromMaxBlockHeight: Number(a.blockInfo?.distanceFromMaxBlockHeight ?? 0),
				chainStatus: a.blockInfo?.chainStatus ?? "canonical"
			},
			actionState: {
				actionStateOne: a.actionState?.actionStateOne ?? "",
				actionStateTwo: a.actionState?.actionStateTwo ?? ""
			},
			actionData: (a.actionData ?? [])
				.filter((ad) => ad != null)
				.map((ad) => ({
					accountUpdateId: ad.accountUpdateId,
					data: ad.data.filter((d) => d != null),
					transactionInfo: ad.transactionInfo ?? { hash: "hash" }
				}))
		}))
		const schema = v.array(
			v.object({
				blockInfo: v.object({
					timestamp: v.string(),
					height: v.number(),
					distanceFromMaxBlockHeight: v.number(),
					chainStatus: v.string()
				}),
				actionState: v.object({ actionStateOne: v.string(), actionStateTwo: v.string() }),
				actionData: v.array(
					v.object({
						accountUpdateId: v.optional(v.string()),
						data: v.array(v.string()),
						transactionInfo: v.object({ hash: v.string() })
					})
				)
			})
		)
		const result = v.safeParse(schema, dataWithDefault)
		if (!result.success) {
			logger.error(`[fetchActions ${client.label}] Invalid actions data: ${result.issues}`)
			throw new Error("Invalid actions data")
		}
		blocks.push(...result.output)
		from = to
	}

	const output = selectCanonicalBlocks(blocks)
	const droppedOrphanedCount = blocks.length - output.length
	if (droppedOrphanedCount > 0)
		logger.warn(
			`[fetchActions ${client.label}] dropped ${droppedOrphanedCount} orphaned block(s) from a non-canonical chain branch`
		)
	logger.info(
		`[fetchActions ${client.label}] total blocks collected: ${output.length}, start=${start}, tip=${maxHeight}`
	)
	logger.info(
		`[fetchActions ${client.label}] total action blocks fetched: ${output.length}. fromBlock requested: ${fromBlock ?? "latest"}`
	)
	if (output.length === 0)
		logger.warn(`[fetchActions ${client.label}] No actions found for fromBlock=${fromBlock}`)
	const actionProcessingResult = await runActionProcessing({
		blocks: output,
		preferWorker: true
	})
	logger.info(
		`[fetchActions ${client.label}] action-processing strategy=${actionProcessingResult.stats.strategy}, total=${Math.round(actionProcessingResult.stats.totalMs)}ms, hashing=${Math.round(actionProcessingResult.stats.hashingMs)}ms, validation=${Math.round(actionProcessingResult.stats.validationMs)}ms, bottleneck=${actionProcessingResult.stats.bottleneck}`
	)
	logger.info(
		`[fetchActions ${client.label}] fetched actions length: ${actionProcessingResult.events.length}`
	)
	return actionProcessingResult.events
}

export async function getNetworkTip(
	client: ReturnType<typeof createGraphqlClient>
): Promise<number> {
	const res = await client().query(networkStateQuery, {})
	if (res.error) throw res.error
	const height = res.data?.networkState?.maxBlockHeight?.pendingMaxBlockHeight ?? 0
	logger.info(`[getNetworkTip ${client.label}] pendingMaxBlockHeight=${height}`)
	return height
}

export async function wait(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

export async function handleFork<
	FetchedAction extends OuterItem | InnerItem,
	DbAction extends typeof outerActions.$inferSelect | typeof innerActions.$inferSelect,
	DataToInsert
>(
	db: PostgresJsDatabase,
	{
		startBlock,
		fetchActions,
		getDbActions,
		build,
		deleteFromIndex,
		insert,
		lastFinalIndex
	}: {
		startBlock: number
		fetchActions: (
			startBlock: number
		) => Promise<{ data: FetchedAction[]; lastFetchedBlock: number }>
		getDbActions: (db: PostgresJsDatabase, startBlock: number) => Promise<DbAction[]>
		lastFinalIndex: number
		build: (items: FetchedAction[], currIndex: number) => DataToInsert
		deleteFromIndex: (db: PostgresJsDatabase, index: number) => Promise<void>
		insert: (db: PostgresJsDatabase, data: DataToInsert) => Promise<void>
	}
) {
	const fetchedActions = await fetchActions(startBlock)
	logger.info(
		`[handleFork] fetched ${fetchedActions.data.length} actions (lastFetchedBlock=${fetchedActions.lastFetchedBlock})`
	)

	const dbActions = await getDbActions(db, startBlock)
	logger.info(
		`[handleFork] dbActions=${dbActions.length}, fetchedActions=${fetchedActions.data.length}, lastFinalIndex=${lastFinalIndex}`
	)

	let currentIndex = lastFinalIndex
	let forkAtIndex = null
	let insertFromIndex = null

	for (let i = 0; i < fetchedActions.data.length; i++) {
		const item = fetchedActions.data[i]
		const dbItem = i > dbActions.length ? undefined : dbActions[i]
		currentIndex++

		if (dbItem && dbItem.afterState !== item.afterState && !forkAtIndex) {
			logger.info(
				`[handleFork] fork at index ${currentIndex}: ${dbItem.afterState} -> ${item.afterState}`
			)
			forkAtIndex = currentIndex
		}

		if (forkAtIndex !== null || !dbItem) {
			insertFromIndex = i
			break
		}
	}

	const newActionsCount = insertFromIndex != null ? fetchedActions.data.length - insertFromIndex : 0
	logger.info(
		`[handleFork] comparison done: insertFromIndex=${insertFromIndex ?? "null"}, forkAtIndex=${forkAtIndex ?? "null"}, newActionsToInsert=${newActionsCount}, currentIndex=${currentIndex}`
	)

	const data = build(fetchedActions.data.slice(insertFromIndex ?? Number.MAX_VALUE), currentIndex)

	if (forkAtIndex !== null) {
		logger.info(`[handleFork] rolling back from fork at index ${forkAtIndex} and re-inserting`)
		await db.transaction(async (tx) => {
			await deleteFromIndex(tx, forkAtIndex)
			await insert(tx, data)
		})
	} else if (newActionsCount > 0) {
		logger.info(`[handleFork] inserting ${newActionsCount} new actions`)
		await db.transaction(async (tx) => {
			await insert(tx, data)
		})
	} else {
		logger.info("[handleFork] no new actions to insert, skipping")
	}

	return fetchedActions
}
