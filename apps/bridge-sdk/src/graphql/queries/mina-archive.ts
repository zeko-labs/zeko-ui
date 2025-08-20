import { minaArchive as graphql } from ".."

export const fetchActionsQuery = graphql(`
  query FetchActions($pk: String!, $fromActionState: String, $endActionState: String) {
    actions(
      input: {
        address: $pk
        fromActionState: $fromActionState
        endActionState: $endActionState
      }
    ) {
      blockInfo {
        timestamp
      }
      actionState {
        actionStateOne
        actionStateTwo
      }
      actionData {
        data
        transactionInfo {
          status
          hash
        }
      }
    }
  }
`)
