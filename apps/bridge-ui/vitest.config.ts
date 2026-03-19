/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
	resolve: {
		alias: {
			"~": fileURLToPath(new URL("./app", import.meta.url)),
			"~~": fileURLToPath(new URL("./", import.meta.url))
		}
	},
	test: {
		browser: {
			enabled: true,
			provider: "playwright",
			instances: [{ headless: true, browser: "chromium" }]
		},
		include: ["test/unit/**/*.ts"]
	}
})
