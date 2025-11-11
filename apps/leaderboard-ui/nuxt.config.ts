import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devServer: { port: 3069 },
	modules: ["@pinia/nuxt", "nitro-cloudflare-dev"],
	devtools: { enabled: false },
	extends: ["@zeko/layer"],
	css: ["~/assets/styles/main.css"],
	routeRules: {
		"/**": { ssr: false, static: true, prerender: true }
	},
	sourcemap: { client: "hidden" },
	nitro: { preset: "cloudflare-module", minify: false },
	runtimeConfig: {
		public: {
			graphqlEndpoint: process.env.GRAPHQL_ENDPOINT || "https://api.leaderboard.zeko.io/graphql"
		}
	},
	postcss: {
		plugins: {
			"@csstools/postcss-global-data": {
				files: [join(currentDir, "./app/assets/styles/queries.css")]
			},
			"postcss-preset-env": { browsers: "baseline widely available" }
		}
	}
})
