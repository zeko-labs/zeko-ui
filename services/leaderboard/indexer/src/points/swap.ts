import { TZEKO_MINA, fetchArchiveEvents, getPubK, logger } from "../helper"

const processSwapEvents = async (events: Awaited<ReturnType<typeof fetchArchiveEvents>>) => {
	const parseSwapEvents = (data: string[]) => {
		const pubk = getPubK(data)
		return {
			sender: pubk(1, 2),
			amountToken0In: data[3],
			amountToken1In: data[4],
			amountLiquidityOut: data[5]
		}
	}
	const swapData = events
		//TODO: Verify event is #4
		.filter((e) => e?.eventData?.[0]?.data[0] === "4")
		.map((e) => parseSwapEvents(e?.eventData?.[0]?.data.filter(Boolean) ?? []))

	return swapData
}

export const score = {
	key: "LUMINA_SWAP_MINA_TZEKO",
	points: 1,
	maxOccurences: 10,
	strategy: "daily"
} as const

export const handler = {
	fetch: async (fromBlock: number, toBlock?: number) => {
		const events = await fetchArchiveEvents({ address: TZEKO_MINA, fromBlock, toBlock })
		logger.success(
			`Fetched ${events.length} ${score.key} events from blocks ${fromBlock} to ${toBlock}`
		)
		const swapData = await processSwapEvents(events)
		logger.success(`Processed ${swapData.length} ${score.key} swap events`)
		return swapData
	}
}
