// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-03-01",
	css: [
		"@unocss/reset/sanitize/sanitize.css",
		"@unocss/reset/sanitize/assets.css",
		"~/assets/styles/fonts.css"
	],
	future: {
		compatibilityVersion: 4
	},
	routeRules: {
		"/": { swr: false, ssr: true, prerender: true },
		"/faucet": { swr: false, ssr: true, prerender: true }
		// "/bridge": {
		// 	ssr: false,
		// 	static: true,
		// 	prerender: true,
		// 	headers: {
		// 		"Cross-Origin-Embedder-Policy":
		// 			process.env.NODE_ENV === "development" ? "unsafe-none" : "require-corp",
		// 		"Cross-Origin-Opener-Policy": "same-origin"
		// 	}
		// }
	},
	runtimeConfig: {
		faucetUrl: process.env.FAUCET_URL,
		public: {
			telegram: "https://t.me/zekoprotocol",
			discord: "https://discord.gg/vSDxqAchUY",
			twitter: "https://twitter.com/ZekoLabs",
			github: "https://github.com/zeko-labs",
		}
	},
	nitro: {
		//TODO: enable when supported by Nitro
		// cloudflare: { nodeCompat: true, deployConfig: true },
		minify: false
	},
	vite: {
		// build: { minify: false },
		// build: { rollupOptions: { external: ["cloudflare:workers"] } },
		optimizeDeps: {
			include: ["@lumina-dex/sdk > react"],
			exclude: ["@lumina-dex/sdk", "@urql/vue"]
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
	modules: ["@nuxt/fonts", "@pinia/nuxt", "@hebilicious/nuxt-switch-match", "nitro-cloudflare-dev"],
	fonts: {
		provider: "google"
	}
})
