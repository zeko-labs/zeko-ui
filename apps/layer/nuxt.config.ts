import { defineNuxtConfig } from "nuxt/config"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
	compatibilityDate: "2025-08-09",
	devtools: { enabled: true },
	modules: ["@hebilicious/nuxt-switch-match"],
	css: [join(currentDir, "./assets/styles/layer.css")]
})
