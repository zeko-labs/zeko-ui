import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { sentryVitePlugin } from "@sentry/vite-plugin"

const currentDir = dirname(fileURLToPath(import.meta.url))

const headers = {
	"Cross-Origin-Resource-Policy": "same-site",
	"Cross-Origin-Embedder-Policy": "require-corp",
	"Cross-Origin-Opener-Policy": "same-origin",
	"Content-Security-Policy": "worker-src 'self' blob:; child-src 'self' blob:",
	"Document-Policy": "js-profiling"
} as const

const sentryOptions = {
	org: "zeko-labs",
	project: "zeko-bridge",
	telemetry: true,
	debug: true,
	applicationKey: "@zeko/bridge-ui",
	//TODO: Creating releases with the module/plugin causes the build to fail
	release: { create: false, inject: false, finalize: false }
} satisfies Parameters<typeof sentryVitePlugin>[0]
//TODO: Uploading source maps with the module/plugin causes the build to fail
const sentryViteOptions = { sourcemaps: { disable: true } } as const

const sentryPlugin = sentryVitePlugin({ ...sentryOptions, ...sentryViteOptions })

export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	modules: [
		"@nuxt/fonts",
		"@pinia/nuxt",
		"@hebilicious/nuxt-switch-match",
		"nitro-cloudflare-dev",
		"@vite-pwa/nuxt",
		"@sentry/nuxt/module"
	],
	devServer: { port: 3090 },
	devtools: { enabled: true },
	hooks: {
		//Necessary for Nuxt DevTools
		"vite:serverCreated": (server) => {
			server.middlewares.use((_request, response, next) => {
				response.setHeaders(new Headers(headers))
				next()
			})
		}
	},
	extends: ["@zeko/layer"],
	typescript: {
		tsConfig: {
			include: [join(currentDir, "sentry.client.config.ts"), join(currentDir, "machines")]
		}
	},
	postcss: {
		plugins: { "postcss-preset-env": { browsers: "baseline widely available" } }
	},
	fonts: { provider: "google" },
	css: [
		"@unocss/reset/sanitize/sanitize.css",
		"@unocss/reset/sanitize/assets.css",
		"~/assets/styles/main.css"
	],
	routeRules: {
		"/**": { ssr: false, static: true, prerender: true, headers }
	},
	sourcemap: { client: "hidden" },
	nitro: { preset: "cloudflare-module", minify: false },
	vite: {
		build: { minify: true },
		server: { headers },
		optimizeDeps: {
			include: ["@lumina-dex/sdk > react"],
			exclude: ["@lumina-dex/sdk", "@urql/vue"]
		},
		worker: {
			format: "es",
			plugins: () => [...sentryPlugin]
		}
	},
	pwa: {
		srcDir: "service-worker",
		filename: "sw.ts",
		strategies: "injectManifest",
		manifest: false,
		injectRegister: false,
		injectManifest: { injectionPoint: undefined, buildPlugins: { vite: [sentryPlugin] } },
		devOptions: { enabled: true, type: "module" }
	},
	sentry: {
		...sentryOptions,
		unstable_sentryBundlerPluginOptions: sentryViteOptions
		// authToken: process.env.SENTRY_AUTH_TOKEN,
	},
	runtimeConfig: {
		public: {
			release: process.env.SENTRY_RELEASE || "development",
			environment: process.env.SENTRY_ENVIRONMENT || "development",
			sentry: {
				// Use a public environment variable for the DSN
				dsn: process.env.SENTRY_DSN_PUBLIC
			}
		}
	}
})
