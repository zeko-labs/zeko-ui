export * from "./drizzle/schema"
export { checkDatabaseConnectionString } from "./src/helpers/utils"

export interface BroadcastPayload {
	maxBlockHeight: number
	hasNewEntries: boolean
}
