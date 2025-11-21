import { logger } from "../helper"
export const handler = {
	fetch: async ({ startBlock }: { startBlock: number }) => {
		logger.info(`[withdrawal.handler] Fetching from ${startBlock} (not implemented)`)
		return { data: [], lastFetchedBlock: startBlock }
	}
} as const
