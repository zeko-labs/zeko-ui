import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		include: ["tests/actions.test.ts"],
		environment: "node",
		pool: "forks",
		fileParallelism: false,
		env: {
			ACTIONS_API_TEST_DATABASE_URL:
				process.env.ACTIONS_API_TEST_DATABASE_URL ??
				"postgresql://postgres:postgres@localhost:5434/actions"
		}
	}
})
