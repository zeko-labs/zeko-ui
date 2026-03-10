import { initGraphQLTada } from "gql.tada"
import type { introspection as bridgeIndexerSchema } from "./generated/bridge-indexer-env"
import type { introspection as leaderboardSchema } from "./generated/leaderboard-env"
import type { introspection as minaArchiveSchema } from "./generated/mina-archive-env"
import type { introspection as minaSchema } from "./generated/mina-env"
import type { introspection as zekoArchiveSchema } from "./generated/zeko-archive-env"
import type { introspection as zekoSchema } from "./generated/zeko-env"

type Scalars = {
	UInt64: string
	UInt32: string
	PublicKey: string
	TokenID: string
	Fee: string
	FieldElem: string
}

export const zeko = initGraphQLTada<{ introspection: zekoSchema; scalars: Scalars }>()
export const zekoArchive = initGraphQLTada<{ introspection: zekoArchiveSchema; scalars: Scalars }>()
export const mina = initGraphQLTada<{ introspection: minaSchema; scalars: Scalars }>()
export const minaArchive = initGraphQLTada<{ introspection: minaArchiveSchema; scalars: Scalars }>()
export const bridgeIndexer = initGraphQLTada<{
	introspection: bridgeIndexerSchema
	scalars: Scalars
}>()
export const leaderboard = initGraphQLTada<{ introspection: leaderboardSchema; scalars: Scalars }>()
