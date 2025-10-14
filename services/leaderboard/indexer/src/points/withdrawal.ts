import { BridgeAddress, fetchArchiveEvents } from "../helper"

export const handler = {
	points: 20,
	maxOccurences: 1,
	fetch: async () => {
		const events = await fetchArchiveEvents(BridgeAddress)
		return events
	}
}
