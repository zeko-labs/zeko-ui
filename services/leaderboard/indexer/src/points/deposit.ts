import {
	type ActionConfig,
	type ArchiveEvents,
	addresses,
	fetchArchiveEvents,
	getPubK,
	logger
} from "../helper"

// https://github.com/zeko-labs/zeko/blob/compatible/src/app/zeko/circuits/bridge_state.ml#L160-L166
//   type t =
//     { children : C.t
// 	   ; holder_account_l1 : PC.t
//     ; amount : Currency.Amount.t
//     ; recipient : PC.t
//     ; timeout : Slot.t
//     }

// [
//0 	"12090",
//1 	"0",
//2 	"28456991966488890156981985368224313098474519793580539822288612100621279219556",
//3 	"1",
//4 	"5000000000",
//5 	"25591210332236574321093134033516440085020543906895699338635412616510871851012",
//6 	"0",
//7 	"4294967295"
// ]

const processDepositEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[], timestamp: string, transactionHash: string) => {
		const pubk = getPubK(data)
		return {
			children: data[1],
			holderAccountL1: pubk(2, 3),
			amount: data[4],
			recipient: pubk(5, 6),
			timeout: data[7],
			timestamp,
			transactionHash
		}
	}

	const depositData = events
		// .filter((e) => e?.eventData?.[0]?.data[1] === "0") //TODO: Verify event is #0
		.map((e) =>
			parse(
				e?.eventData?.[0]?.data.filter(Boolean) ?? [],
				e?.blockInfo?.timestamp ?? Date.now().toString(),
				e?.eventData?.[0]?.transactionInfo?.hash ?? `faucet_error_${Date.now()}`
			)
		)
	return depositData
}

export const score = {
	key: "BRIDGE_MINA_TO_ZEKO",
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
			address: addresses.L2.BRIDGE_MINA_TO_ZEKO,
			startBlock,
			endBlock,
			moduleName: score.key,
			layer: "L2"
		})

		logger.info(`[${score.key}] Processing ${events.length} raw events`)
		const data = await processDepositEvents(events)
		logger.success(`[${score.key}] Processed ${data.length} deposit events`)

		return { data, lastFetchedBlock }
	}
}
