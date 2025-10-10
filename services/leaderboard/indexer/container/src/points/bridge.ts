import { fetchAllZekoEvents } from "../helper"

export const handler = () => {
	const bridgeAddress = ""
	return {
		fetch: async () => {
			const events = await fetchAllZekoEvents(bridgeAddress)
			return events
		}
	}
}
