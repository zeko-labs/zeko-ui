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
    }
  }
`)

export const sequencerPkQuery = graphql(`
  query SequencerPK {
    sequencerPk
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
  mutation SubmitDeposit($depositParams: DepositParamsInput!) {
    request: proveDepositRequest(input: { depositParams: $depositParams }) {
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
  mutation SubmitWithdrawal($input: WithdrawalParamsInput!) {
    request: proveWithdrawalRequest(input: $input) {
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

export const provedForestQuery = graphql(`
  query provedForest($key: String!) {
    provedForest(key: $key)
  }
`)
