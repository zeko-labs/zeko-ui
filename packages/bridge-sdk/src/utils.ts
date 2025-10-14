import { fetchAccount, Field, type Mina, Poseidon, PublicKey, UInt32 } from "o1js"
import type { Client } from "urql"
import * as v from "valibot"
import { fromList, pushHash } from "./actions"
import { fetchActionsQuery } from "./graphql/queries/mina-archive"
import type { Account, Action, Deposit, Withdrawal } from "./types"

// The graphQL schema server will limit the block scan range to a fixed number of blocks.
// https://github.com/o1-labs/Archive-Node-API/blob/2d726955502fbd02c70d388f589284dd838bbb45/src/server/server.ts#L13
const BLOCK_RANGE_SIZE = 10_000

export async function fetchActions(
	client: Client,
	pk: PublicKey,
	actionStates?: Mina.ActionStates
): Promise<Action[]> {
	const fetchActionsRecursive = async ({
		fromBlock,
		toBlock
	}: { fromBlock?: number; toBlock?: number }) => {
		const { data } = await client.query(fetchActionsQuery, {
			pk: pk.toBase58(),
			fromActionState: actionStates?.fromActionState?.toString() ?? null,
			endActionState: actionStates?.endActionState?.toString() ?? null,
			from: fromBlock ?? null,
			to: toBlock ?? null
		})
		const dataWithDefault = data?.actions.map((a) => ({
			...a,
			actionData: a?.actionData?.map((ad) => ({
				...ad,
				transactionInfo: ad?.transactionInfo ?? { status: "status", hash: "hash" }
			})),
			blockInfo: {
				timestamp: String(a?.blockInfo?.timestamp ?? "0"),
				height: Number(a?.blockInfo?.height ?? 0)
			}
		}))

		const schema = v.array(
			v.object({
				blockInfo: v.object({ timestamp: v.string(), height: v.number() }),
				actionState: v.object({
					actionStateOne: v.string(),
					actionStateTwo: v.string()
				}),
				actionData: v.array(
					v.object({
						data: v.array(v.string()),
						transactionInfo: v.object({ status: v.string(), hash: v.string() })
					})
				)
			})
		)

		const result = v.safeParse(schema, dataWithDefault)
		if (!result.success) throw new Error("Invalid actions data")

		if (result.output.length === 0) return result.output

		const prevOutput: v.InferOutput<typeof schema> = await fetchActionsRecursive({
			fromBlock: result.output[0].blockInfo.height - BLOCK_RANGE_SIZE
		})
		return [...prevOutput, ...result.output]
	}

	const output = await fetchActionsRecursive({})

	return output.flatMap(
		({
			actionState: { actionStateTwo: actionStateBefore },
			actionData,
			blockInfo: { timestamp }
		}) => {
			const actions = actionData.map(({ data, transactionInfo: { hash, status } }) => ({
				data: data.map(Field.from),
				hash,
				status
			}))
			let actionState = Field.from(actionStateBefore)

			const correctActions = []
			for (const action of actions) {
				const afterActionState = pushHash(actionState, fromList([action.data]).hash)
				correctActions.push({
					action: action.data,
					beforeActionState: actionState,
					afterActionState,
					timestamp,
					hash: action.hash,
					status: action.status
				})
				actionState = afterActionState
			}

			return correctActions
		}
	)
}

export function depositAux(deposit: Deposit) {
	return Poseidon.hashWithPrefix("Deposit_params - qFB3jXP*)", [
		Field(0), // Empty children
		...deposit.holderAccountL1.toFields(),
		...deposit.amount.toFields(),
		...deposit.recipient.toFields(),
		...deposit.timeout.toFields()
	])
}

export function withdrawalAux(withdrawal: Withdrawal) {
	return Poseidon.hashWithPrefix("Withdrawal_params - qFB3jXP*)", [
		Field(0), // Empty children
		...withdrawal.amount.toFields(),
		...withdrawal.recipient.toFields()
	])
}

export function getNextDepositIndex(helperAccount: Account): UInt32 {
	const nextDepositIndex = helperAccount.zkappState?.at(0)
	return UInt32.from(nextDepositIndex ?? 0)
}

export function getNextWithdrawalIndex(helperAccount: Account): UInt32 {
	const nextWithdrawalIndex = helperAccount.zkappState?.at(1)
	return UInt32.from(nextWithdrawalIndex ?? 0)
}

export function filterNulls<T>(arr: (T | null)[]): T[] {
	return arr.filter(Boolean).map((x) => {
		if (x === null) throw new Error("Unreachable")
		return x
	})
}

export async function refreshCache(feePayer: Mina.FeePayerSpec) {
	if (feePayer instanceof PublicKey) {
		await fetchAccount({ publicKey: feePayer })
	} else if (feePayer) {
		await fetchAccount({
			publicKey: feePayer.sender
		})
	}
}
