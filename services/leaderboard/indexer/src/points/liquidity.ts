import { type ArchiveEvents, TZEKO_MINA, fetchArchiveEvents, getPubK } from "../helper"

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

export const handler = {
	points: 10,
	maxOccurences: 5,
	fetch: async () => {
		const events = await fetchArchiveEvents(TZEKO_MINA)
		const liquidityData = await processAddLiquidityEvent(events)
		return liquidityData
	}
}
