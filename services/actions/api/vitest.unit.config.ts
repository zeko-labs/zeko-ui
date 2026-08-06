import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		environment: "node",
		pool: "forks",
		fileParallelism: false,
		include: ["tests/cors.test.ts", "tests/wrangler-config.test.ts"]
	}
})
