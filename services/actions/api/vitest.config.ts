import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config"

const runLiveE2E = process.env.RUN_ACTIONS_API_LIVE_E2E === "1"

export default defineWorkersConfig({
	test: {
		env: {
			DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/actions",
			RUN_ACTIONS_API_LIVE_E2E: runLiveE2E ? "1" : "0",
			ACTIONS_API_E2E_BASE_URL: process.env.ACTIONS_API_E2E_BASE_URL ?? ""
		},
		fileParallelism: false,
		poolOptions: {
			workers: {
				singleWorker: true,
				miniflare: {
					// This is necessary to use scheduled with vitest
					compatibilityFlags: ["service_binding_extra_handlers"]
				},
				wrangler: { configPath: "./wrangler.jsonc" }
			}
		}
	}
})
