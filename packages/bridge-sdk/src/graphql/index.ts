import { retryExchange } from "@urql/exchange-retry"
import { Client, type ClientOptions, fetchExchange } from "urql"

const clientCache = new Map<string, Client>()

export const createClientOptions = (url: string) =>
	({
		url,
		requestPolicy: "network-only",
		preferGetMethod: false,
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
