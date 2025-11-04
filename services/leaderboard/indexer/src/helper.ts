import { createMinaClient } from "@lumina-dex/sdk"
import { networkStateQuery } from "@zeko/graphql/mina-archive"
import { FetchZekoArchiveEvents } from "@zeko/graphql/zeko-archive"
import { createConsola } from "consola"
import type { ResultOf } from "gql.tada"
import { Field, PublicKey } from "o1js"
import { env } from "./env"

export interface ActionConfig {
	startBlock: number
	endBlock: number
}

export interface ActionsConfig {
	deposit: ActionConfig
	faucet: ActionConfig
	liquidity: ActionConfig
	swap: ActionConfig
	withdrawal: ActionConfig
}
/**
 * Archive Events Fetching Logic
 *
 * FUTURE REFACTORING PLAN:
 * When the networkState query becomes available in the archive API, refactor as follows:
 *
 * 1. Replace getMaxBlockHeight() with a direct networkState query:
 *    - Query: networkState { maxBlockHeight { canonicalMaxBlockHeight } }
 *    - Remove dependency on querying events to determine chain height
 *    - This will be faster and more reliable
 *
 * 2. Simplify fetchArchiveEvents():
 *    - Call networkState query once at the start
 *    - Remove discovery query logic
 *    - Directly use canonicalMaxBlockHeight for recursion bounds
 *
 * 3. Benefits:
 *    - Single query to get chain state instead of querying events
 *    - More efficient especially for initial fetches
 *    - Clearer separation of concerns (chain state vs event fetching)
 */

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
const l1Client = createMinaClient("https://api.minascan.io/archive/devnet/v1/graphql")

async function fetchEventsRaw({
	address,
	from,
	to,
	layer
}: { address: string; from?: number; to?: number; layer: Layer }) {
	const input = {
		address,
		status: "CANONICAL" as const,
		...(from !== undefined && { from }),
		...(to !== undefined && { to })
	}

	const { data, error } = await (layer === "L1" ? l1Client : l2Client).query(
		FetchZekoArchiveEvents,
		{ input }
	)

	if (error) {
		logger.error("GraphQL error:", error)
		throw error
	}
	if (!data?.events) throw new Error("No events data returned from archive")

	return data.events
}

/**
 * Get the current maximum block height of the chain.
 *
 * TODO: Replace entirely with networkState query when available on L2.
 */
async function getMaxBlockHeight(layer: Layer): Promise<number> {
	if (layer === "L2") {
		//TODO: We're using a query that should always return data.
		const query = await fetchEventsRaw({
			address: addresses.L2.FAUCET_ZEKO_TMINA,
			from: 1,
			to: 10,
			layer
		})

		if (query.length === 0) throw new Error("No events found to determine max block height")

		const firstEvent = query[0]
		if (!firstEvent?.blockInfo) throw new Error("Query returned events without blockInfo")

		const { height, distanceFromMaxBlockHeight } = firstEvent.blockInfo
		return height + distanceFromMaxBlockHeight
	}
	const state = await l1Client.query(networkStateQuery, {})
	if (state.error) throw new Error(`Network state query error: ${state.error.message}`)
	if (!state.data?.networkState?.maxBlockHeight?.canonicalMaxBlockHeight)
		throw new Error("No max block height in network state response")
	return state.data.networkState.maxBlockHeight.canonicalMaxBlockHeight
}

interface FetchEventsRecursiveOptions {
	address: string
	currentFrom: number
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
	const {
		address,
		currentFrom,
		accumulated,
		moduleName,
		maxBlockHeight,
		lastEventBlockHeight,
		layer
	} = options

	const currentTo = currentFrom + MAX_BLOCKS_PER_FETCH - 1
	const logPrefix = `[${moduleName}]`

	if (currentFrom >= maxBlockHeight) {
		logger.info(`${logPrefix} Reached max block height ${maxBlockHeight}`)
		return {
			events: accumulated,
			lastFetchedBlock: lastEventBlockHeight ?? currentFrom - 1
		}
	}

	logger.info(`${logPrefix} Fetching blocks ${currentFrom}-${currentTo}`)

	const events = await fetchEventsRaw({ address, from: currentFrom, to: currentTo, layer })
	const allEvents = accumulated.concat(events)

	logger.info(
		`${logPrefix} Fetched ${events.length} events in blocks ${currentFrom}-${currentTo} (${allEvents.length} total)`
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

			logger.info(
				`${logPrefix} Last event at block ${height}, distance from head: ${distanceFromMaxBlockHeight}`
			)
		}

		return fetchEventsRecursive({
			address,
			currentFrom: currentTo + 1,
			accumulated: allEvents,
			moduleName,
			maxBlockHeight,
			lastEventBlockHeight: currentLastEventBlockHeight,
			layer
		})
	}

	logger.info(`${logPrefix} Empty range ${currentFrom}-${currentTo}`)

	return fetchEventsRecursive({
		address,
		currentFrom: currentTo + 1,
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
		return { events: [], lastFetchedBlock: endBlock }
	}

	const isInitialFetch = initialStartBlock === 1
	const safeFetchFrom = isInitialFetch ? 1 : Math.max(1, initialStartBlock - blockPad)

	logger.start(
		`${logPrefix} FetchArchiveEvents from ${safeFetchFrom} (initial: ${initialStartBlock})${hasEndBlockLimit ? ` to ${endBlock}` : ""}`
	)

	const maxBlockHeight = await getMaxBlockHeight(layer)

	const effectiveMaxBlock = hasEndBlockLimit ? Math.min(endBlock, maxBlockHeight) : maxBlockHeight
	const fetchToBlock = effectiveMaxBlock + blockPad

	logger.info(
		isInitialFetch
			? `${logPrefix} Initial fetch - chain max height: ${maxBlockHeight}${hasEndBlockLimit ? `, end block limit: ${endBlock}` : ""}`
			: `${logPrefix} Continuing from block ${safeFetchFrom} (refetch window: ${blockPad}) - chain max height: ${maxBlockHeight}${hasEndBlockLimit ? `, end block limit: ${endBlock}` : ""}`
	)

	const result = await fetchEventsRecursive({
		address,
		currentFrom: safeFetchFrom,
		accumulated: [],
		moduleName,
		maxBlockHeight: fetchToBlock,
		lastEventBlockHeight: null,
		layer
	})

	// Filter out events before the actual start block (from the blockPad window)
	const filteredEvents = result.events.filter((event) => {
		const blockHeight = event?.blockInfo?.height
		return blockHeight === undefined || blockHeight >= initialStartBlock
	})

	const lastFetchedBlock = Math.min(result.lastFetchedBlock, effectiveMaxBlock)

	logger.success(
		`${logPrefix} Completed: ${filteredEvents.length} events (${result.events.length} fetched, ${result.events.length - filteredEvents.length} filtered), last block ${lastFetchedBlock}`
	)

	return { events: filteredEvents, lastFetchedBlock }
}

export async function wait(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

/**
 * Trigger distributor broadcast to all 100 shards
 * This will contact the API service which will broadcast to all DOs
 * Mock implementation for now
 */
export function broadcast() {
	try {
		logger.info(
			`[broadcast] Triggering broadcast to all 100 distributor shards via ${env.BROADCAST_URL}`
		)
		logger.info("[broadcast] Each distributor will contact its subscribed users")

		fetch(`${env.BROADCAST_URL}/broadcast`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.AUTH_TOKEN}`
			}
		})
		return { success: true }
	} catch (error) {
		logger.error("Error triggering distributor broadcast:", error)
		return { success: false, error: (error as Error).message }
	}
}
