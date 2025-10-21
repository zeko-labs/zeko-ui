import { type ArchiveEvents, BridgeAddress, fetchArchiveEvents, getPubK, logger } from "../helper"

// https://github.com/zeko-labs/zeko/blob/compatible/src/app/zeko/circuits/bridge_state.ml#L191
//  type t = { children : C.t; amount : Currency.Amount.t; recipient : PC.t }

const processWithdrawalEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[]) => {
		const pubk = getPubK(data)
		return { children: data[2], amount: data[3], recipient: pubk(4, 5) }
	}

	const withdrawalData = events
		.filter((e) => e?.eventData?.[0]?.data[0] === "0") //TODO: Verify event is #0
		.map((e) => parse(e?.eventData?.[0]?.data.filter(Boolean) ?? []))
	return withdrawalData
}

export const score = {
	key: "BRIDGE_ZEKO_TO_MINA",
	points: 20,
	maxOccurences: 1,
	strategy: "once"
} as const

export const handler = {
	fetch: async (fromBlock: number, toBlock?: number) => {
		const events = await fetchArchiveEvents({ address: BridgeAddress, fromBlock, toBlock })
		logger.success(
			`Fetched ${events.length} ${score.key} events from blocks ${fromBlock} to ${toBlock}`
		)
		const withdrawalData = await processWithdrawalEvents(events)
		logger.success(`Processed ${withdrawalData.length} ${score.key} withdrawal events`)
		return withdrawalData
	}
}
