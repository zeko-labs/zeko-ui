import urql, { cacheExchange, fetchExchange } from "@urql/vue"

const url = useRuntimeConfig().public.graphqlEndpoint
export default defineNuxtPlugin((nuxtApp) => {
	nuxtApp.vueApp.use(urql, { url, exchanges: [cacheExchange, fetchExchange] })
})
