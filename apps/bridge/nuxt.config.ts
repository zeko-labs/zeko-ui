// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2024-09-19",
	css: [
		"@unocss/reset/sanitize/sanitize.css",
		"@unocss/reset/sanitize/assets.css",
		"~/assets/styles/fonts.css"
	],
	future: {
		compatibilityVersion: 4
	},
	routeRules: {
		"/": { swr: true, ssr: true, prerender: true },
		"/faucet": { swr: true, ssr: true, prerender: true },
		"/bridge": {
			ssr: false,
			static: true,
			prerender: true,
			headers: {
				"Cross-Origin-Embedder-Policy":
					process.env.NODE_ENV === "development" ? "unsafe-none" : "require-corp",
				"Cross-Origin-Opener-Policy": "same-origin"
			}
		}
	},
	runtimeConfig: {
		faucetUrl: process.env.FAUCET_URL
	},
	nitro: {
		minify: false
	},
	vite: {
		build: { minify: false }
	},
	postcss: {
		plugins: {
			"postcss-nesting": {
				edition: "2024-02"
			}
		}
	},
	devtools: { enabled: true },
	modules: ["@nuxt/fonts", "@pinia/nuxt", "@hebilicious/nuxt-switch-match"],
	fonts: {
		provider: "google"
	}
})
