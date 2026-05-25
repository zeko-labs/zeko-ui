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
		expect(readme).toContain("## How It Runs")
		expect(readme).toContain("Cloudflare Cron")
		expect(readme).toContain("Cloudflare Workflow")
		expect(readme).toContain("Cloudflare Sandbox")
		expect(readme).toContain("installs `@zeko-labs/bridge-cli@latest` directly")
		expect(readme).toContain("`2` MINA bridge amount")
		expect(readme).toContain("starts one background Sandbox command")
		expect(readme).toContain("step.waitForEvent")
		expect(readme).toContain("/bridge-status?instanceId=")
		expect(readme).toContain("GNU `timeout`")
		expect(readme).toContain('readlink -f "$(command -v zeko-bridge)"')
		expect(readme).not.toContain("operation resume <operation_id>")
		expect(readme).toContain("hard 2-hour timeout")
	})

	it("documents what the service proves and what it does not prove", () => {
		expect(readme).toContain("## What This Proves")
		expect(readme).toContain("## What This Does Not Prove")
		expect(readme).toContain("one unattended deposit")
		expect(readme).toContain("one unattended withdrawal")
		expect(readme).toContain("hard stop after 120 minutes")
		expect(readme).not.toContain("scheduled run exercises overlap in time")
	})

	it("documents merge-blocking gates and pre-deploy validation", () => {
		expect(readme).toContain("## Merge Gates")
		expect(readme).toContain("## Pre-Deploy Manual Validation")
		expect(readme).toContain("## Funded Live Bridge Evidence")
		expect(readme).toContain("Local secret sync defaults to the repo-root [`.env`](../../.env)")
		expect(readme).toContain("`ZEKO_BRIDGE_MINA_PRIVATE_KEY`")
		expect(readme).toContain("Cloudflare `WALLET_PRIVATE_KEY` secret")
		expect(readme).toContain(
			'pnpm --dir services/bridge-validator exec wrangler workflows trigger bridge-validator \'{"routeKey":"mina-to-zeko"}\' --config wrangler.jsonc'
		)
		expect(readme).toContain(
			'pnpm --dir services/bridge-validator exec wrangler workflows trigger bridge-validator \'{"routeKey":"zeko-to-mina"}\' --config wrangler.jsonc'
		)
		expect(readme).toContain("/bridge-status?instanceId=<workflow-instance-id>&logs=1")
		expect(readme).not.toContain("cliSpecifier")
	})
})
