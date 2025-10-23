import { type ArchiveEvents, addresses, fetchArchiveEvents, getPubK, logger } from "../helper"

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
	fetch: async (fromBlock: number) => {
		logger.info(`[${score.key}] Starting fetch from block ${fromBlock}`)

		const { events, lastFetchedBlock } = await fetchArchiveEvents({
			address: addresses.FAUCET_ZEKO_TMINA,
			fromBlock,
			moduleName: score.key
		})

		logger.info(`[${score.key}] Processing ${events.length} raw events`)
		const data = await processFaucetEvents(events)
		logger.success(`[${score.key}] Processed ${data.length} faucet events`)

		return { data, lastFetchedBlock }
	}
}
