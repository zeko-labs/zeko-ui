import { initGraphQLTada } from "gql.tada"
import type { introspection as minaArchiveSchema } from "./generated/mina-archive-env"
import type { introspection as minaSchema } from "./generated/mina-env"
import type { introspection as zekoSchema } from "./generated/zeko-env"

type Scalars = { UInt64: string; PublicKey: string; TokenID: string }

export const zeko = initGraphQLTada<{ introspection: zekoSchema; scalars: Scalars }>()
export const mina = initGraphQLTada<{ introspection: minaSchema; scalars: Scalars }>()
export const minaArchive = initGraphQLTada<{ introspection: minaArchiveSchema; scalars: Scalars }>()