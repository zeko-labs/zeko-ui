import { mina as graphql } from "./clients"

export const genesisConstantsQueryL1 = graphql(`
  query GenesisConstants {
    genesisConstants {
      accountCreationFee
    }
  }
`)

export const runtimeConfigQuery = graphql(`
  query RuntimeConfig {
    runtimeConfig
  }
`)

export const accountQuery = graphql(`
  query Account($pk: PublicKey!, $tokenId: TokenId) {
    account(publicKey: $pk, token: $tokenId) {
      zkappState
    }
  }
`)
