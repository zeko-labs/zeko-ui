import { type ArchiveEvents, addresses, fetchArchiveEvents, getPubK, logger } from "../helper"

// https://github.com/zeko-labs/zeko/blob/compatible/src/app/zeko/circuits/bridge_state.ml#L191
// type t =
// 	{ children : C.t
// 	; amount : Currency.Amount.t
// 	; recipient : PC.t
// }

// [
// 0 "90",
// 1 "0",
// 2 "5000000000",
// 3 "6662957999645291462548879910486229099857813183356243357938585458874831331066",
// 4 "0"
// ]

const processWithdrawalEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[], timestamp: string, transactionHash: string) => {
		const pubk = getPubK(data)
		return {
			children: data[1],
			amount: data[2],
			recipient: pubk(3, 4),
			timestamp,
			transactionHash
		}
	}

	const withdrawalData = events
		// .filter((e) => e?.eventData?.[0]?.data[1] === "0") //TODO: Verify event is #0
		.map((e) =>
			parse(
				e?.eventData?.[0]?.data.filter(Boolean) ?? [],
				e?.blockInfo?.timestamp ?? Date.now().toString(),
				e?.eventData?.[0]?.transactionInfo?.hash ?? `withdrawal_error_${Date.now()}`
			)
		)
	return withdrawalData
}

export const score = {
	key: "BRIDGE_ZEKO_TO_MINA",
	points: 20,
	maxOccurences: 1,
	strategy: "once"
} as const

export const handler = {
	fetch: async ({ startBlock, endBlock }: { startBlock: number; endBlock: number }) => {
		logger.info(
			`[${score.key}] Starting fetch from block ${startBlock}${endBlock !== Number.POSITIVE_INFINITY ? ` to ${endBlock}` : ""}`
		)

		const minStartBlock = 470_000 // First Withdrawal Event is after this block
		const { events, lastFetchedBlock } = await fetchArchiveEvents({
			address: addresses.L1.BRIDGE_ZEKO_TO_MINA,
			startBlock: Math.max(startBlock, minStartBlock),
			endBlock,
			moduleName: score.key,
			layer: "L1"
		})

		logger.info(`[${score.key}] Processing ${events.length} raw events`)
		const data = await processWithdrawalEvents(events)
		logger.success(`[${score.key}] Processed ${data.length} withdrawal events`)

		return { data, lastFetchedBlock }
	}
}
