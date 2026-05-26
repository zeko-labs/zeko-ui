import { describe, expect, it, vi } from "vitest"

vi.mock("@cloudflare/sandbox", () => ({
	getSandbox: vi.fn(),
	Sandbox: class Sandbox {}
}))

import { BRIDGE_VALIDATOR_SERVICE_INFO } from "../src/service-info"
import { getRemainingWorkflowTimeMs, WORKFLOW_HARD_TIMEOUT_MS } from "../src/runtime"
import { BRIDGE_CLI_SPECIFIER } from "../src/validator"
import { hasValidBearerToken, type ValidatorEnv } from "../src/env"

describe("bridge-validator worker", () => {
	it("exposes runtime metadata from the status surface", () => {
		expect(BRIDGE_VALIDATOR_SERVICE_INFO).toMatchObject({
			ok: true,
			service: "bridge-validator",
			workflow: "bridge-validator",
			trigger: {
				type: "cron",
				schedule: "0 */6 * * *"
			},
			runsPerSchedule: {
				deposit: "mina-to-zeko",
				withdrawal: "zeko-to-mina"
			},
			limits: {
				maxRuntimeMinutes: 120
			}
		})

		expect(BRIDGE_VALIDATOR_SERVICE_INFO.manualTrigger).toEqual(
			expect.arrayContaining([
				"moon run bridge-validator:trigger-deposit",
				"moon run bridge-validator:trigger-withdrawal"
			])
		)
		expect(BRIDGE_CLI_SPECIFIER).toBe("@zeko-labs/bridge-cli@latest")
	})

	it("caps process runtime to two hours", () => {
		expect(WORKFLOW_HARD_TIMEOUT_MS).toBe(2 * 60 * 60 * 1000)
		expect(
			getRemainingWorkflowTimeMs({
				startedAtMs: 1_000,
				nowMs: 1_000 + 30_000
			})
		).toBe(WORKFLOW_HARD_TIMEOUT_MS - 30_000)
		expect(
			getRemainingWorkflowTimeMs({
				startedAtMs: 1_000,
				nowMs: 1_000 + WORKFLOW_HARD_TIMEOUT_MS + 1
			})
		).toBe(0)
	})

	it("requires bearer authentication for HTTP surfaces", () => {
		const env = { VALIDATOR_API_TOKEN: "validator-token" } as ValidatorEnv
		const authorized = new Request("https://bridge-validator.zeko-labs.workers.dev", {
			headers: { authorization: "Bearer validator-token" }
		})
		const unauthorized = new Request("https://bridge-validator.zeko-labs.workers.dev", {
			headers: { authorization: "Bearer wrong" }
		})

		expect(hasValidBearerToken({ request: authorized, env })).toBe(true)
		expect(hasValidBearerToken({ request: unauthorized, env })).toBe(false)
	})
})
