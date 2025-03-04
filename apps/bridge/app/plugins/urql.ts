// export default defineNuxtPlugin({
// 	name: "urql",
// 	async setup(nuxtApp) {
// 		if (import.meta.server) return
// 		const sdk = await import("@lumina-dex/sdk")
// 		const urql = await import("@urql/vue")
// 		nuxtApp.vueApp.use(urql, sdk.createClientOptions("https://devnet.zeko.io/graphql"))
// 	}
// })
