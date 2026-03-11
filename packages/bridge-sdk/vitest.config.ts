import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
	resolve: {
		alias: {
			"@zeko-labs/graphql": fileURLToPath(new URL("../graphql/dist/index.js", import.meta.url))
		}
	},
	test: {
		environment: "node"
	}
})
