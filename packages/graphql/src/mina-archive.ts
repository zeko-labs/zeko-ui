import { minaArchive as graphql } from "./clients"

export const fetchActionsQuery = graphql(`
  query FetchActions($pk: String!, $fromActionState: String, $endActionState: String, $from: Int, $to: Int) {
    actions(
      input: {
        address: $pk
        fromActionState: $fromActionState
        endActionState: $endActionState
        from: $from
        to: $to
      }
    ) {
      blockInfo {
        timestamp
        height
        distanceFromMaxBlockHeight
        chainStatus
      }
      actionState {
        actionStateOne
        actionStateTwo
      }
      actionData {
        accountUpdateId
        data
        transactionInfo {
          hash
        }
      }
    }
  }
`)

export const fetchEventsQuery = graphql(`
  query FetchEvents($pk: String!, $from: Int, $to: Int) {
    events(input: { address: $pk, from: $from, to: $to }) {
      blockInfo {
        timestamp
        height
        distanceFromMaxBlockHeight
        chainStatus
      }
      eventData {
        data
        transactionInfo {
          hash
        }
      }
    }
  }
`)

export const networkStateQuery = graphql(`
  query NetworkState {
    networkState {
      maxBlockHeight {
        canonicalMaxBlockHeight
        pendingMaxBlockHeight
      }
    }
  }
`)
