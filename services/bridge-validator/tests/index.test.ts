import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"

vi.mock("@cloudflare/sandbox", () => ({
	getSandbox: vi.fn(),
	Sandbox: class Sandbox {}
}))

vi.mock("cloudflare:workers", () => ({
	WorkflowEntrypoint: class WorkflowEntrypoint {}
}))

import { getSandbox } from "@cloudflare/sandbox"
import worker from "../src/index"
import { handleBridgeValidatorRequest } from "../src/request"
import { BRIDGE_VALIDATOR_SERVICE_INFO } from "../src/service-info"
import {
	BRIDGE_COMMAND_INITIAL_POLL_INTERVAL_MS,
	BRIDGE_COMMAND_POLL_INTERVAL_MS,
	getRemainingWorkflowTimeMs,
	WORKFLOW_HARD_TIMEOUT_MS
} from "../src/runtime"
import { BRIDGE_CLI_SPECIFIER, buildBridgeSandboxId } from "../src/validator"
import { hasValidBearerToken, isValidatorEnabled, type ValidatorEnv } from "../src/env"
import packageJson from "../package.json"

const projectRoot = dirname(fileURLToPath(import.meta.url))

describe("bridge-validator worker", () => {
	it("exposes runtime metadata from the status surface", () => {
		expect(BRIDGE_VALIDATOR_SERVICE_INFO).toMatchObject({
			ok: true,
			service: "bridge-validator",
			workflow: "bridge-validator",
			trigger: {
				type: "cron",
				configuredIn: "wrangler.jsonc triggers.crons",
				enabledBy: "BRIDGE_VALIDATOR_ENABLED"
			},
			sourceBuild: {
				repository: "BRIDGE_VALIDATOR_SOURCE_REPOSITORY",
				ref: "BRIDGE_VALIDATOR_SOURCE_REF"
			},
			scheduledRoutes: {
				mode: "both-per-event",
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

	it("documents scheduled route behavior without encoding the cron schedule", () => {
		const readme = readFileSync(join(projectRoot, "../README.md"), "utf8")

		expect(readme).toContain("Each scheduled event starts two workflows")
		expect(readme).toContain("Cron cadence is configured only in `wrangler.jsonc`")
		expect(readme.toLowerCase()).not.toContain("alternat")
		expect(readme).not.toMatch(/\b0 \*\/3 \* \* \*\b/)
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

	it("spaces long bridge command polls to avoid noisy slow-operation polling", () => {
		expect(BRIDGE_COMMAND_INITIAL_POLL_INTERVAL_MS).toBe(30 * 1000)
		expect(BRIDGE_COMMAND_POLL_INTERVAL_MS).toBe(10 * 60 * 1000)
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

	it("rejects unauthenticated admin HTTP routes before route handling", async () => {
		const env = { VALIDATOR_API_TOKEN: "validator-token" } as ValidatorEnv
		const requests = [
			new Request("https://bridge-validator.zeko-labs.workers.dev"),
			new Request("https://bridge-validator.zeko-labs.workers.dev/bridge-start", {
				method: "POST"
			}),
			new Request(
				"https://bridge-validator.zeko-labs.workers.dev/bridge-status?instanceId=workflow-1&attempt=1"
			),
			new Request(
				"https://bridge-validator.zeko-labs.workers.dev/bridge-cleanup?instanceId=workflow-1&attempt=1",
				{ method: "POST" }
			)
		]
		const fetchHandler = worker.fetch as NonNullable<typeof worker.fetch>

		for (const request of requests) {
			const response = await fetchHandler(request as never, env, {} as never)
			expect(response.status).toBe(401)
			await expect(response.json()).resolves.toEqual({ ok: false, error: "Unauthorized" })
		}
		expect(getSandbox).not.toHaveBeenCalled()
	})

	it("allows scheduled runs to be disabled by environment config", () => {
		expect(isValidatorEnabled({ BRIDGE_VALIDATOR_ENABLED: "false" } as ValidatorEnv)).toBe(false)
		expect(isValidatorEnabled({ BRIDGE_VALIDATOR_ENABLED: "true" } as ValidatorEnv)).toBe(true)
		expect(isValidatorEnabled({} as ValidatorEnv)).toBe(true)
	})

	it("starts one workflow through the authenticated manual start surface", async () => {
		const create = vi.fn(async (input: unknown) => ({
			id: "manual-workflow-1",
			input
		}))
		const response = await handleBridgeValidatorRequest({
			request: new Request("https://bridge-validator.zeko-labs.workers.dev/bridge-start", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ routeKey: "mina-to-zeko" })
			}),
			env: {
				BRIDGE_VALIDATION_WORKFLOW: { create }
			} as unknown as ValidatorEnv
		})

		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			workflow: {
				id: "manual-workflow-1"
			}
		})
		expect(create).toHaveBeenCalledWith({
			id: expect.stringMatching(/^bridge-validator-manual-mina-to-zeko-/),
			params: { routeKey: "mina-to-zeko" }
		})
	})

	it("requires an explicit sandbox target for status diagnostics", async () => {
		const response = await handleBridgeValidatorRequest({
			request: new Request(
				"https://bridge-validator.zeko-labs.workers.dev/bridge-status?instanceId=workflow-1"
			),
			env: { Sandbox: "sandbox-namespace" } as unknown as ValidatorEnv
		})

		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Missing sandbox target: provide attempt or sandboxId"
		})
		expect(response.status).toBe(400)
		expect(getSandbox).not.toHaveBeenCalled()
	})

	it("checks one sandbox attempt handle for status diagnostics without keepAlive", async () => {
		const sandboxId = buildBridgeSandboxId({ instanceId: "workflow-1", attempt: 2 })
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
				"https://bridge-validator.zeko-labs.workers.dev/bridge-status?instanceId=workflow-1&attempt=2"
			),
			env: { Sandbox: "sandbox-namespace" } as unknown as ValidatorEnv
		})

		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			sandboxId,
			command: {
				found: true,
				pid: "1234",
				processId: "bridge-validation-command",
				status: "running"
			}
		})
		expect(getSandbox).toHaveBeenCalledWith("sandbox-namespace", sandboxId, {
			keepAlive: false
		})
	})

	it("destroys a workflow sandbox through the authenticated cleanup surface", async () => {
		const sandboxId = buildBridgeSandboxId({ instanceId: "workflow-1", attempt: 2 })
		const destroy = vi.fn(async () => {})
		vi.mocked(getSandbox).mockReturnValue({
			destroy
		} as never)

		const response = await handleBridgeValidatorRequest({
			request: new Request(
				"https://bridge-validator.zeko-labs.workers.dev/bridge-cleanup?instanceId=workflow-1&attempt=2",
				{ method: "POST" }
			),
			env: { Sandbox: "sandbox-namespace" } as unknown as ValidatorEnv
		})

		await expect(response.json()).resolves.toEqual({
			ok: true,
			instanceId: "workflow-1",
			sandboxId,
			cleanup: "destroyed"
		})
		expect(destroy).toHaveBeenCalledOnce()
	})
})
