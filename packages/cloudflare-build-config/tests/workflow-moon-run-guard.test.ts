import { describe, expect, it } from "vitest"
import {
	assertWorkflowsUseCiRunnableMoonRunTargets,
	findWorkflowMoonRunViolations
} from "../../../scripts/check-workflow-moon-run.ts"

describe("findWorkflowMoonRunViolations", () => {
	it("rejects moon run for tasks that are not runnable in CI", () => {
		const violations = findWorkflowMoonRunViolations(
			[
				{
					path: ".github/workflows/sync-cloudflare-build-config.yaml",
					contents: [
						"jobs:",
						"  sync:",
						"    steps:",
						"      - run: moon run cloudflare-build-config:sync -- apps/bridge-ui/workers-build.jsonc"
					].join("\n")
				}
			],
			new Map([["cloudflare-build-config:sync", false]])
		)

		expect(violations).toEqual([
			expect.objectContaining({
				line: 4,
				target: "cloudflare-build-config:sync",
				workflowPath: ".github/workflows/sync-cloudflare-build-config.yaml"
			})
		])
	})

	it("allows workflow-only tasks through moon exec --ignore-ci-checks", () => {
		const violations = findWorkflowMoonRunViolations(
			[
				{
					path: ".github/workflows/sync-cloudflare-build-config.yaml",
					contents:
						"      - run: moon exec --ignore-ci-checks cloudflare-build-config:sync -- apps/bridge-ui/workers-build.jsonc"
				}
			],
			new Map([["cloudflare-build-config:sync", false]])
		)

		expect(violations).toEqual([])
	})

	it("keeps checked-in workflows from using moon run for non-CI tasks", async () => {
		await expect(assertWorkflowsUseCiRunnableMoonRunTargets()).resolves.toBeUndefined()
	})
})
