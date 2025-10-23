import { type ArchiveEvents, addresses, fetchArchiveEvents, getPubK, logger } from "../helper"

const processSwapEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[], timestamp: string, transactionHash: string) => {
		const pubk = getPubK(data)
		return {
			sender: pubk(1, 2),
			amountToken0In: data[3],
			amountToken1In: data[4],
			amountLiquidityOut: data[5],
			timestamp,
			transactionHash
		}
	}
	const swapData = events
		//TODO: Verify event is #4
		.filter((e) => e?.eventData?.[0]?.data[0] === "4")
		.map((e) =>
			parse(
				e?.eventData?.[0]?.data.filter(Boolean) ?? [],
				e?.blockInfo?.timestamp ?? Date.now().toString(),
				e?.eventData?.[0]?.transactionInfo?.hash ?? `swap_error_${Date.now()}`
			)
		)

	return swapData
}

export const score = {
	key: "LUMINA_SWAP_MINA_TZEKO",
	points: 1,
	maxOccurences: 10,
	strategy: "daily"
} as const

export const handler = {
	fetch: async (fromBlock: number) => {
		logger.info(`[${score.key}] Starting fetch from block ${fromBlock}`)

		const { events, lastFetchedBlock } = await fetchArchiveEvents({
			address: addresses.LUMINA_POOL_TZEKO_MINA,
			fromBlock,
			moduleName: score.key
		})

		logger.info(`[${score.key}] Processing ${events.length} raw events`)
		const data = await processSwapEvents(events)
		logger.success(`[${score.key}] Processed ${data.length} swap events`)

		return { data, lastFetchedBlock }
	}
}
