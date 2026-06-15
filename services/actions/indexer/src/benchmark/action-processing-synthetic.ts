import { Actions, fromList } from "@zeko-labs/bridge-sdk"
import { Field } from "o1js"
import type { ArchiveAction } from "../action-processing/types"

const createPseudoRandom = (seed: number) => {
	let state = BigInt(seed)
	return () => {
		state = (state * 1_103_515_245n + 12_345n) % 2_147_483_648n
		return Number(state)
	}
}

export function generateSyntheticArchiveBlocks({
	blockCount,
	actionsPerBlock,
	fieldsPerAction,
	seed = 42
}: {
	blockCount: number
	actionsPerBlock: number
	fieldsPerAction: number
	seed?: number
}): ArchiveAction[] {
	const rand = createPseudoRandom(seed)
	const output: ArchiveAction[] = []
	let chainState = Field.from(0)

	for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
		const blockBeforeState = chainState
		const actionData: ArchiveAction["actionData"] = []

		for (let actionIndex = 0; actionIndex < actionsPerBlock; actionIndex++) {
			const values = Array.from({ length: fieldsPerAction }, (_, fieldIndex) =>
				String((rand() + fieldIndex + 1) % 1_000_000)
			)
			const fieldValues = values.map((value) => Field.from(value))
			const nextState = Actions.pushHash(chainState, fromList([fieldValues]).hash)
			actionData.push({
				data: values,
				transactionInfo: { hash: `synthetic-${blockIndex}-${actionIndex}` }
			})
			chainState = nextState
		}

		output.push({
			blockInfo: {
				timestamp: String(Date.now()),
				height: blockIndex + 1,
				distanceFromMaxBlockHeight: blockCount - blockIndex,
				chainStatus: "canonical"
			},
			actionState: {
				actionStateOne: chainState.toString(),
				actionStateTwo: blockBeforeState.toString()
			},
			actionData
		})
	}

	return output
}
