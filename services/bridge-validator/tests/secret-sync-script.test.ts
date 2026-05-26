import { dirname, resolve } from "node:path"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const script = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/sync-secrets.nu"),
	"utf8"
)
const statusScript = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/status.nu"),
	"utf8"
)

describe("bridge-validator secret sync script", () => {
	it("maps required local values into Cloudflare Worker secrets", () => {
		expect(script).toContain("default-env-file")
		expect(script).toContain("default-wrangler-config")
		expect(script).toContain("ZEKO_BRIDGE_MINA_PRIVATE_KEY")
		expect(script).toContain('put-secret "WALLET_PRIVATE_KEY"')
		expect(script).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(script).toContain('put-secret "VALIDATOR_API_TOKEN"')
	})

	it("loads the status bearer token from the dotenv file", () => {
		expect(statusScript).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(statusScript).toContain("http get --headers")
		expect(statusScript).not.toContain("$env.VALIDATOR_API_TOKEN")
	})
})
