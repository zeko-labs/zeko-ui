import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
	compatibilityDate: "2025-10-21",
	devServer: { port: 3092 },
	modules: ["nitro-cloudflare-dev"],
	devtools: { enabled: false },
	extends: ["@zeko/layer"],
	css: ["~/assets/styles/main.css"],
	routeRules: {
		"/**": { ssr: false, static: true, prerender: true }
	},
	sourcemap: { client: "hidden" },
	nitro: { preset: "cloudflare_module", minify: false },
	postcss: {
		plugins: {
			"@csstools/postcss-global-data": {
				files: [join(currentDir, "./app/assets/styles/queries.css")]
			},
			"postcss-preset-env": { browsers: "baseline widely available" }
		}
	}
})
