import { zeko as graphql } from "./clients"

export const fetchConfigQuery = graphql(`
  query FetchConfig {
    circuitsConfig {
      zekoL1
      zekoL2
      holderAccountsL1
      holderAccountL2
      helperTokenOwnerL1
      chainL1
      chainL2
      withdrawalDelay
      bridgeFeeRecipientL1
      bridgeFeeRecipientL2
      bridgeProofFee
    }
  }
`)

export const sequencerPkQuery = graphql(`
  query SequencerPK {
    sequencerPk
  }
`)

export const fetchLiveActionsQuery = graphql(`
  query FetchLiveActions($pk: PublicKey!, $fromActionState: String) {
    actions(input: { address: $pk, fromActionState: $fromActionState }) {
      blockInfo {
        timestamp
        height
      }
      actionState {
        actionStateOne
        actionStateTwo
      }
      actionData {
        data
        transactionInfo {
          hash
        }
      }
    }
  }
`)

export const genesisConstantsQueryL2 = graphql(`
  query GenesisConstants {
    genesisConstants {
      accountCreationFee
    }
  }
`)

export const submitDepositMutation = graphql(`
  mutation SubmitDeposit($depositParams: DepositParamsInput!, $transferrer: BridgeTransferrerInput!) {
    request: proveDepositRequest(input: { depositParams: $depositParams, transferrer: $transferrer }) {
      key
    }
  }
`)

export const finalizeDepositMutation = graphql(`
  mutation FinalizeDeposit($input: FinalizeDepositInput!) {
    request: finalizeDeposit(input: $input) {
      key
    }
  }
`)

export const submitWithdrawalMutation = graphql(`
  mutation SubmitWithdrawal($withdrawalParams: WithdrawalParamsInput!, $transferrer: BridgeTransferrerInput!) {
    request: proveWithdrawalRequest(input: { withdrawalParams: $withdrawalParams, transferrer: $transferrer }) {
      key
    }
  }
`)

export const finalizeWithdrawalMutation = graphql(`
  mutation FinalizeWithdrawal($input: FinalizeWithdrawalInput!) {
    request: finalizeWithdrawal(input: $input) {
      key
    }
  }
`)

export const cancelDepositMutation = graphql(`
  mutation CancelDeposit($input: FinalizeCancelledDepositInput!) {
    request: cancelDeposit(input: $input) {
      key
    }
  }
`)

export const provedResultQuery = graphql(`
  query provingResult($key: String!) {
    provingResult(key: $key)
  }
`)
