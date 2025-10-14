import { zekoArchive as graphql } from "."

export const FetchZekoArchiveEvents = graphql(`
	query FetchZekoArchiveEvents($input: EventFilterOptionsInput!) {
        events(input: $input) {
            eventData {
                accountUpdateId
                transactionInfo{
                    status
                    hash
                    memo
                    authorizationKind
                    sequenceNumber
                    zkappAccountUpdateIds
                }
                data
            }
		blockInfo {
            height 
            stateHash
            parentHash
            ledgerHash
            chainStatus
            timestamp
            globalSlotSinceHardfork
            globalSlotSinceGenesis
            distanceFromMaxBlockHeight
        }
		}
	}
`)
