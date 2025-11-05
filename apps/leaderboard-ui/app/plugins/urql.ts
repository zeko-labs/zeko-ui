import urql, { cacheExchange, fetchExchange } from "@urql/vue"

export default defineNuxtPlugin((nuxtApp) => {
	const url = useRuntimeConfig().public.graphqlEndpoint
	nuxtApp.vueApp.use(urql, { url, exchanges: [cacheExchange, fetchExchange] })
})
