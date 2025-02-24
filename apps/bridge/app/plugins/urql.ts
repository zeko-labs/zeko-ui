import urql from "@urql/vue"

export default defineNuxtPlugin({
	name: "urql",
	async setup(nuxtApp) {
		if (import.meta.server) return
		const sdk = await import("@lumina-dex/sdk")
		nuxtApp.vueApp.use(urql, sdk.createClientOptions("https://devnet.zeko.io/graphql"))
	}
})
