import { retryExchange } from "@urql/exchange-retry"
import { initGraphQLTada } from "gql.tada"
import { Client, type ClientOptions, fetchExchange } from "urql"
import type { introspection as minaArchiveSchema } from "./generated/mina-archive-env"
import type { introspection as minaSchema } from "./generated/mina-env"
import type { introspection as zekoSchema } from "./generated/zeko-env"

type Scalars = {
	UInt64: string
	PublicKey: string
	TokenID: string
	Fee: string
	FieldElem: string
}

export const zeko = initGraphQLTada<{ introspection: zekoSchema; scalars: Scalars }>()
export const mina = initGraphQLTada<{ introspection: minaSchema; scalars: Scalars }>()
export const minaArchive = initGraphQLTada<{ introspection: minaArchiveSchema; scalars: Scalars }>()

const clientCache = new Map<string, Client>()

export const createClientOptions = (url: string) =>
	({
		url,
		requestPolicy: "network-only",
		exchanges: [
			retryExchange({
				maxDelayMs: 5000,
				initialDelayMs: 1000,
				maxNumberAttempts: 5,
				randomDelay: true,
				retryIf: (err) => !!err?.networkError
			}),
			fetchExchange
		]
	}) as ClientOptions

export const createGraphqlClient = (url: string) => {
	const cached = clientCache.get(url)
	if (cached) return cached
	const client = new Client(createClientOptions(url))
	clientCache.set(url, client)
	return client
}
