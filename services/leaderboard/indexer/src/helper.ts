import { type BroadcastPayload, type Client, fetchEventsRaw } from "@leaderboard/api"
import { createMinaClient } from "@lumina-dex/sdk"
import { networkStateQuery } from "@zeko-labs/graphql/mina-archive"
import type { FetchZekoArchiveEvents } from "@zeko-labs/graphql/zeko-archive"
import { createConsola } from "consola"
import type { ResultOf } from "gql.tada"
import { Field, PublicKey } from "o1js"
import { env } from "./env"

export interface ActionConfig {
	startBlock: number
	endBlock: number | null
}

export interface ActionsConfig {
	deposit: ActionConfig
	faucet: ActionConfig
	liquidity: ActionConfig
	swap: ActionConfig
	withdrawal: ActionConfig
}

export const addresses = {
	L1: {
		BRIDGE_ZEKO_TO_MINA: "B62qmqHbTA6X54y5M2nSxpuPae5EUE2TBQXacAEqqgn667NRVFKDSeA"
	},
	L2: {
		BRIDGE_MINA_TO_ZEKO: "B62qpXxjsnR6XfV8KUGobiiYqiSjvHq59KKhXgvSXL61pSffKc8ggcb",
		FAUCET_ZEKO_TMINA: "B62qnMgvs8iS6wVe56ajqcqtagAov2TGtvD3cWfEB7rAwfCU6x7HdgB",
		LUMINA_POOL_TZEKO_MINA: "B62qrSyBR5jLgekkwjDdpt6UX8FfYntYB1uXydFyViWMFLkrGSceFEV"
	}
} as const

const MAX_BLOCKS_PER_FETCH = 10000

export const logger = createConsola().withTag("LEADERBOARD_INDEXER")

export const getPubK = (data: string[]) => (a: number, b: number) => {
	return PublicKey.fromFields([Field.from(data[a]), Field.from(data[b])]).toBase58()
}

export type ArchiveEvents = NonNullable<ResultOf<typeof FetchZekoArchiveEvents>["events"]>

type Layer = "L1" | "L2"

const l2Client = createMinaClient("https://archive.testnet.zeko.io/graphql")
const l1Client = createMinaClient("https://gateway.mina.archive.devnet.zeko.io")

/**
 * Get the current maximum block height of the chain.
 *
 */
export async function getMaxBlockHeight(layer: Layer): Promise<number> {
	const client = layer === "L1" ? l1Client : l2Client
	const state = await client.query(networkStateQuery, {})
	if (state.error) throw new Error(`Network state query error: ${state.error.message}`)
	if (!state.data?.networkState?.maxBlockHeight?.canonicalMaxBlockHeight)
		throw new Error("No max block height in network state response")
	return state.data.networkState.maxBlockHeight.canonicalMaxBlockHeight
}

interface FetchEventsRecursiveOptions {
	address: string
	from: number
	accumulated: ArchiveEvents
	moduleName: string
	maxBlockHeight: number
	lastEventBlockHeight: number | null
	layer: Layer
}

interface FetchResult {
	events: ArchiveEvents
	lastFetchedBlock: number
}

async function fetchEventsRecursive(options: FetchEventsRecursiveOptions): Promise<FetchResult> {
	const { address, from, accumulated, moduleName, maxBlockHeight, lastEventBlockHeight, layer } =
		options

	const to = from + MAX_BLOCKS_PER_FETCH
	const logPrefix = `[${moduleName}]`

	if (from >= maxBlockHeight) {
		logger.info(`${logPrefix} Reached max block height ${maxBlockHeight}`)
		return {
			events: accumulated,
			lastFetchedBlock: Math.min(from - 1, maxBlockHeight)
		}
	}

	const client = (layer === "L2" ? l2Client : l1Client) as Client
	//TODO: canonical blocks are not working with L1
	const canonical = layer === "L2"
	const events = await fetchEventsRaw({ address, from, to, client, canonical })
	const allEvents = accumulated.concat(events)

	logger.info(
		`${logPrefix} Fetched ${events.length} events in blocks ${from}-${to} (${allEvents.length} total)`
	)

	let currentLastEventBlockHeight = lastEventBlockHeight

	if (events.length > 0) {
		const lastEvent = events[events.length - 1]

		if (lastEvent?.blockInfo) {
			const { height, distanceFromMaxBlockHeight } = lastEvent.blockInfo
			currentLastEventBlockHeight = Math.max(currentLastEventBlockHeight ?? 0, height)

			if (distanceFromMaxBlockHeight === 0) {
				logger.info(`${logPrefix} Reached chain head at block ${height}`)
				return { events: allEvents, lastFetchedBlock: height }
			}
		}
	}

	return fetchEventsRecursive({
		address,
		from: to,
		accumulated: allEvents,
		moduleName,
		maxBlockHeight,
		lastEventBlockHeight: currentLastEventBlockHeight,
		layer
	})
}

