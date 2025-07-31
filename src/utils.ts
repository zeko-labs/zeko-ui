import { ApolloClient, NormalizedCacheObject } from "@apollo/client/core";
import { Field, Mina, Poseidon, PublicKey, Types } from "o1js";
import { FetchActionsQuery, fetchActionsQuery } from "./queries";
import { Action, Deposit } from "./types";

export class Actions {
  static empty(): Types.Events {
    return {
      hash: Field.from(
        "2965377540200775924504968637505084669999360240500907972788072774778139588064"
      ),
      data: [],
    };
  }

  static hash(action: Field[]): Field {
    return Poseidon.hashWithPrefix("MinaZkappEvent******", action);
  }

  static pushHash(actionState: Field, hash: Field): Field {
    return Poseidon.hashWithPrefix("MinaZkappSeqEvents**", [actionState, hash]);
  }

  static pushAction(actions: Types.Events, action: Field[]): Types.Events {
    return {
      hash: Actions.pushHash(actions.hash, Actions.hash(action)),
      data: [action, ...actions.data],
    };
  }

  static fromList(events: Field[][]): Types.Events {
    return [...events].reverse().reduce(Actions.pushAction, Actions.empty());
  }
}

export async function fetchActions(
  client: ApolloClient<NormalizedCacheObject>,
  pk: PublicKey,
  actionStates?: Mina.ActionStates
): Promise<Action[]> {
  const {
    data: { actions },
  } = await client.query<FetchActionsQuery>({
    query: fetchActionsQuery,
    variables: {
      pk,
      fromActionState: actionStates?.fromActionState,
      endActionState: actionStates?.endActionState,
    },
  });

  return actions
    .map(
      ({ actionState: { actionStateTwo: actionStateBefore }, actionData }) => {
        const actions = actionData.map(({ data }) => data.map(Field.from));
        let actionState = Field.from(actionStateBefore);

        let correctActions = [];
        for (const action of actions) {
          const afterActionState = Actions.pushHash(
            actionState,
            Actions.fromList([action]).hash
          );
          correctActions.push({
            action,
            beforeActionState: actionState,
            afterActionState,
          });
          actionState = afterActionState;
        }

        return correctActions;
      }
    )
    .flat();
}

export function depositAux(deposit: Deposit) {
  return Poseidon.hashWithPrefix("Deposit_params - qFB3jXP*)", [
    Field(0),
    ...deposit.holderAccountL1.toFields(),
    ...deposit.amount.toFields(),
    ...deposit.recipient.toFields(),
    ...deposit.timeout.toFields(),
  ]);
}
