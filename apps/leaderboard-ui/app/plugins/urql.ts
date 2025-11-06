import { retryExchange } from "@urql/exchange-retry"
import urql, { fetchExchange, subscriptionExchange } from "@urql/vue"
import { createClient as createSSEClient } from "graphql-sse"

export default defineNuxtPlugin((nuxtApp) => {
	const url = useRuntimeConfig().public.graphqlEndpoint
	const sseClient = createSSEClient({ url })
	nuxtApp.vueApp.use(urql, {
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
			fetchExchange,
			subscriptionExchange({
				forwardSubscription(operation) {
					return {
						subscribe: (sink) => {
							const newOperation = Object.assign({}, operation, { query: operation.query ?? "" })
							const dispose = sseClient.subscribe(newOperation, sink)
							return { unsubscribe: dispose }
						}
					}
				}
			})
		]
	})
})
