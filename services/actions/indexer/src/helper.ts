import type { innerActions, outerActions } from "@zeko/actions-api"
import { createGraphqlClient, fromList, pushHash } from "@zeko/bridge-sdk"
import { fetchActionsQuery, networkStateQuery } from "@zeko/graphql/mina-archive"
import { createConsola } from "consola"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Field } from "o1js"
import * as v from "valibot"
import { env } from "./env"
import type { InnerItem } from "./modules/inner"
import type { OuterItem } from "./modules/outer"

export const logger = createConsola({
	level: env.ENVIRONMENT?.toLowerCase() === "local" ? 4 : 3
}).withTag("ACTIONS_INDEXER")

export const l1Client = createGraphqlClient(env.L1_ARCHIVE_URL, "l1-archive")
export const l2Client = createGraphqlClient(env.L2_ARCHIVE_URL, "l2-archive")

export interface ArchiveActionData {
	data: string[]
	transactionInfo: { hash: string }
}

export interface ArchiveAction {
	blockInfo: { timestamp: string; height: number; distanceFromMaxBlockHeight: number }
	actionState: { actionStateOne: string; actionStateTwo: string }
	actionData: ArchiveActionData[]
}

export interface ArchiveEvent {
	action: Field[]
	beforeActionState: Field
	afterActionState: Field
	timestamp: string
	hash: string
	blockInfo: { timestamp: string; height: number; distanceFromMaxBlockHeight: number }
}

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
		logger.debug(`[fetchActions ${client.label}] querying archive for range ${from}-${to}`)
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
			logger.debug(
				`[fetchActions ${client.label}] range ${from}-${to} firstHash=${firstHash} lastHash=${lastHash}`
			)
		}
		if (rawActions.length === 0) {
			logger.debug(
				`[fetchActions ${client.label}] range ${from}-${to} returned 0 actions; continuing to next range`
			)
		}
		const dataWithDefault: ArchiveAction[] = rawActions.map((a) => ({
			blockInfo: {
				timestamp: String(a.blockInfo?.timestamp ?? "0"),
				height: Number(a.blockInfo?.height ?? 0),
				distanceFromMaxBlockHeight: Number(a.blockInfo?.distanceFromMaxBlockHeight ?? 0)
			},
			actionState: {
				actionStateOne: a.actionState?.actionStateOne ?? "",
				actionStateTwo: a.actionState?.actionStateTwo ?? ""
			},
			actionData: (a.actionData ?? [])
				.filter((ad) => ad != null)
				.map((ad) => ({
					data: ad.data.filter((d) => d != null),
					transactionInfo: ad.transactionInfo ?? { hash: "hash" }
				}))
		}))
		const schema = v.array(
			v.object({
				blockInfo: v.object({
					timestamp: v.string(),
					height: v.number(),
					distanceFromMaxBlockHeight: v.number()
				}),
				actionState: v.object({ actionStateOne: v.string(), actionStateTwo: v.string() }),
				actionData: v.array(
					v.object({
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

	const output = blocks
	logger.info(
		`[fetchActions ${client.label}] total blocks collected: ${output.length}, start=${start}, tip=${maxHeight}`
	)
	logger.info(
		`[fetchActions ${client.label}] total action blocks fetched: ${output.length}. fromBlock requested: ${fromBlock ?? "latest"}`
	)
	if (output.length === 0)
		logger.warn(`[fetchActions ${client.label}] No actions found for fromBlock=${fromBlock}`)
	logger.info(`[fetchActions ${client.label}] hashing started`)
	const startHashing = Date.now()
	const result = output.flatMap(
		({
			actionState: { actionStateTwo: actionStateBefore, actionStateOne: actionStateAfter },
			actionData,
			blockInfo: { timestamp, height, distanceFromMaxBlockHeight }
		}) => {
			const actions = actionData.map(({ data, transactionInfo: { hash } }) => ({
				data: data.map(Field.from),
				hash
			}))
			let actionState = Field.from(actionStateBefore)

			const correctActions = []
			for (const action of actions) {
				const afterActionState = pushHash(actionState, fromList([action.data]).hash)
				correctActions.push({
					action: action.data,
					beforeActionState: actionState,
					afterActionState,
					timestamp,
					hash: action.hash,
					blockInfo: { timestamp, height, distanceFromMaxBlockHeight }
				})
				actionState = afterActionState
			}

			if (!correctActions.at(-1)?.afterActionState.equals(actionStateAfter).toBoolean()) {
				throw new Error(
					`[fetchActions ${client.label}] invalid actions sequence: last action afterActionState=${correctActions.at(-1)?.afterActionState.toString()} !== actionStateAfter=${actionStateAfter.toString()}`
				)
			}

			return correctActions
		}
	)

	logger.info(`[fetchActions ${client.label}] hashing took ${Date.now() - startHashing}ms`)
	logger.info(`[fetchActions ${client.label}] fetched actions length: ${result.length}`)

	for (let i = 0; i < result.length; i++) {
		const prev = i >= 0 ? result[i - 1] : undefined
		const curr = result[i]
		if (prev && !prev.afterActionState.equals(curr.beforeActionState).toBoolean()) {
			throw new Error(
				`[fetchActions ${client.label}] invalid actions sequence: index=${i} prev.afterActionState=${prev?.afterActionState.toString()} !== curr.beforeActionState=${curr.beforeActionState.toString()}`
			)
		}
	}

	return result
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
