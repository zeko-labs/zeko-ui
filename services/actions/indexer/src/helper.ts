import { createMinaClient } from "@lumina-dex/sdk"
import { fromList, pushHash } from "@zeko/bridge-sdk"
import { fetchActionsQuery, networkStateQuery } from "@zeko/graphql/mina-archive"
import { createConsola } from "consola"
import { Field } from "o1js"
import * as v from "valibot"
import { env } from "./env"

export const logger = createConsola({
	level: env.ENVIRONMENT?.toLowerCase() === "local" ? 4 : 3
}).withTag("ACTIONS_INDEXER")

export const OUTER_PK = "B62qkekmS9273D1EsFfMSJMMDAmgvh1WyoYE2vs1r7k4GtGBqVYABn2"
export const l1Client = createMinaClient(env.L1_ARCHIVE_URL)

const firstBlockWithActions = 430_000

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
	fromBlock
}: {
	client: ReturnType<typeof createMinaClient>
	fromBlock?: number
}): Promise<ArchiveEvent[]> {
	logger.info(`[fetchActions] starting fetch; fromBlock=${fromBlock ?? "latest"}`)
	logger.debug(
		`[fetchActions] using OUTER_PK=${OUTER_PK} archiveUrl=${env.L1_ARCHIVE_URL ?? "unset"}`
	)
	// Ensure we fetch in batches from 'from' to tip
	const start = Math.max(fromBlock ?? 0, firstBlockWithActions)
	const maxHeight = await getNetworkTip(client)
	logger.info(`[fetchActions] network tip: ${maxHeight}, start: ${start}`)
	if (start > maxHeight) {
		logger.info(`[fetchActions] start (${start}) > network tip (${maxHeight}), returning empty`)
		return []
	}

	const blocks: ArchiveAction[] = []
	let from = start
	while (from <= maxHeight) {
		// "to" is exclusive, so we add 1 to the maxHeight
		const to = Math.min(from + BLOCK_RANGE_SIZE, maxHeight + 1)
		logger.debug(`[fetchActions] querying archive for range ${from}-${to}`)
		const res = await client.query(fetchActionsQuery, {
			pk: OUTER_PK,
			from: from,
			to: to
		})
		const { data, error } = res
		if (error) {
			logger.error(`[fetchActions] query error: ${String(error)}`)
			throw error
		}
		const rawActions = (data?.actions ?? []).filter((a) => a != null)
		logger.info(
			`[fetchActions] archive returned ${rawActions.length} raw actions for range ${from}-${to}`
		)
		if (rawActions.length > 0) {
			const heights = rawActions.map((a) => Number(a.blockInfo?.height ?? 0))
			const minH = Math.min(...heights)
			const maxH = Math.max(...heights)
			if (minH < from)
				logger.warn(
					`[fetchActions] archive returned block below requested from: min=${minH} < from=${from}`
				)
			if (maxH > to)
				logger.warn(
					`[fetchActions] archive returned block above requested to: max=${maxH} > to=${to}`
				)
			const firstAction = rawActions[0]
			const lastAction = rawActions[rawActions.length - 1]
			const firstHash = firstAction?.actionData?.[0]?.transactionInfo?.hash ?? "<no-hash>"
			const lastHash =
				lastAction?.actionData?.[lastAction.actionData?.length - 1]?.transactionInfo?.hash ??
				"<no-hash>"
			logger.debug(`[fetchActions] range ${from}-${to} firstHash=${firstHash} lastHash=${lastHash}`)
		}
		if (rawActions.length === 0) {
			logger.debug(
				`[fetchActions] range ${from}-${to} returned 0 actions; continuing to next range`
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
			logger.error("Invalid actions data:", result.issues)
			throw new Error("Invalid actions data")
		}
		blocks.push(...result.output)
		from = to
	}

	const output = blocks
	logger.info(
		`[fetchActions] total blocks collected: ${output.length}, start=${start}, tip=${maxHeight}`
	)
	logger.info(
		`[fetchActions] total action blocks fetched: ${output.length}. fromBlock requested: ${fromBlock ?? "latest"}`
	)
	if (output.length === 0) logger.warn(`[fetchActions] No actions found for fromBlock=${fromBlock}`)
	logger.info("[fetchActions] hashing started")
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
					`[fetchActions] invalid actions sequence: last action afterActionState=${correctActions.at(-1)?.afterActionState.toString()} !== actionStateAfter=${actionStateAfter.toString()}`
				)
			}

			return correctActions
		}
	)

	logger.info(`[fetchActions] hashing took ${Date.now() - startHashing}ms`)
	logger.info(`[fetchActions] fetched actions length: ${result.length}`)

	for (let i = 0; i < result.length; i++) {
		const prev = i >= 0 ? result[i - 1] : undefined
		const curr = result[i]
		if (prev && !prev.afterActionState.equals(curr.beforeActionState).toBoolean()) {
			throw new Error(
				`[fetchActions] invalid actions sequence: index=${i} prev.afterActionState=${prev?.afterActionState.toString()} !== curr.beforeActionState=${curr.beforeActionState.toString()}`
			)
		}
	}

	return result
}

export async function getNetworkTip(client: ReturnType<typeof createMinaClient>): Promise<number> {
	const res = await client.query(networkStateQuery, {})
	if (res.error) throw res.error
	const height = res.data?.networkState?.maxBlockHeight?.pendingMaxBlockHeight ?? 0
	logger.info(`[getNetworkTip] pendingMaxBlockHeight=${height}`)
	return height
}

export async function wait(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}
