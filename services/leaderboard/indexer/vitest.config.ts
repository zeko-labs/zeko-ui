import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		env: {
			DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard"
		},
		// Run tests sequentially to avoid database conflicts
		pool: "forks",
		poolOptions: { forks: { singleFork: true } },
		isolate: false
	}
})
