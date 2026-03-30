import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const workerConfigurationPath = fileURLToPath(
	new URL("../worker-configuration.d.ts", import.meta.url)
)

describe("worker type generation", () => {
	it("includes the named faucet rpc service entrypoint and required turnstile secret", async () => {
		const contents = await readFile(workerConfigurationPath, "utf8")

		expect(contents).toContain("TURNSTILE_SECRET_KEY: string;")
		expect(contents).toContain(
			'FAUCET_RPC: Service<typeof import("../faucet/worker").TurnstileClaimsEntrypoint>;'
		)
	})
})
