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
      actionState {
        actionStateOne
        actionStateTwo
      }
      actionData {
        data
      }
    }
  }
`)
