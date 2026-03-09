import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config"

export default defineWorkersConfig({
	test: {
		env: {
			DATABASE_URL: "postgresql://postgres:postgres@localhost:5434/actions",
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
