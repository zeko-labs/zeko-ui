import { type ArchiveEvents, addresses, fetchArchiveEvents, getPubK, logger } from "../helper"

//    data: [ "0", "7994353054957568193498626604873088658666758397914343032172656113958151515402",
//           "0", "1000000000", "4056640838", "9023684"
//         ]

const processAddLiquidityEvent = async (events: ArchiveEvents) => {
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
	fetch: async ({ startBlock, endBlock }: { startBlock: number; endBlock: number }) => {
		logger.info(
			`[${score.key}] Starting fetch from block ${startBlock}${endBlock !== Number.POSITIVE_INFINITY ? ` to ${endBlock}` : ""}`
		)

		const { events, lastFetchedBlock } = await fetchArchiveEvents({
			address: addresses.L2.LUMINA_POOL_TZEKO_MINA,
			startBlock,
			endBlock,
			moduleName: score.key,
			layer: "L2"
		})

		logger.info(`[${score.key}] Processing ${events.length} raw events`)
		const data = await processAddLiquidityEvent(events)
		logger.success(`[${score.key}] Processed ${data.length} liquidity events`)

		return { data, lastFetchedBlock }
	}
}
