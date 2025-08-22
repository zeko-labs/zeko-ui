export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	modules: [
		"@nuxt/fonts",
		"@pinia/nuxt",
		"@hebilicious/nuxt-switch-match",
		"nitro-cloudflare-dev",
		"@vite-pwa/nuxt"
	],
	extends: ["@zeko/layer"],
	routeRules: {
		"/": {
			ssr: false,
			static: true,
			prerender: true,
			headers: {
				"Cross-Origin-Resource-Policy": "same-site",
				"Cross-Origin-Embedder-Policy":
					process.env.NODE_ENV === "development" ? "credentialless" : "require-corp",
				"Cross-Origin-Opener-Policy": "same-origin"
			}
		}
	},
	nitro: { minify: false },
	vite: {
		worker: {
			format: "es"
		},
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
	],
	pwa: {
		srcDir: "service-worker",
		filename: "sw.ts",
		strategies: "injectManifest",
		devOptions: {
			enabled: true,
			type: "module"
		}
	}
})
