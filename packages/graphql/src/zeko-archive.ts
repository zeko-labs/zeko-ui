import { zekoArchive as graphql } from "."

export const FetchZekoArchiveEvents = graphql(`
query FetchZekoArchiveEvents($input: EventFilterOptionsInput!) {
  events(input: $input) {
    eventData {
      transactionInfo {
        hash
      }
      data
    }
    blockInfo {
      height
      timestamp
      distanceFromMaxBlockHeight
    }
  }
}
`)
