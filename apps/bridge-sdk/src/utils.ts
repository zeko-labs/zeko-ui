import { Field, type Mina, Poseidon, type PublicKey } from "o1js"
import type { Client } from "urql"
import * as v from "valibot"
import { fromList, pushHash } from "./actions"
import { fetchActionsQuery } from "./graphql/queries/mina-archive"
import type { Action, Deposit, Withdrawal } from "./types"

export async function fetchActions(
	client: Client,
	pk: PublicKey,
	actionStates?: Mina.ActionStates
): Promise<Action[]> {
	const { data } = await client.query(fetchActionsQuery, {
		pk: pk.toBase58(),
		fromActionState: actionStates?.fromActionState?.toString() ?? null,
		endActionState: actionStates?.endActionState?.toString() ?? null
	})
	// We make sure there's no null data
	const result = v.safeParse(
		v.array(
			v.object({
				actionState: v.object({
					actionStateOne: v.string(),
					actionStateTwo: v.string()
				}),
				actionData: v.array(v.object({ data: v.array(v.string()) }))
			})
		),
		data?.actions
	)
	if (!result.success) throw new Error("Invalid actions data")
	return result.output.flatMap(
		({ actionState: { actionStateTwo: actionStateBefore }, actionData }) => {
			const actions = actionData.map(({ data }) => data.map(Field.from))
			let actionState = Field.from(actionStateBefore)

			const correctActions = []
			for (const action of actions) {
				const afterActionState = pushHash(actionState, fromList([action]).hash)
				correctActions.push({
					action,
					beforeActionState: actionState,
					afterActionState
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
