import { type ArchiveEvents, addresses, fetchArchiveEvents, getPubK, logger } from "../helper"

// ReceiveMinaEvent
// [ "3", "7994353054957568193498626604873088658666758397914343032172656113958151515402",
//          "0", "1000000000"
//        ]
// SwapEvent
// [ "4", "7994353054957568193498626604873088658666758397914343032172656113958151515402",
//           "0", "1000000000", "240787553"
//         ]

const processSwapEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[], timestamp: string, transactionHash: string) => {
		const pubk = getPubK(data)
		return data[0] === "3"
			? {
					sender: pubk(1, 2),
					amountMinaIn: data[3],
					timestamp,
					transactionHash
				}
			: {
					sender: pubk(1, 2),
					amountIn: data[3],
					amountOut: data[4],
					timestamp,
					transactionHash
				}
	}
	const swapData = events
		.filter((e) => e?.eventData?.[0]?.data[0] === "4" || e?.eventData?.[0]?.data[0] === "3")
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
		// console.dir(events, { depth: null })
		const data = await processSwapEvents(events)
		logger.success(`[${score.key}] Processed ${data.length} swap events`)

		return { data, lastFetchedBlock }
	}
}
