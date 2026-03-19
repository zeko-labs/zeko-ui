/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
	resolve: {
		alias: {
			"~": path.resolve(__dirname, "app"),
			"~~": path.resolve(__dirname)
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
