import { createMinaClient, urls } from "@lumina-dex/sdk"
import { FetchZekoArchiveEvents } from "@zeko/graphql/zeko-archive"
import { createConsola } from "consola"
import { Field, PublicKey } from "o1js"

//TODO: Replace with pool address
export const TZEKO_MINA = "B62qjGGHziBe9brhAC4zkvQa2dyN7nisKnAhKC7rasGFtW31GiuTZoY"
export const BridgeAddress = "bridgeAddress"

const MAX_BLOCKS_PER_FETCH = 10000

export const logger = createConsola().withTag("LEADERBOARD_INDEXER")

export const getPubK = (data: string[]) => (a: number, b: number) => {
	return PublicKey.fromFields([Field.from(data[a]), Field.from(data[b])])
}

async function fetchEventsRaw(address: string, from: number, to: number) {
	const client = createMinaClient(urls["zeko:testnet"])
	const { data } = await client.query(FetchZekoArchiveEvents, {
		input: { address, status: "CANONICAL", from, to }
	})
	logger.info(`Raw fetchEventsRaw returned ${data?.events?.length || 0} events`)
	if (!data) throw new Error("No data found")
	if (!data.events) throw new Error("No events found")
	return data.events
}

export type ArchiveEvents = Awaited<ReturnType<typeof fetchEventsRaw>>

export interface FetchEventsOptions {
	address: string
	fromBlock: number
	toBlock?: number
}

interface FetchEventsRecursiveOptions {
	address: string
	currentFrom: number
	toBlock: number | undefined
	accumulated: ArchiveEvents
}

async function fetchEventsRecursive(options: FetchEventsRecursiveOptions): Promise<ArchiveEvents> {
	const { address, currentFrom, toBlock, accumulated } = options

	const currentTo = toBlock
		? Math.min(currentFrom + MAX_BLOCKS_PER_FETCH - 1, toBlock)
		: currentFrom + MAX_BLOCKS_PER_FETCH - 1

	logger.info(`Fetching events from block ${currentFrom} to ${currentTo}`)

	const events = await fetchEventsRaw(address, currentFrom, currentTo)

	logger.info(`Fetched ${events.length} events from block ${currentFrom} to ${currentTo}`)

	const allEvents = accumulated.concat(events)

	if (toBlock && currentTo >= toBlock) return allEvents

	if (events.length < MAX_BLOCKS_PER_FETCH) return allEvents

	return fetchEventsRecursive({
		address,
		currentFrom: currentTo + 1,
		toBlock,
		accumulated: allEvents
	})
}

export const fetchArchiveEvents = async (options: FetchEventsOptions): Promise<ArchiveEvents> => {
	const { address, fromBlock, toBlock } = options
	return fetchEventsRecursive({
		address,
		currentFrom: fromBlock,
		toBlock,
		accumulated: []
	})
}

export async function wait(seconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

/**
 * Trigger distributor broadcast to all 100 shards
 * This will contact the API service which will broadcast to all DOs
 * Mock implementation for now
 */
export async function triggerDistributorBroadcast() {
	const API_URL = process.env.API_URL || "http://localhost:8787"

	try {
		// Mock: In production, this would POST to /api/broadcast or similar
		logger.info(`[Mock] Triggering broadcast to all 100 distributor shards via ${API_URL}`)
		logger.info("[Mock] Each distributor will contact its subscribed users")

		// TODO: Implement actual HTTP request to API service
		// const response = await fetch(`${API_URL}/api/broadcast`, {
		//   method: 'POST',
		//   headers: { 'Content-Type': 'application/json' },
		//   body: JSON.stringify({
		//     type: 'LEADERBOARD_UPDATE',
		//     timestamp: Date.now()
		//   })
		// })
		return { success: true }
	} catch (error) {
		logger.error("Error triggering distributor broadcast:", error)
		return { success: false, error: (error as Error).message }
	}
}
