import { type ArchiveEvents, BridgeAddress, fetchArchiveEvents, getPubK, logger } from "../helper"

//https://github.com/zeko-labs/zeko/blob/compatible/src/app/zeko/circuits/bridge_state.ml#L160-L166
//   type t =
//     { children : C.t ; holder_account_l1 : PC.t
//     ; amount : Currency.Amount.t
//     ; recipient : PC.t
//     ; timeout : Slot.t
//     }

const processDepositEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[]) => {
		const pubk = getPubK(data)
		return {
			children: data[2],
			holderAccountL1: pubk(3, 4),
			amount: data[5],
			recipient: pubk(6, 7),
			timeout: data[8]
		}
	}

	const depositData = events
		.filter((e) => e?.eventData?.[0]?.data[0] === "1") //TODO: Verify event is #1
		.map((e) => parse(e?.eventData?.[0]?.data.filter(Boolean) ?? []))
	return depositData
}

export const score = {
	key: "BRIDGE_MINA_TO_ZEKO",
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
		const depositData = await processDepositEvents(events)
		logger.success(`Processed ${depositData.length} ${score.key} deposit events`)
		return depositData
	}
}
