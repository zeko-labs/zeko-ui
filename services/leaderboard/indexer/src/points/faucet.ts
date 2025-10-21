import { type ArchiveEvents, fetchArchiveEvents, getPubK, logger } from "../helper"

const faucetAddress = "B62qnMgvs8iS6wVe56ajqcqtagAov2TGtvD3cWfEB7rAwfCU6x7HdgB"

const processFaucetEvents = async (events: ArchiveEvents) => {
	const parseFaucetEvents = (data: string[]) => {
		const pubk = getPubK(data)
		return { claimer: pubk(2, 3), amount: data[4] }
	}

	const faucetData = events
		//TODO: Verify event is #0
		.filter((e) => e?.eventData?.[0]?.data[0] === "0")
		.map((e) => {
			return parseFaucetEvents(e?.eventData?.[0]?.data.filter(Boolean) ?? [])
		})
	return faucetData
}

export const score = {
	key: "FAUCET_ZEKO_TMINA",
	points: 20,
	maxOccurences: 1,
	strategy: "once"
} as const

export const handler = {
	fetch: async (fromBlock: number, toBlock?: number) => {
		const events = await fetchArchiveEvents({ address: faucetAddress, fromBlock, toBlock })
		logger.success(
			`Fetched ${events.length} ${score.key} events from blocks ${fromBlock} to ${toBlock}`
		)
		const faucetData = await processFaucetEvents(events)
		logger.success(`Processed ${faucetData.length} ${score.key} faucet events`)
		return faucetData
	}
}
