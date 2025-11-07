import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineNuxtConfig } from "nuxt/config"

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
	compatibilityDate: "2025-08-09",
	devtools: { enabled: true },
	modules: ["@hebilicious/nuxt-switch-match"],
	css: [
		join(currentDir, "./app/assets/styles/cssforge.css"),
		join(currentDir, "./app/assets/styles/layer.css")
	],
	runtimeConfig: {
		public: {
			socials: {
				telegram: "https://t.me/zekoprotocol",
				discord: "https://discord.gg/vSDxqAchUY",
				twitter: "https://twitter.com/ZekoLabs",
				github: "https://github.com/zeko-labs"
			}
		}
	}
})
