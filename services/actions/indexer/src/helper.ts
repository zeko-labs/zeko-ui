import { createMinaClient } from "@lumina-dex/sdk"
import { fromList, pushHash } from "@zeko/bridge-sdk"
import { fetchActionsQuery, networkStateQuery } from "@zeko/graphql/mina-archive"
import { createConsola } from "consola"
import { Field } from "o1js"
import * as v from "valibot"
import { env } from "./env"

export const logger = createConsola().withTag("ACTIONS_INDEXER")

export const OUTER_PK = "B62qmqHbTA6X54y5M2nSxpuPae5EUE2TBQXacAEqqgn667NRVFKDSeA"
export const l1Client = createMinaClient(env.L1_ARCHIVE_URL)

export interface ArchiveActionData {
	data: (string | null)[]
	transactionInfo: { status: string; hash: string }
}

export interface ArchiveAction {
	blockInfo: { timestamp: string; height: number }
	actionState: { actionStateOne: string; actionStateTwo: string }
	actionData: ArchiveActionData[]
}

export interface ArchiveEvent {
	action: Field[]
	beforeActionState: Field | null
	afterActionState: Field
	timestamp: string
	hash: string
	status: string
	blockInfo: { timestamp: string; height: number }
}

const BLOCK_RANGE_SIZE = 10_000

export async function fetchActions({
	client,
	fromBlock
}: {
	client: ReturnType<typeof createMinaClient>
	fromBlock?: number
}): Promise<ArchiveEvent[]> {
	const fetchActionsRecursive = async (
		fromBlock?: number,
		emptyResults: number = 0
	): Promise<ArchiveAction[]> => {
		if (fromBlock !== undefined && fromBlock < 0) return []
		if (emptyResults > 10) return []

		const res = await client.query(fetchActionsQuery, {
			pk: OUTER_PK,
			from: fromBlock ?? null,
			to: null
		})
		const { data, error } = res
		if (error) throw error
		function notNull<T>(v: T | null | undefined): v is T {
			return v != null
		}
		const rawActions = (data?.actions ?? []).filter(notNull)
		const dataWithDefault: ArchiveAction[] = rawActions.map((a) => ({
			blockInfo: {
				timestamp: String(a.blockInfo?.timestamp ?? "0"),
				height: Number(a.blockInfo?.height ?? 0)
			},
			actionState: {
				actionStateOne: a.actionState?.actionStateOne ?? "",
				actionStateTwo: a.actionState?.actionStateTwo ?? ""
			},
			actionData: (a.actionData ?? []).filter(notNull).map((ad) => ({
				data: ad.data ?? [],
				transactionInfo: ad.transactionInfo ?? { status: "status", hash: "hash" }
			}))
		}))

		const schema = v.array(
			v.object({
				blockInfo: v.object({ timestamp: v.string(), height: v.number() }),
				actionState: v.object({ actionStateOne: v.string(), actionStateTwo: v.string() }),
				actionData: v.array(
					v.object({
						data: v.array(v.string()),
						transactionInfo: v.object({ status: v.string(), hash: v.string() })
					})
				)
			})
		)
		const result = v.safeParse(schema, dataWithDefault)
		if (!result.success) {
			logger.error("Invalid actions data:", result.issues)
			throw new Error("Invalid actions data")
		}

		if (result.output.length === 0) {
			if (fromBlock === undefined) return []
			return await fetchActionsRecursive((fromBlock ?? 0) - BLOCK_RANGE_SIZE, emptyResults + 1)
		}

		const prev = await fetchActionsRecursive(result.output[0].blockInfo.height - BLOCK_RANGE_SIZE)
		return [...prev, ...result.output]
	}

	const output = await fetchActionsRecursive(fromBlock ?? undefined)
	return output.flatMap(
		({ actionState: { actionStateTwo: actionStateBefore }, actionData, blockInfo }) => {
			const actions = actionData.map(({ data, transactionInfo: { hash, status } }) => ({
				data: data.filter((d) => d !== null).map((d) => Field.from(d)),
				hash,
				status
			}))
			let actionState = Field.from(actionStateBefore)
			const correctActions: {
				action: Field[]
				beforeActionState: Field
				afterActionState: Field
				timestamp: string
				hash: string
				status: string
				blockInfo: { timestamp: string; height: number }
			}[] = []
			for (const action of actions) {
				const afterActionState = pushHash(actionState, fromList([action.data]).hash)
				correctActions.push({
					action: action.data,
					beforeActionState: actionState,
					afterActionState,
					timestamp: blockInfo.timestamp,
					hash: action.hash,
					status: action.status,
					blockInfo
				})
				actionState = afterActionState
			}
			return correctActions
		}
	)
}

export async function getNetworkTip(client: ReturnType<typeof createMinaClient>): Promise<number> {
	const res = await client.query(networkStateQuery, {})
	if (res.error) throw res.error
	const height = res.data?.networkState?.maxBlockHeight?.canonicalMaxBlockHeight ?? 0
	return height
}

export async function wait(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}
