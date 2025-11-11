import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		env: {
			AUTH_TOKEN: "admin",
			DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/leaderboard",
			BROADCAST_URL: "http://localhost:9000/broadcast"
		},
		// Run tests sequentially to avoid database conflicts
		pool: "forks",
		poolOptions: { forks: { singleFork: true } },
		isolate: false
	}
})
