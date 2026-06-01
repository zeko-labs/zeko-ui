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
const describeInstanceScript = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/describe-instance.nu"),
	"utf8"
)
const cleanupScript = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/cleanup.nu"),
	"utf8"
)
const startScript = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/start.nu"),
	"utf8"
)
const moonConfig = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../moon.yml"),
	"utf8"
)

describe("bridge-validator secret sync script", () => {
	it("maps required local values into Cloudflare Worker secrets", () => {
		expect(script).toContain("default-env-file")
		expect(script).toContain("default-wrangler-config")
		expect(script).toContain("BRIDGE_VALIDATOR_WALLET_PRIVATE_KEY")
		expect(script).toContain("BRIDGE_VALIDATOR_WALLET_PUBLIC_KEY")
		expect(script).toContain("ZEKO_BRIDGE_MINA_PRIVATE_KEY")
		expect(script).toContain('put-secret "WALLET_PRIVATE_KEY"')
		expect(script).toContain('put-secret "WALLET_PUBLIC_KEY"')
		expect(script).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(script).toContain('put-secret "VALIDATOR_API_TOKEN"')
		expect(script).toContain('put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REPOSITORY"')
		expect(script).toContain('put-optional-secret $values "BRIDGE_VALIDATOR_SOURCE_REF"')
		expect(script).toContain('put-optional-secret $values "GITHUB_TOKEN"')
		expect(script.indexOf("ZEKO_BRIDGE_MINA_PRIVATE_KEY_0")).toBeLessThan(
			script.indexOf("ZEKO_BRIDGE_MINA_PRIVATE_KEY_1")
		)
	})

	it("loads the status bearer token from the dotenv file", () => {
		expect(statusScript).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(statusScript).toContain("http get")
		expect(statusScript).toContain("--max-time 20sec")
		expect(statusScript).not.toContain("$env.VALIDATOR_API_TOKEN")
	})

	it("uses Nu scripts for operator workflow diagnostics", () => {
		expect(describeInstanceScript).toContain("VALIDATOR_INSTANCE_ID")
		expect(describeInstanceScript).toContain("wrangler workflows instances describe")
		expect(cleanupScript).toContain("/bridge-cleanup?instanceId=")
		expect(cleanupScript).toContain("http post --max-time 30sec")
		expect(startScript).toContain("/bridge-start")
		expect(startScript).toContain('require-value $values "VALIDATOR_API_TOKEN"')
		expect(moonConfig).toContain("command: nu scripts/describe-instance.nu")
		expect(moonConfig).toContain("command: nu scripts/cleanup.nu")
		expect(moonConfig).toContain("command: nu scripts/start.nu mina-to-zeko")
		expect(moonConfig).toContain("command: nu scripts/start.nu zeko-to-mina")
		expect(moonConfig).not.toContain("bash -lc")
	})
})