export interface FetchEventsOptions {
	address: string
	startBlock: number
	endBlock: number
	moduleName: string
	layer: Layer
}

export const fetchArchiveEvents = async (options: FetchEventsOptions): Promise<FetchResult> => {
	const blockPad = 100 // To account for chain reorganizations
	const { address, startBlock, moduleName, layer, endBlock } = options
	const initialStartBlock = startBlock === 0 ? 1 : startBlock
	const logPrefix = `[${moduleName}]`

	const hasEndBlockLimit = endBlock !== Number.POSITIVE_INFINITY

	// If we're outside the specified range, return empty results
	if (hasEndBlockLimit && initialStartBlock > endBlock) {
		logger.info(
			`${logPrefix} Starting block ${initialStartBlock} exceeds end block ${endBlock}, skipping fetch`
		)
		return { events: [], lastFetchedBlock: startBlock }
	}

	const maxBlockHeight = await getMaxBlockHeight(layer)

	//If startBlock is past maxBlockHeight, return empty results (ie startBlock=100, maxBlockHeight=90)
	if (initialStartBlock > maxBlockHeight) {
		logger.info(
			`${logPrefix} Starting block ${initialStartBlock} exceeds chain max height ${maxBlockHeight}, skipping fetch`
		)
		return { events: [], lastFetchedBlock: startBlock }
	}

	// If initialStartBlock limit is less than endBlock, return empty results (ie startBlock = 500, endBlock=400)
	if (hasEndBlockLimit && initialStartBlock > endBlock) {
		logger.info(
			`${logPrefix} End block limit ${endBlock} is less than chain max height ${maxBlockHeight}`
		)
		return { events: [], lastFetchedBlock: startBlock }
	}

	const isInitialFetch = initialStartBlock === 1
	const from = isInitialFetch ? 1 : Math.max(1, initialStartBlock - blockPad)
	const effectiveMaxBlock = hasEndBlockLimit ? Math.min(endBlock, maxBlockHeight) : maxBlockHeight
	const fetchToBlock = effectiveMaxBlock + blockPad

	logger.start(
		`${logPrefix} FetchArchiveEvents : ${{ initialStartBlock, from, endBlock, maxBlockHeight, hasEndBlockLimit, effectiveMaxBlock, fetchToBlock, blockPad }}`
	)

	const result = await fetchEventsRecursive({
		address,
		from,
		accumulated: [],
		moduleName,
		maxBlockHeight: fetchToBlock,
		lastEventBlockHeight: null,
		layer
	})
	const { events } = result

	const lastFetchedBlock = Math.min(result.lastFetchedBlock, effectiveMaxBlock)

	logger.success(`${logPrefix} Completed: ${events.length} events, last block ${lastFetchedBlock}`)

	return { events, lastFetchedBlock }
}

export async function wait(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

/**
 * Trigger distributor broadcast to all 100 shards
 * This will contact the API service which will broadcast to all DOs
 */
export function broadcast(payload: BroadcastPayload) {
	try {
		logger.info(
			`[broadcast] Triggering broadcast to all 100 distributor shards via ${env.BROADCAST_URL}`
		)
		logger.info(
			`[broadcast] Payload: maxBlockHeight=${payload.maxBlockHeight}, hasNewEntries=${payload.hasNewEntries}`
		)

		fetch(`${env.BROADCAST_URL}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.AUTH_TOKEN}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(payload)
		}).then((response) => {
			if (!response.ok) {
				logger.error(`[broadcast] Broadcast request failed with status ${response.status}`)
			} else {
				logger.info(`[broadcast] Broadcast request succeeded with status ${response.status}`)
			}
		})
		return { success: true }
	} catch (error) {
		logger.error("Error triggering distributor broadcast:", error)
		return { success: false, error: (error as Error).message }
	}
}
