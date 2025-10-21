import { type ArchiveEvents, TZEKO_MINA, fetchArchiveEvents, getPubK, logger } from "../helper"

const processAddLiquidityEvent = async (events: ArchiveEvents) => {
	const parseAddLiquidityEvents = (data: string[]) => {
		const pubk = getPubK(data)
		return {
			sender: pubk(1, 2),
			amountIn: data[3],
			amountOut: data[4]
		}
	}
	const addLiquidityData = events
		//TODO: Verify event is #0
		.filter((e) => e?.eventData?.[0]?.data[0] === "0")
		.map((e) => parseAddLiquidityEvents(e?.eventData?.[0]?.data.filter(Boolean) ?? []))

	return addLiquidityData
}

export const score = {
	key: "LUMINA_ADD_LIQUIDITY_MINA_TZEKO",
	points: 5,
	maxOccurences: 2,
	strategy: "daily"
} as const

export const handler = {
	fetch: async (fromBlock: number, toBlock?: number) => {
		const events = await fetchArchiveEvents({ address: TZEKO_MINA, fromBlock, toBlock })
		logger.success(
			`Fetched ${events.length} ${score.key} events from blocks ${fromBlock} to ${toBlock}`
		)
		const liquidityData = await processAddLiquidityEvent(events)
		logger.success(`Processed ${liquidityData.length} ${score.key} liquidity events`)
		return liquidityData
	}
}
