import type { ApolloClient, NormalizedCacheObject } from "@apollo/client/core"
import { Field, type Mina, Poseidon, type PublicKey, } from "o1js"
import { fromList, pushHash } from "./actions"
import { type FetchActionsQuery, fetchActionsQuery } from "./queries"
import type { Action, Deposit, Withdrawal } from "./types"


export async function fetchActions(
	client: ApolloClient<NormalizedCacheObject>,
	pk: PublicKey,
	actionStates?: Mina.ActionStates,
): Promise<Action[]> {
	const {
		data: { actions },
	} = await client.query<FetchActionsQuery>({
		query: fetchActionsQuery,
		variables: {
			pk,
			fromActionState: actionStates?.fromActionState ?? null,
			endActionState: actionStates?.endActionState ?? null,
		},
	})

	return actions.flatMap(
		({ actionState: { actionStateTwo: actionStateBefore }, actionData }) => {
			const actions = actionData.map(({ data }) => data.map(Field.from))
			let actionState = Field.from(actionStateBefore)

			const correctActions = []
			for (const action of actions) {
				const afterActionState = pushHash(
					actionState,
					fromList([action]).hash,
				)
				correctActions.push({
					action,
					beforeActionState: actionState,
					afterActionState,
				})
				actionState = afterActionState
			}

			return correctActions
		},
	)
}

export function depositAux(deposit: Deposit) {
	return Poseidon.hashWithPrefix("Deposit_params - qFB3jXP*)", [
		Field(0), // Empty children
		...deposit.holderAccountL1.toFields(),
		...deposit.amount.toFields(),
		...deposit.recipient.toFields(),
		...deposit.timeout.toFields(),
	])
}

export function withdrawalAux(withdrawal: Withdrawal) {
	return Poseidon.hashWithPrefix("Withdrawal_params - qFB3jXP*)", [
		Field(0), // Empty children
		...withdrawal.amount.toFields(),
		...withdrawal.recipient.toFields(),
	])
}
