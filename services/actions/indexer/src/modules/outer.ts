import { emptyActionsList } from "@zeko/bridge-sdk"
import { env } from "../env"
import type { ArchiveEvent } from "../helper"
import { fetchActions, l1Client, logger } from "../helper"

/**
 * Handler for fetching outer actions (deposits) from the L1 archieve.
 */

export const handler = {
	fetch: async ({ startBlock }: { startBlock: number }) => {
		logger.info(`[outer.handler] Fetching from ${startBlock}`)

		const actions = await fetchActions({ client: l1Client, fromBlock: startBlock })

		const data = actions.map((item: ArchiveEvent) => {
			const beforeState = item.beforeActionState.equals(emptyActionsList).toBoolean()
				? null
				: item.beforeActionState.toString()
			const afterState = item.afterActionState.toString()
			const kind = item.action[0].equals(0).toBoolean() ? "commit" : "witness"
			const blockHeight = item.blockInfo.height
			const markedAsCanonicalAt =
				item.blockInfo.distanceFromMaxBlockHeight >= env.L1_FINALITY ? new Date() : null

			if (kind === "commit")
				return {
					kind: "commit" as const,
					fields: item.action,
					timestamp: item.timestamp,
					hash: item.hash,
					afterState,
					beforeState,
					blockHeight,
					ledger: item.action[1].toString(),
					innerActionState: item.action[2].toString(),
					innerActionStateLength: Number(item.action[3].toString()),
					synchronizedOuterActionState: item.action[4].toString(),
					synchronizedOuterActionStateLength: Number(item.action[5].toString()),
					slotRangeLower: Number(item.action[6].toString()),
					slotRangeUpper: Number(item.action[7].toString()),
					markedAsCanonicalAt
				}

			return {
				kind: "witness" as const,
				fields: item.action,
				timestamp: item.timestamp,
				hash: item.hash,
				afterState,
				beforeState,
				blockHeight,
				aux: item.action[1].toString(),
				slotRangeLower: Number(item.action[3].toString()),
				slotRangeUpper: Number(item.action[4].toString()),
				markedAsCanonicalAt
			}
		})

		// Debug: log a small sample of beforeStates and afterStates to help diagnose missing parents
		if (data.length) {
			const sample = data.slice(0, 5)
			logger.info(
				`[deposit.handler] fetched ${data.length} actions; sample beforeStates: ${sample.map((d) => d.beforeState ?? "NULL").join(", ")}`
			)
		}

		const lastFetchedBlock = actions.length
			? actions[actions.length - 1].blockInfo.height
			: startBlock
		return { data, lastFetchedBlock }
	}
} as const
