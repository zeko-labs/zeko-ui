import urql, { cacheExchange, fetchExchange } from "@urql/vue"

const url = "https://api.leaderboard.zeko.io/graphql"
export default defineNuxtPlugin((nuxtApp) => {
	nuxtApp.vueApp.use(urql, { url, exchanges: [cacheExchange, fetchExchange] })
})
