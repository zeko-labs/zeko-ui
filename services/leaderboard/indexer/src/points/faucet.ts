import {
	type ActionConfig,
	type ArchiveEvents,
	addresses,
	fetchArchiveEvents,
	getPubK,
	logger
} from "../helper"

const processFaucetEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[], timestamp: string, transactionHash: string) => {
		const pubk = getPubK(data)
		return { claimer: pubk(2, 3), amount: data[4], timestamp, transactionHash }
	}

	const faucetData = events
		//TODO: Verify event is #0
		.filter((e) => e?.eventData?.[0]?.data[0] === "0")
		.map((e) =>
			parse(
				e?.eventData?.[0]?.data.filter(Boolean) ?? [],
				e?.blockInfo?.timestamp ?? Date.now().toString(),
				e?.eventData?.[0]?.transactionInfo?.hash ?? `faucet_error_${Date.now()}`
			)
		)
	return faucetData
}

export const score = {
	key: "FAUCET_ZEKO_TMINA",
	points: 20,
	maxOccurences: 1,
	strategy: "once"
} as const

export const handler = {
	fetch: async ({ startBlock, endBlock }: ActionConfig) => {
		logger.info(
			`[${score.key}] Starting fetch from block ${startBlock}${endBlock !== Number.POSITIVE_INFINITY ? ` to ${endBlock}` : ""}`
		)

		const { events, lastFetchedBlock } = await fetchArchiveEvents({
			address: addresses.L2.FAUCET_ZEKO_TMINA,
			startBlock,
			endBlock,
			moduleName: score.key,
			layer: "L2"
		})

		logger.info(`[${score.key}] Processing ${events.length} raw events`)
		const data = await processFaucetEvents(events)
		logger.success(`[${score.key}] Processed ${data.length} faucet events`)

		return { data, lastFetchedBlock }
	}
}
