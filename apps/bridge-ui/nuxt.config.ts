const headers = {
	"Cross-Origin-Resource-Policy": "same-site",
	"Cross-Origin-Embedder-Policy": "require-corp",
	"Cross-Origin-Opener-Policy": "same-origin"
} as const
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
		"/": { ssr: false, static: true, prerender: true, headers }
	},
	nitro: { minify: false },
	vite: {
		server: { headers },
		worker: {
			format: "es"
		},
		optimizeDeps: {
			include: ["@lumina-dex/sdk > react"],
			exclude: ["@lumina-dex/sdk", "@urql/vue"]
		}
	},
	hooks: {
		//Necessary for Nuxt DevTools
		"vite:serverCreated": (server) => {
			server.middlewares.use((_request, response, next) => {
				response.setHeaders(new Headers(headers))
				next()
			})
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
		"~/assets/styles/main.css"
	],
	pwa: {
		srcDir: "service-worker",
		filename: "sw.ts",
		strategies: "injectManifest",
		manifest: false,
		injectRegister: false,
		injectManifest: {
			injectionPoint: undefined
		},
		devOptions: {
			enabled: true,
			type: "module"
		}
	}
})
