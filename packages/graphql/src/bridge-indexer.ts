import { bridgeIndexer as graphql } from "."

export const fetchWitnessesFromAuxesQuery = graphql(`
  query FetchWitnessesFromAuxes($auxes: [String!]!) {
    witnessesFromAuxes(input: { auxes: $auxes }) {
      beforeState
      afterState
      index
      blockHeight
      slotRangeLower
      slotRangeUpper
      timestamp
      txnHash
      fields
      aux
      kind
    }
  }
`)

export const fetchActionsQueryIndexer = graphql(`
  query FetchActions($beforeState: String!, $afterState: String) {
    actions(
      input: { beforeState: $beforeState, afterState: $afterState }
    ) {
      ... on Action {
        beforeState
        afterState
        index
        blockHeight
        slotRangeLower
        slotRangeUpper
        timestamp
        txnHash
        fields
        kind
      }
      ... on Commit {
        ledger
        innerActionState
        innerActionStateLength
        synchronizedOuterActionState
        synchronizedOuterActionStateLength
      }
      ... on Witness {
        aux
      }
    }
  }
`)

export const fetchCommitAsePastWithdrawalDelayQuery = graphql(`
  query FetchCommitAsePastWithdrawalDelay($slot: Int!) {
    commitAsePastWithdrawalDelay(slot: $slot) {
      commit {
        beforeState
        afterState
        index
        blockHeight
        slotRangeLower
        slotRangeUpper
        timestamp
        txnHash
        fields
        kind
        ledger
        innerActionState
        innerActionStateLength
        synchronizedOuterActionState
        synchronizedOuterActionStateLength
      }
      ase {
        ... on Action {
          beforeState
          afterState
          index
          blockHeight
          slotRangeLower
          slotRangeUpper
          timestamp
          txnHash
          fields
          kind
        }
        ... on Witness {
          aux
        }
        ... on Commit {
          ledger
          innerActionState
          innerActionStateLength
          synchronizedOuterActionState
          synchronizedOuterActionStateLength
        }
      }
    }
  }
`)
