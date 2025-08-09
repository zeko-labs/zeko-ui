// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	modules: ["@nuxt/fonts", "@pinia/nuxt", "@hebilicious/nuxt-switch-match", "nitro-cloudflare-dev"],
	extends: ["@zeko/layer"],
	routeRules: {
		"/": {
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
	nitro: { minify: false },
	vite: {
		optimizeDeps: {
			include: ["@lumina-dex/sdk > react"],
			exclude: ["@lumina-dex/sdk", "@urql/vue"]
		}
	},
	postcss: {
		plugins: {
			"postcss-nesting": { edition: "2024-02" }
		}
	},
	fonts: { provider: "google" },
	css: [
		"@unocss/reset/sanitize/sanitize.css",
		"@unocss/reset/sanitize/assets.css",
		"~/assets/styles/fonts.css"
	]
})
