import { type ArchiveEvents, fetchArchiveEvents, getPubK } from "../helper"

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

export const handler = {
	points: 10,
	maxOccurences: 1,
	fetch: async () => {
		const events = await fetchArchiveEvents(faucetAddress)
		const faucetData = await processFaucetEvents(events)
		return faucetData
	}
}
