import { describe, expect, it, vi } from "vitest"

vi.mock("@cloudflare/sandbox", () => ({
	getSandbox: vi.fn(),
	Sandbox: class Sandbox {}
}))

import { getSandbox } from "@cloudflare/sandbox"
import { handleBridgeValidatorRequest } from "../src/request"
import { BRIDGE_VALIDATOR_SERVICE_INFO } from "../src/service-info"
import { getRemainingWorkflowTimeMs, WORKFLOW_HARD_TIMEOUT_MS } from "../src/runtime"
import { BRIDGE_CLI_SPECIFIER } from "../src/validator"
import { hasValidBearerToken, type ValidatorEnv } from "../src/env"
import packageJson from "../package.json"

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
				maxRuntimeMinutes: 120,
				commandTimeoutMinutes: 115,
				reportingReserveMinutes: 5
			}
		})

		expect(BRIDGE_VALIDATOR_SERVICE_INFO.manualTrigger).toEqual(
			expect.arrayContaining([
				"moon run bridge-validator:trigger-deposit",
				"moon run bridge-validator:trigger-withdrawal"
			])
		)
		expect(BRIDGE_CLI_SPECIFIER).toBe(
			`${packageJson.bridgeCli.package}@${packageJson.bridgeCli.version}`
		)
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

	it("uses the keepAlive sandbox handle for status diagnostics", async () => {
		vi.mocked(getSandbox).mockReturnValue({
			readFile: vi.fn(async (path: string) => {
				if (path.endsWith("/bridge.pid")) {
					return {
						success: true,
						path,
						content: "1234",
						timestamp: "2026-03-24T12:00:00Z"
					}
				}

				throw new Error("File not found")
			}),
			exec: vi.fn(async () => ({
				success: true,
				exitCode: 0,
				stdout: "running",
				stderr: "",
				command: "kill -0",
				duration: 10,
				timestamp: "2026-03-24T12:00:00Z"
			}))
		} as never)

		const response = await handleBridgeValidatorRequest({
			request: new Request(
				"https://bridge-validator.zeko-labs.workers.dev/bridge-status?instanceId=workflow-1"
			),
			env: { Sandbox: "sandbox-namespace" } as unknown as ValidatorEnv
		})

		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			sandboxId: "bridge-validator-workflow-1",
			command: {
				found: true,
				pid: "1234",
				processId: "bridge-validation-command",
				status: "running"
			}
		})
		expect(getSandbox).toHaveBeenCalledWith("sandbox-namespace", "bridge-validator-workflow-1", {
			keepAlive: true
		})
	})

	it("destroys a workflow sandbox through the authenticated cleanup surface", async () => {
		const destroy = vi.fn(async () => {})
		vi.mocked(getSandbox).mockReturnValue({
			destroy
		} as never)

		const response = await handleBridgeValidatorRequest({
			request: new Request(
				"https://bridge-validator.zeko-labs.workers.dev/bridge-cleanup?instanceId=workflow-1",
				{ method: "POST" }
			),
			env: { Sandbox: "sandbox-namespace" } as unknown as ValidatorEnv
		})

		await expect(response.json()).resolves.toEqual({
			ok: true,
			instanceId: "workflow-1",
			sandboxId: "bridge-validator-workflow-1",
			cleanup: "destroyed"
		})
		expect(destroy).toHaveBeenCalledOnce()
	})
})
