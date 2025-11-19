import { bridgeIndexer as graphql } from "."

export const fetchWitnessesFromAuxesQuery = graphql(`
  query FetchWitnessesFromAuxes($auxes: [String!]!) {
    witnessesFromAuxes(auxes: $auxes) {
      beforeState
      afterState
      length
      blockHeight
      slotRangeLower
      slotRangeUpper
      timestamp
      txnHash
      fields
      aux
    }
  }
`)

export const fetchActionsQueryIndexer = graphql(`
  query FetchActions($fromState: String!, $afterState: String) {
    actions(
      fromState: $fromState
      afterState: $afterState
    ) {
      beforeState
      afterState
      length
      blockHeight
      slotRangeLower
      slotRangeUpper
      timestamp
      txnHash
      fields
      kind
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
        length
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
        beforeState
        afterState
        length
        blockHeight
        slotRangeLower
        slotRangeUpper
        timestamp
        txnHash
        fields
        kind
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
