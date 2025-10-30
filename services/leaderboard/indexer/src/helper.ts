import { createMinaClient } from "@lumina-dex/sdk"
import { FetchZekoArchiveEvents } from "@zeko/graphql/zeko-archive"
import { createConsola } from "consola"
import type { ResultOf } from "gql.tada"
import { Field, PublicKey } from "o1js"
import { env } from "./env"

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
	BRIDGE_MINA_TO_ZEKO: "B62qpXxjsnR6XfV8KUGobiiYqiSjvHq59KKhXgvSXL61pSffKc8ggcb",
	FAUCET_ZEKO_TMINA: "B62qnMgvs8iS6wVe56ajqcqtagAov2TGtvD3cWfEB7rAwfCU6x7HdgB",
	LUMINA_POOL_TZEKO_MINA: "B62qrSyBR5jLgekkwjDdpt6UX8FfYntYB1uXydFyViWMFLkrGSceFEV",
	BRIDGE_ZEKO_TO_MINA: "B62qmqHbTA6X54y5M2nSxpuPae5EUE2TBQXacAEqqgn667NRVFKDSeA"
} as const

const MAX_BLOCKS_PER_FETCH = 10000

export const logger = createConsola().withTag("LEADERBOARD_INDEXER")

export const getPubK = (data: string[]) => (a: number, b: number) => {
	return PublicKey.fromFields([Field.from(data[a]), Field.from(data[b])]).toBase58()
}

export type ArchiveEvents = NonNullable<ResultOf<typeof FetchZekoArchiveEvents>["events"]>

async function fetchEventsRaw(address: string, from?: number, to?: number) {
	const client = createMinaClient("https://archive.testnet.zeko.io/graphql")

	const input = {
		address,
		status: "CANONICAL" as const,
		...(from !== undefined && { from }),
		...(to !== undefined && { to })
	}

	const { data, error } = await client.query(FetchZekoArchiveEvents, { input })

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
 * TODO: Replace with networkState query when available.
 * Future implementation should use:
 * ```
 * query NetworkState {
 *   networkState {
 *     maxBlockHeight {
 *       canonicalMaxBlockHeight
 *       pendingMaxBlockHeight
 *     }
 *   }
 * }
 * ```
 * This will be more efficient than querying events to determine chain height.
 */
async function getMaxBlockHeight(address: string, fromBlock: number): Promise<number | null> {
	const query =
		fromBlock === 1
			? await fetchEventsRaw(address)
			: await fetchEventsRaw(address, fromBlock, fromBlock + MAX_BLOCKS_PER_FETCH)

	if (query.length === 0) return null

	const firstEvent = query[0]
	if (!firstEvent?.blockInfo) {
		throw new Error("Query returned events without blockInfo")
	}

	const { height, distanceFromMaxBlockHeight } = firstEvent.blockInfo
	return height + distanceFromMaxBlockHeight
}

interface FetchEventsRecursiveOptions {
	address: string
	currentFrom: number
	accumulated: ArchiveEvents
	moduleName: string
	maxBlockHeight: number
	lastEventBlockHeight: number | null
}

interface FetchResult {
	events: ArchiveEvents
	lastFetchedBlock: number
}

async function fetchEventsRecursive(options: FetchEventsRecursiveOptions): Promise<FetchResult> {
	const { address, currentFrom, accumulated, moduleName, maxBlockHeight, lastEventBlockHeight } =
		options

	const currentTo = currentFrom + MAX_BLOCKS_PER_FETCH - 1
	const logPrefix = `[${moduleName}]`

	if (currentTo >= maxBlockHeight) {
		logger.info(`${logPrefix} Reached max block height ${maxBlockHeight}`)
		return {
			events: accumulated,
			lastFetchedBlock: lastEventBlockHeight ?? currentFrom - 1
		}
	}

	logger.info(`${logPrefix} Fetching blocks ${currentFrom}-${currentTo}`)

	const events = await fetchEventsRaw(address, currentFrom, currentTo)
	const allEvents = accumulated.concat(events)

	logger.info(`${logPrefix} Fetched ${events.length} events (${allEvents.length} total)`)

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
			lastEventBlockHeight: currentLastEventBlockHeight
		})
	}

	logger.info(`${logPrefix} Empty range ${currentFrom}-${currentTo}`)

	return fetchEventsRecursive({
		address,
		currentFrom: currentTo + 1,
		accumulated: allEvents,
		moduleName,
		maxBlockHeight,
		lastEventBlockHeight: currentLastEventBlockHeight
	})
}

export interface FetchEventsOptions {
	address: string
	fromBlock: number
	moduleName: string
}

export const fetchArchiveEvents = async (options: FetchEventsOptions): Promise<FetchResult> => {
	const { address, fromBlock, moduleName } = options
	const safeFromBlock = fromBlock === 0 ? 1 : fromBlock
	const logPrefix = `[${moduleName}]`

	logger.start(`${logPrefix} Starting fetch from block ${safeFromBlock}`)

	const isInitialFetch = safeFromBlock === 1

	const maxBlockHeight = await getMaxBlockHeight(address, safeFromBlock)

	if (maxBlockHeight === null) {
		logger.info(`${logPrefix} No events found, nothing to fetch`)
		return {
			events: [],
			lastFetchedBlock: safeFromBlock - 1
		}
	}

	if (isInitialFetch) {
		logger.info(`${logPrefix} Initial fetch - chain max height: ${maxBlockHeight}`)
	} else {
		logger.info(
			`${logPrefix} Continuing from block ${safeFromBlock} - chain max height: ${maxBlockHeight}`
		)
	}

	const result = await fetchEventsRecursive({
		address,
		currentFrom: safeFromBlock,
		accumulated: [],
		moduleName,
		maxBlockHeight,
		lastEventBlockHeight: null
	})

	logger.success(
		`${logPrefix} Completed: ${result.events.length} events, last block ${result.lastFetchedBlock}`
	)

	return result
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
