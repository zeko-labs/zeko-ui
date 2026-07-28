import { bridgeIndexer as graphql } from "./clients"

export const fetchOuterWitnessesFromAuxesQuery = graphql(`
  query FetchOuterWitnessesFromAuxes($auxes: [String!]!) {
    outerWitnessesFromAuxes(input: { auxes: $auxes }) {
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

export const fetchInnerWitnessesFromAuxesQuery = graphql(`
  query FetchInnerWitnessesFromAuxes($auxes: [String!]!) {
    innerWitnessesFromAuxes(input: { auxes: $auxes }) {
      beforeState
      afterState
      index
      blockHeight
      timestamp
      txnHash
      fields
      aux
    }
  }
`)

export const fetchOuterActionsQueryIndexer = graphql(`
  query FetchOuterActions($beforeState: String!, $afterState: String) {
    outerActions(
      input: { beforeState: $beforeState, afterState: $afterState }
    ) {
      ... on OuterAction {
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

export const fetchInnerActionsQueryIndexer = graphql(`
  query FetchInnerActions($beforeState: String!, $afterState: String) {
    innerActions(
      input: { beforeState: $beforeState, afterState: $afterState }
    ) {
      beforeState
      afterState
      index
      blockHeight
      timestamp
      txnHash
      fields
      aux
    }
  }
`)

export const fetchEthereumAssetRegistryQuery = graphql(`
  query FetchEthereumAssetRegistry(
    $root: String
    $index: Int
    $assetId: String
    $ethereumTokenAddress: String
  ) {
    ethereumAssetRegistry(
      input: {
        root: $root
        index: $index
        assetId: $assetId
        ethereumTokenAddress: $ethereumTokenAddress
      }
    ) {
      schemaVersion
      depth
      root
      count
      blockHeight
      timestamp
      txnHash
      finalityStatus
      records {
        path
        record {
          schemaVersion
          registryIndex
          assetId
          ethereumTokenAddress
          tokenOwnerL2
          tokenIdL2
          decimals
          inventoryCap
          mftStandardVkId
          vaultPublicKey
          universalBridgeVkId
          blockHeight
          timestamp
          txnHash
          finalityStatus
        }
      }
    }
  }
`)

export const fetchCommitAsePastSlotQuery = graphql(`
  query FetchCommitAsePastSlot($slot: Int!) {
    commitAsePastSlot(slot: $slot) {
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
        ... on OuterAction {
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
