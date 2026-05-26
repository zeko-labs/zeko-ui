import { describe, expect, it, vi } from "vitest"

vi.mock("@cloudflare/sandbox", () => ({
	getSandbox: vi.fn(),
	Sandbox: class Sandbox {}
}))

import { getSandbox } from "@cloudflare/sandbox"
import { handleBridgeValidatorRequest } from "../src/request"
import { BRIDGE_VALIDATOR_SERVICE_INFO } from "../src/service-info"
import { getRemainingWorkflowTimeMs, WORKFLOW_HARD_TIMEOUT_MS } from "../src/runtime"
import { BRIDGE_CLI_SPECIFIER, BRIDGE_COMMAND_CALLBACK_EVENT } from "../src/validator"
import { buildValidatorUrl, hasValidBearerToken, type ValidatorEnv } from "../src/env"
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
				callbackGraceMinutes: 5
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

	it("builds deployment-specific worker URLs from configuration", () => {
		const env = {
			BRIDGE_VALIDATOR_BASE_URL: "https://preview.example.workers.dev"
		} as ValidatorEnv

		expect(buildValidatorUrl({ env, path: "/bridge-callback" })).toBe(
			"https://preview.example.workers.dev/bridge-callback"
		)
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

	it("does not mutate sandbox keepAlive settings for status diagnostics", async () => {
		vi.mocked(getSandbox).mockReturnValue({
			readFile: vi.fn(async () => ({ content: "1234" })),
			exec: vi.fn(async () => ({ stdout: "running" }))
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
				status: "running"
			}
		})
		expect(getSandbox).toHaveBeenCalledWith("sandbox-namespace", "bridge-validator-workflow-1")
	})

	it("routes callbacks to a per-run workflow event type", async () => {
		const sendEvent = vi.fn(async () => {})
		const get = vi.fn(async () => ({ sendEvent }))
		const payload = {
			instanceId: "workflow-1",
			token: "callback-token",
			exitCode: 0,
			stdout: "{}",
			stderr: ""
		}

		const response = await handleBridgeValidatorRequest({
			request: new Request("https://bridge-validator.zeko-labs.workers.dev/bridge-callback", {
				method: "POST",
				body: JSON.stringify(payload)
			}),
			env: { BRIDGE_VALIDATION_WORKFLOW: { get } } as unknown as ValidatorEnv
		})

		await expect(response.json()).resolves.toEqual({ ok: true })
		expect(get).toHaveBeenCalledWith("workflow-1")
		expect(sendEvent).toHaveBeenCalledWith({
			type: `${BRIDGE_COMMAND_CALLBACK_EVENT}:callback-token`,
			payload
		})
	})
})
