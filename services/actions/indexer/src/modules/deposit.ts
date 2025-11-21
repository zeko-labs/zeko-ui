import type { ArchiveEvent } from "../helper"
import { fetchActions, l1Client, logger } from "../helper"

export const handler = {
	fetch: async ({ startBlock }: { startBlock: number }) => {
		logger.info(`[deposit.handler] Fetching from ${startBlock}`)
		const actions = await fetchActions({ client: l1Client, fromBlock: startBlock })

		const data = actions.map((item: ArchiveEvent) => {
			const beforeState = item.beforeActionState ? item.beforeActionState.toString() : null
			const afterState = item.afterActionState.toString()
			const kind = item.action[0].toString() === "0" ? "commit" : "witness"
			const length = item.action.length
			const blockHeight = item.blockInfo?.height ?? 0

			if (kind === "commit")
				return {
					kind: "commit" as const,
					afterState,
					beforeState,
					length,
					blockHeight,
					ledger: item.action[1].toString(),
					innerActionState: item.action[2].toString(),
					innerActionStateLength: Number(item.action[3].toString()),
					synchronizedOuterActionState: item.action[4].toString(),
					synchronizedOuterActionStateLength: Number(item.action[5].toString()),
					slotRangeLower: Number(item.action[6]?.toString() ?? 0),
					slotRangeUpper: Number(item.action[7]?.toString() ?? 0)
				}

			return {
				kind: "witness" as const,
				afterState,
				beforeState,
				length,
				blockHeight,
				aux: item.action[1].toString()
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
