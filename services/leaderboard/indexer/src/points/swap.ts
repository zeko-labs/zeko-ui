import { TZEKO_MINA, fetchArchiveEvents, getPubK } from "../helper"

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

export const handler = {
	points: 5,
	maxOccurences: 20,
	fetch: async () => {
		const events = await fetchArchiveEvents(TZEKO_MINA)
		const swapData = await processSwapEvents(events)
		return swapData
	}
}
