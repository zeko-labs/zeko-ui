import { gql } from "@apollo/client/core"
import { Account } from "./types"

export const fetchConfigQuery = gql`
  query {
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
`

export type FetchConfigQuery = {
	circuitsConfig: {
		zekoL1: string
		zekoL2: string
		holderAccountsL1: string[]
		holderAccountL2: string
		helperTokenOwnerL1: string
		chainL1: string
		chainL2: string
		withdrawalDelay: number
	}
}

export const sequencerPkQuery = gql`
  query {
    sequencerPk
  }
`

export type SequencerPkQuery = {
	sequencerPk: string
}

export const fetchActionsQuery = gql`
  query ($pk: String!, $fromActionState: String, $endActionState: String) {
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
`

export type FetchActionsQuery = {
	actions: {
		actionState: {
			actionStateOne: string
			actionStateTwo: string
		}
		actionData: {
			data: string[]
		}[]
	}[]
}

export const runtimeConfigQuery = gql`
  query RuntimeConfig {
    runtimeConfig
  }
`

export type RuntimeConfig = {
	runtimeConfig: {
		proof: {
			fork: {
				global_slot_since_genesis: number
			}
		}
		genesis: {
			genesis_state_timestamp: string
		}
	}
}

export const accountQuery = gql`
  query Account($pk: PublicKey!, $tokenId: TokenId) {
    account(publicKey: $pk, token: $tokenId) {
      zkappState
    }
  }
`

export type AccountQuery = {
	account?: Account
}

export const genesisConstantsQuery = gql`
  query GenesisConstants {
    genesisConstants {
      accountCreationFee
    }
  }
`

export type GenesisConstants = {
	genesisConstants: {
		accountCreationFee: string
	}
}

export const provedForestQuery = gql`
  query provedForest($key: String!) {
    provedForest(key: $key)
  }
`

export type ProvedForest = {
	provedForest: string | null
}

export const submitDepositMutation = gql`
  mutation SubmitDeposit($depositParams: DepositParamsInput!) {
    request: proveDepositRequest(input: { depositParams: $depositParams }) {
      key
    }
  }
`

export const finalizeDepositMutation = gql`
  mutation FinalizeDeposit($input: FinalizeDepositInput!) {
    request: finalizeDeposit(input: $input) {
      key
    }
  }
`

export const submitWithdrawalMutation = gql`
  mutation SubmitWithdrawal($input: SubmitWithdrawalInput!) {
    request: proveWithdrawalRequest(input: $input) {
      key
    }
  }
`

export const finalizeWithdrawalMutation = gql`
  mutation FinalizeWithdrawal($input: FinalizeWithdrawalInput!) {
    request: finalizeWithdrawal(input: $input) {
      key
    }
  }
`
