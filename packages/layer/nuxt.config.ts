import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineNuxtConfig } from "nuxt/config"

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
	compatibilityDate: "2025-08-09",
	devtools: { enabled: true },
	modules: ["@nuxt/fonts", "@hebilicious/nuxt-switch-match"],
	css: [
		"@unocss/reset/sanitize/sanitize.css",
		"@unocss/reset/sanitize/assets.css",
		join(currentDir, "./app/assets/styles/cssforge.css"),
		join(currentDir, "./app/assets/styles/layer.css")
	],
	fonts: { provider: "google" },
	postcss: {
		plugins: {
			"@csstools/postcss-global-data": {
				files: [join(currentDir, "./app/assets/styles/queries.css")]
			},
			"postcss-preset-env": { browsers: "baseline widely available" }
		}
	},
	runtimeConfig: {
		public: {
			socials: {
				telegram: "https://t.me/zekoprotocol",
				discord: "https://discord.gg/vSDxqAchUY",
				twitter: "https://twitter.com/ZekoLabs",
				github: "https://github.com/zeko-labs"
			},
			links: {
				docs: "https://docs.zeko.io",
				auroWallet: "https://www.aurowallet.com",
				zekoFaucet: "https://zeko.io/faucet",
				minaFaucet: "https://faucet.minaprotocol.com",
				zekoBridge: "https://alpha.bridge.zeko.io",
				solisDex: "https://solis.gizmolab.io",
				lumina: "https://beta.luminadex.com",
				zekoBoom: "https://zekoboom.zeko.io"
			}
		}
	}
})
