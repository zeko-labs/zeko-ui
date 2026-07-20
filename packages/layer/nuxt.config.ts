import { defineNuxtConfig } from "nuxt/config"

const layerDir = (import.meta as ImportMeta & { dirname: string }).dirname

export default defineNuxtConfig({
	compatibilityDate: "2025-08-09",
	devtools: { enabled: true },
	modules: ["@nuxt/fonts"],
	css: [
		"@unocss/reset/sanitize/sanitize.css",
		"@unocss/reset/sanitize/assets.css",
		new URL("./app/assets/styles/cssforge.css", import.meta.url).pathname,
		new URL("./app/assets/styles/layer.css", import.meta.url).pathname
	],
	fonts: { provider: "google" },
	postcss: {
		plugins: {
			"@csstools/postcss-global-data": {
				files: [new URL("./app/assets/styles/queries.css", import.meta.url).pathname]
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
				zekoBridge: "https://testnet.bridge.zeko.io",
				solisDex: "https://solis.gizmolab.io",
				lumina: "https://beta.luminadex.com",
				zekoBoom: "https://zekoboom.zeko.io"
			}
		}
	}
})
