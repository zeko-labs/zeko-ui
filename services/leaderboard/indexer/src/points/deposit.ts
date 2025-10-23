import { type ArchiveEvents, addresses, fetchArchiveEvents, getPubK, logger } from "../helper"

//https://github.com/zeko-labs/zeko/blob/compatible/src/app/zeko/circuits/bridge_state.ml#L160-L166
//   type t =
//     { children : C.t ; holder_account_l1 : PC.t
//     ; amount : Currency.Amount.t
//     ; recipient : PC.t
//     ; timeout : Slot.t
//     }

const processDepositEvents = async (events: ArchiveEvents) => {
	const parse = (data: string[], timestamp: string, transactionHash: string) => {
		const pubk = getPubK(data)
		return {
			children: data[2],
			holderAccountL1: pubk(3, 4),
			amount: data[5],
			recipient: pubk(6, 7),
			timeout: data[8],
			timestamp,
			transactionHash
		}
	}

	const depositData = events
		.filter((e) => e?.eventData?.[0]?.data[0] === "0") //TODO: Verify event is #0
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
	fetch: async (fromBlock: number) => {
		logger.info(`[${score.key}] Starting fetch from block ${fromBlock}`)

		const { events, lastFetchedBlock } = await fetchArchiveEvents({
			address: addresses.BRIDGE_MINA_TO_ZEKO,
			fromBlock,
			moduleName: score.key
		})

		logger.info(`[${score.key}] Processing ${events.length} raw events`)
		const data = await processDepositEvents(events)
		logger.success(`[${score.key}] Processed ${data.length} deposit events`)

		return { data, lastFetchedBlock }
	}
}
