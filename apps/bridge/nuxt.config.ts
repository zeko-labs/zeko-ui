// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2024-04-03",
	ssr: false,
	css: [
		"@unocss/reset/sanitize/sanitize.css",
		"@unocss/reset/sanitize/assets.css",
		"~/assets/styles/fonts.css"
	],
	future: {
		compatibilityVersion: 4
	},
	routeRules: {
		"/": {
			headers: {
				"Cross-Origin-Embedder-Policy":
					process.env.NODE_ENV === "development" ? "unsafe-none" : "require-corp",
				"Cross-Origin-Opener-Policy": "same-origin"
			}
		}
	},
	postcss: {
		plugins: {
			"postcss-nesting": {
				edition: "2024-02"
			}
		}
	},
	devtools: { enabled: true },
	modules: ["@nuxt/fonts"],
	fonts: {
		provider: "google"
	}
})
