/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		browser: {
			enabled: true,
			provider: "playwright",
			instances: [{ headless: true, browser: "chromium" }]
		},
		include: ["test/unit/**/*.ts"]
	}
})
