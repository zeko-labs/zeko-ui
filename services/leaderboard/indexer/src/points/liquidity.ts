import { type ArchiveEvents, addresses, fetchArchiveEvents, getPubK, logger } from "../helper"

const processAddLiquidityEvent = async (events: ArchiveEvents) => {
	const parse = (data: string[], timestamp: string, transactionHash: string) => {
		const pubk = getPubK(data)
		return {
			sender: pubk(1, 2),
			amountIn: data[3],
			amountOut: data[4],
			timestamp,
			transactionHash
		}
	}
	const addLiquidityData = events
		//TODO: Verify event is #0
		.filter((e) => e?.eventData?.[0]?.data[0] === "0")
		.map((e) =>
			parse(
				e?.eventData?.[0]?.data.filter(Boolean) ?? [],
				e?.blockInfo?.timestamp ?? Date.now().toString(),
				e?.eventData?.[0]?.transactionInfo?.hash ?? `liquidity_error_${Date.now()}`
			)
		)

	return addLiquidityData
}

export const score = {
	key: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO",
	points: 5,
	maxOccurences: 2,
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
		const data = await processAddLiquidityEvent(events)
		logger.success(`[${score.key}] Processed ${data.length} liquidity events`)

		return { data, lastFetchedBlock }
	}
}
