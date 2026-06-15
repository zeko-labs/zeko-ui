import { Actions, fromList } from "@zeko-labs/bridge-sdk"
import { Field } from "o1js"
import type { ActionProcessingResult, ArchiveAction, ArchiveEvent } from "./types"

const ORPHANED_CHAIN_STATUS = "orphaned"

/**
 * Selects the live chain from archive blocks by dropping orphaned dead-fork
 * blocks. The Mina archive can return blocks from more than one chain instance
 * (for example after an L2 re-genesis that reused the archive database), in which
 * case the actions for an address span multiple branches that do not form a
 * single linear chain. Orphaned blocks are the dead forks; canonical and pending
 * blocks belong to the live chain and are kept, preserving order.
 */
export function selectCanonicalBlocks(blocks: ArchiveAction[]): ArchiveAction[] {
	return blocks.filter((block) => block.blockInfo.chainStatus !== ORPHANED_CHAIN_STATUS)
}

export function validateEventChain(events: ArchiveEvent[]): void {
	for (let index = 1; index < events.length; index++) {
		const previous = events[index - 1]
		const current = events[index]
		if (previous.afterActionState !== current.beforeActionState) {
			throw new Error(
				`invalid actions chain at index=${index}: prev.afterActionState=${previous.afterActionState} != curr.beforeActionState=${current.beforeActionState}`
			)
		}
	}
}

export function processArchiveBlocks({
	blocks,
	strategy
}: {
	blocks: ArchiveAction[]
	strategy: "main" | "worker"
}): ActionProcessingResult {
	const start = performance.now()
	const hashStart = performance.now()

	const events: ArchiveEvent[] = []

	for (const block of blocks) {
		const {
			actionState: { actionStateTwo: actionStateBefore, actionStateOne: actionStateAfter },
			actionData,
			blockInfo
		} = block

		let actionState = Field.from(actionStateBefore)
		const expectedFinalState = Field.from(actionStateAfter)
		let blockLastAfterStateString: string | null = null

		for (const actionItem of actionData) {
			const actionFields = actionItem.data.map((value) => Field.from(value))
			const afterActionState = Actions.pushHash(actionState, fromList([actionFields]).hash)
			const beforeActionStateString = actionState.toString()
			const afterActionStateString = afterActionState.toString()

			events.push({
				action: actionItem.data,
				beforeActionState: beforeActionStateString,
				afterActionState: afterActionStateString,
				timestamp: blockInfo.timestamp,
				hash: actionItem.transactionInfo.hash,
				blockInfo
			})

			actionState = afterActionState
			blockLastAfterStateString = afterActionStateString
		}

		if (actionData.length > 0 && !actionState.equals(expectedFinalState).toBoolean()) {
			throw new Error(
				`invalid actions sequence in block ${blockInfo.height}: last action afterActionState=${blockLastAfterStateString} != actionStateAfter=${expectedFinalState.toString()}`
			)
		}
	}

	const hashingMs = performance.now() - hashStart
	const validationStart = performance.now()

	validateEventChain(events)

	const validationMs = performance.now() - validationStart
	const totalMs = performance.now() - start

	return {
		events,
		stats: {
			strategy,
			totalMs,
			hashingMs,
			validationMs,
			blocks: blocks.length,
			events: events.length,
			bottleneck: hashingMs >= validationMs ? "hashing" : "validation"
		}
	}
}
