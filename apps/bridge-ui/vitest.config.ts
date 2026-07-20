/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import path from "node:path"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [vue()],
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
