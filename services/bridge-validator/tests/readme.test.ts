import { dirname, resolve } from "node:path"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const readme = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), "../README.md"),
	"utf8"
)

describe("bridge-validator README", () => {
	it("documents how the service runs", () => {
		expect(readme).toContain("## Runtime Contract")
		expect(readme).toContain("Cron runs every 6 hours")
		expect(readme).toContain("Worker, Workflow, and Sandbox path")
		expect(readme).toContain("Cloudflare Sandbox")
		expect(readme).toContain("published `@zeko-labs/bridge-cli@latest` package")
		expect(readme).toContain("zeko-bridge bridge --json --verbose")
		expect(readme).toContain("2 hour timeout")
		expect(readme).toContain("authenticated callback")
		expect(readme).not.toContain("operation resume <operation_id>")
	})

	it("documents what the service proves and what it does not prove", () => {
		expect(readme).toContain("## What It Proves")
		expect(readme).toContain("## What It Does Not Prove")
		expect(readme).toContain("One real deposit route")
		expect(readme).toContain("one real withdrawal route")
		expect(readme).toContain("2 hour hard stop")
		expect(readme).not.toContain("scheduled run exercises overlap in time")
	})

	it("documents merge-blocking gates and pre-deploy validation", () => {
		expect(readme).toContain("## Commands")
		expect(readme).toContain("## Acceptance Evidence")
		expect(readme).toContain("`VALIDATOR_API_TOKEN`")
		expect(readme).toContain("moon run bridge-validator:trigger-deposit")
		expect(readme).toContain("moon run bridge-validator:status-logs")
		expect(readme).not.toContain("cliSpecifier")
	})
})
